-- Migration: Add Inventory System (replacing Surplus)
-- Description: Creates tables for persistent inventory tracking with low-stock alerts
-- Date: 2026-01-21

-- ============================================
-- 1. Create inventory_items table
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Item identification (either from Food Bank order or custom)
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  custom_name TEXT,

  -- Core fields
  current_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(10, 2) DEFAULT 2,
  unit_of_measure TEXT DEFAULT 'Case',
  category TEXT,
  storage_location TEXT,
  emoji TEXT DEFAULT '📦',

  -- Audit fields
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  last_updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,

  -- Constraints
  CONSTRAINT check_quantity_non_negative CHECK (current_quantity >= 0),
  CONSTRAINT check_threshold_non_negative CHECK (low_stock_threshold >= 0),
  CONSTRAINT unique_order_item UNIQUE (order_id),
  CONSTRAINT check_has_identifier CHECK (order_id IS NOT NULL OR custom_name IS NOT NULL)
);

-- Partial unique index for custom names (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_custom_name_unique
  ON inventory_items(custom_name) WHERE custom_name IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON inventory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON inventory_items(current_quantity, low_stock_threshold)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_items_order_id ON inventory_items(order_id) WHERE order_id IS NOT NULL;

COMMENT ON TABLE inventory_items IS 'Persistent inventory tracking for pantry items';
COMMENT ON COLUMN inventory_items.order_id IS 'Link to Food Bank order item (null for custom items)';
COMMENT ON COLUMN inventory_items.custom_name IS 'Name for non-Food Bank items (null for order-linked items)';
COMMENT ON COLUMN inventory_items.low_stock_threshold IS 'Quantity at which item is flagged for reorder';

-- ============================================
-- 2. Create inventory_history table
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  previous_quantity NUMERIC(10, 2),
  new_quantity NUMERIC(10, 2) NOT NULL,
  change_type TEXT NOT NULL,
  change_reason TEXT,

  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT now(),

  -- Optional link to order that caused the change
  source_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  week_date DATE,

  CONSTRAINT check_change_type CHECK (change_type IN ('manual_count', 'order_import', 'adjustment', 'correction', 'initial'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_history_item ON inventory_history(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_date ON inventory_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_inventory_history_week ON inventory_history(week_date) WHERE week_date IS NOT NULL;

COMMENT ON TABLE inventory_history IS 'Audit trail for all inventory quantity changes';
COMMENT ON COLUMN inventory_history.change_type IS 'Type of change: manual_count, order_import, adjustment, correction, initial';

-- ============================================
-- 3. Create order_suggestions table
-- ============================================

CREATE TABLE IF NOT EXISTS order_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  suggested_quantity NUMERIC(10, 2),
  reason TEXT NOT NULL,

  added_at TIMESTAMPTZ DEFAULT now(),
  added_by TEXT,
  is_fulfilled BOOLEAN DEFAULT false,
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by TEXT,

  CONSTRAINT check_reason CHECK (reason IN ('low_stock', 'manual_add', 'popular_item'))
);

-- Only one pending suggestion per item
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_suggestions_pending
  ON order_suggestions(inventory_item_id) WHERE is_fulfilled = false;

CREATE INDEX IF NOT EXISTS idx_order_suggestions_fulfilled ON order_suggestions(is_fulfilled);

COMMENT ON TABLE order_suggestions IS 'Items suggested for the next order based on low stock or manual request';

-- ============================================
-- 4. Create RPC function: set_inventory_count
-- ============================================

CREATE OR REPLACE FUNCTION set_inventory_count(
  p_item_id UUID,
  p_new_quantity NUMERIC,
  p_updated_by TEXT DEFAULT 'Volunteer'
)
RETURNS inventory_items AS $$
DECLARE
  v_item inventory_items;
  v_previous_qty NUMERIC;
BEGIN
  -- Get current quantity
  SELECT current_quantity INTO v_previous_qty
  FROM inventory_items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_item_id;
  END IF;

  -- Update inventory
  UPDATE inventory_items SET
    current_quantity = GREATEST(0, p_new_quantity),
    last_updated_at = now(),
    last_updated_by = p_updated_by
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  -- Record history
  INSERT INTO inventory_history (
    inventory_item_id, previous_quantity, new_quantity,
    change_type, changed_by
  )
  VALUES (
    p_item_id, v_previous_qty, v_item.current_quantity,
    'manual_count', p_updated_by
  );

  -- Auto-manage suggestions based on threshold
  IF v_item.current_quantity <= v_item.low_stock_threshold THEN
    -- Add suggestion if below threshold
    INSERT INTO order_suggestions (inventory_item_id, suggested_quantity, reason, added_by)
    VALUES (v_item.id, v_item.low_stock_threshold * 2, 'low_stock', 'system')
    ON CONFLICT (inventory_item_id) WHERE is_fulfilled = false DO NOTHING;
  ELSE
    -- Remove low_stock suggestion if stock is now adequate
    DELETE FROM order_suggestions
    WHERE inventory_item_id = p_item_id
      AND reason = 'low_stock'
      AND is_fulfilled = false;
  END IF;

  RETURN v_item;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_inventory_count IS
  'Sets absolute inventory count (physical count model), records history, and manages suggestions';

-- ============================================
-- 5. Create RPC function: add_inventory_from_order
-- ============================================

CREATE OR REPLACE FUNCTION add_inventory_from_order(
  p_order_id UUID,
  p_quantity NUMERIC,
  p_updated_by TEXT DEFAULT 'system'
)
RETURNS inventory_items AS $$
DECLARE
  v_item inventory_items;
  v_order RECORD;
  v_previous_qty NUMERIC;
  v_week_date DATE;
BEGIN
  -- Get order details
  SELECT o.*, o.week_date as w_date INTO v_order
  FROM orders o WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  v_week_date := v_order.w_date;

  -- Upsert inventory item
  INSERT INTO inventory_items (
    order_id, current_quantity, unit_of_measure, category,
    storage_location, emoji, last_updated_by
  )
  VALUES (
    p_order_id, p_quantity, COALESCE(v_order.unit, 'Case'),
    COALESCE(v_order.storage_type, 'Pantry'),
    COALESCE(v_order.storage_type, 'Pantry'),
    '📦', p_updated_by  -- orders table doesn't have emoji column
  )
  ON CONFLICT (order_id) DO UPDATE SET
    current_quantity = inventory_items.current_quantity + EXCLUDED.current_quantity,
    last_updated_at = now(),
    last_updated_by = p_updated_by
  RETURNING * INTO v_item;

  -- Get previous quantity for history (0 if new item)
  v_previous_qty := COALESCE(v_item.current_quantity - p_quantity, 0);

  -- Record history
  INSERT INTO inventory_history (
    inventory_item_id, previous_quantity, new_quantity,
    change_type, changed_by, source_order_id, week_date
  )
  VALUES (
    v_item.id,
    v_previous_qty,
    v_item.current_quantity,
    'order_import', p_updated_by, p_order_id, v_week_date
  );

  -- Check if low stock and create suggestion
  IF v_item.current_quantity <= v_item.low_stock_threshold THEN
    INSERT INTO order_suggestions (inventory_item_id, suggested_quantity, reason, added_by)
    VALUES (v_item.id, v_item.low_stock_threshold * 2, 'low_stock', 'system')
    ON CONFLICT (inventory_item_id) WHERE is_fulfilled = false DO NOTHING;
  END IF;

  RETURN v_item;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_inventory_from_order IS
  'Adds quantity to inventory from a confirmed order (auto-import of non-allocated items)';

-- ============================================
-- 6. Create RPC function: add_custom_inventory_item
-- ============================================

CREATE OR REPLACE FUNCTION add_custom_inventory_item(
  p_name TEXT,
  p_quantity NUMERIC,
  p_unit TEXT DEFAULT 'Each',
  p_category TEXT DEFAULT 'Pantry',
  p_storage_location TEXT DEFAULT 'Pantry',
  p_low_stock_threshold NUMERIC DEFAULT 2,
  p_emoji TEXT DEFAULT '📦',
  p_added_by TEXT DEFAULT 'Volunteer'
)
RETURNS inventory_items AS $$
DECLARE
  v_item inventory_items;
BEGIN
  INSERT INTO inventory_items (
    custom_name, current_quantity, unit_of_measure, category,
    storage_location, low_stock_threshold, emoji, last_updated_by
  )
  VALUES (
    p_name, GREATEST(0, p_quantity), p_unit, p_category,
    p_storage_location, p_low_stock_threshold, p_emoji, p_added_by
  )
  RETURNING * INTO v_item;

  -- Record initial history
  INSERT INTO inventory_history (
    inventory_item_id, previous_quantity, new_quantity,
    change_type, changed_by
  )
  VALUES (
    v_item.id, 0, v_item.current_quantity,
    'initial', p_added_by
  );

  -- Check if starting below threshold
  IF v_item.current_quantity <= v_item.low_stock_threshold THEN
    INSERT INTO order_suggestions (inventory_item_id, suggested_quantity, reason, added_by)
    VALUES (v_item.id, v_item.low_stock_threshold * 2, 'low_stock', 'system')
    ON CONFLICT (inventory_item_id) WHERE is_fulfilled = false DO NOTHING;
  END IF;

  RETURN v_item;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_custom_inventory_item IS
  'Creates a new custom inventory item (not linked to Food Bank orders)';

-- ============================================
-- 7. Create RPC function: set_low_stock_threshold
-- ============================================

CREATE OR REPLACE FUNCTION set_low_stock_threshold(
  p_item_id UUID,
  p_threshold NUMERIC
)
RETURNS inventory_items AS $$
DECLARE
  v_item inventory_items;
BEGIN
  UPDATE inventory_items SET
    low_stock_threshold = GREATEST(0, p_threshold),
    last_updated_at = now()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_item_id;
  END IF;

  -- Re-evaluate suggestions with new threshold
  IF v_item.current_quantity <= v_item.low_stock_threshold THEN
    INSERT INTO order_suggestions (inventory_item_id, suggested_quantity, reason, added_by)
    VALUES (v_item.id, v_item.low_stock_threshold * 2, 'low_stock', 'system')
    ON CONFLICT (inventory_item_id) WHERE is_fulfilled = false DO NOTHING;
  ELSE
    DELETE FROM order_suggestions
    WHERE inventory_item_id = p_item_id
      AND reason = 'low_stock'
      AND is_fulfilled = false;
  END IF;

  RETURN v_item;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_low_stock_threshold IS
  'Updates the low-stock threshold for an item and re-evaluates suggestions';

-- ============================================
-- 8. Create RPC function: fulfill_suggestion
-- ============================================

CREATE OR REPLACE FUNCTION fulfill_suggestion(
  p_suggestion_id UUID,
  p_fulfilled_by TEXT DEFAULT 'Volunteer'
)
RETURNS void AS $$
BEGIN
  UPDATE order_suggestions SET
    is_fulfilled = true,
    fulfilled_at = now(),
    fulfilled_by = p_fulfilled_by
  WHERE id = p_suggestion_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fulfill_suggestion IS
  'Marks an order suggestion as fulfilled (item has been ordered)';

-- ============================================
-- 9. Create view for inventory with computed fields
-- ============================================

CREATE OR REPLACE VIEW inventory_items_view AS
SELECT
  i.*,
  COALESCE(i.custom_name, o.item_name) as item_name,
  i.current_quantity <= i.low_stock_threshold as is_low_stock,
  EXISTS (
    SELECT 1 FROM order_suggestions s
    WHERE s.inventory_item_id = i.id AND s.is_fulfilled = false
  ) as has_pending_suggestion
FROM inventory_items i
LEFT JOIN orders o ON o.id = i.order_id
WHERE i.is_active = true;

COMMENT ON VIEW inventory_items_view IS
  'Inventory items with computed fields like item_name and is_low_stock';

-- ============================================
-- 10. Enable RLS (Row Level Security)
-- ============================================

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write (this app uses anon key)
CREATE POLICY "Allow all operations on inventory_items" ON inventory_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on inventory_history" ON inventory_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on order_suggestions" ON order_suggestions
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 11. Create RPC function: auto_import_non_allocated_to_inventory
-- ============================================

CREATE OR REPLACE FUNCTION auto_import_non_allocated_to_inventory(
  p_order_id UUID,
  p_updated_by TEXT DEFAULT 'system'
)
RETURNS inventory_items AS $$
DECLARE
  v_order RECORD;
  v_non_allocated NUMERIC;
BEGIN
  -- Get order details including non_allocated quantity
  SELECT o.*, COALESCE(o.non_allocated, 0) as non_alloc INTO v_order
  FROM orders o WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  v_non_allocated := v_order.non_alloc;

  -- Skip if no non-allocated quantity
  IF v_non_allocated <= 0 THEN
    RETURN NULL;
  END IF;

  -- Delegate to add_inventory_from_order with the non_allocated quantity
  RETURN add_inventory_from_order(p_order_id, v_non_allocated, p_updated_by);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_import_non_allocated_to_inventory IS
  'Auto-imports non-allocated quantity from a confirmed order to inventory';

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Inventory System migration completed successfully';
  RAISE NOTICE '   - Created inventory_items table';
  RAISE NOTICE '   - Created inventory_history table';
  RAISE NOTICE '   - Created order_suggestions table';
  RAISE NOTICE '   - Created 6 RPC functions';
  RAISE NOTICE '   - Created inventory_items_view';
  RAISE NOTICE '   - Enabled RLS with permissive policies';
END $$;
