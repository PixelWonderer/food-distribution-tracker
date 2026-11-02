-- Migration: Add Inventory RPC Functions (continuation)
-- Run this if the tables already exist but functions are missing

-- ============================================
-- RPC function: set_inventory_count
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

-- ============================================
-- RPC function: add_inventory_from_order
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

-- ============================================
-- RPC function: add_custom_inventory_item
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

-- ============================================
-- RPC function: set_low_stock_threshold
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

-- ============================================
-- RPC function: fulfill_suggestion
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

-- ============================================
-- RPC function: auto_import_non_allocated_to_inventory
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

-- ============================================
-- Create/Replace the view
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

-- ============================================
-- Done
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Inventory RPC functions and view created successfully';
END $$;
