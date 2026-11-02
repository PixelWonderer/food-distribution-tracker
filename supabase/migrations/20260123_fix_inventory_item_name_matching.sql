-- Migration: Fix Inventory Duplication by Matching on Item Name
-- Description: Changes inventory matching from order_id to item_name to prevent
--              duplicates when orders are re-imported with new UUIDs
-- Date: 2026-01-23

-- ============================================
-- 1. Add item_name column to inventory_items
-- ============================================

ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS item_name TEXT;

COMMENT ON COLUMN inventory_items.item_name IS
  'Canonical item name for matching (populated from orders.item_name, persists across imports)';

-- ============================================
-- 2. Populate item_name from existing order references
-- ============================================

UPDATE inventory_items i
SET item_name = o.item_name
FROM orders o
WHERE i.order_id = o.id
  AND i.item_name IS NULL
  AND i.custom_name IS NULL;

-- ============================================
-- 3. Merge existing duplicates BEFORE creating unique index
-- ============================================

DO $$
DECLARE
  v_dup RECORD;
  v_keep_id UUID;
  v_total_qty NUMERIC;
  v_merged_count INT := 0;
BEGIN
  -- Find items with duplicates by item_name (from orders via order_id)
  FOR v_dup IN
    WITH item_names AS (
      SELECT i.id, o.item_name, i.current_quantity, i.created_at
      FROM inventory_items i
      JOIN orders o ON o.id = i.order_id
      WHERE i.is_active = true AND i.custom_name IS NULL
    ),
    duplicates AS (
      SELECT item_name, COUNT(*) as cnt
      FROM item_names
      GROUP BY item_name
      HAVING COUNT(*) > 1
    )
    SELECT d.item_name
    FROM duplicates d
  LOOP
    -- Get the oldest entry's ID (the one we'll keep)
    SELECT i.id
    INTO v_keep_id
    FROM inventory_items i
    JOIN orders o ON o.id = i.order_id
    WHERE o.item_name = v_dup.item_name
      AND i.is_active = true
      AND i.custom_name IS NULL
    ORDER BY i.created_at ASC
    LIMIT 1;

    -- Calculate total quantity across all duplicates
    SELECT COALESCE(SUM(i.current_quantity), 0)
    INTO v_total_qty
    FROM inventory_items i
    JOIN orders o ON o.id = i.order_id
    WHERE o.item_name = v_dup.item_name
      AND i.is_active = true
      AND i.custom_name IS NULL;

    -- Update the kept item with merged quantity and set item_name
    UPDATE inventory_items
    SET current_quantity = v_total_qty,
        item_name = v_dup.item_name,
        last_updated_at = now(),
        last_updated_by = 'migration_merge'
    WHERE id = v_keep_id;

    -- Deactivate the duplicate entries (soft delete)
    UPDATE inventory_items i
    SET is_active = false,
        last_updated_at = now(),
        last_updated_by = 'migration_dedup'
    FROM orders o
    WHERE o.id = i.order_id
      AND o.item_name = v_dup.item_name
      AND i.id != v_keep_id
      AND i.is_active = true
      AND i.custom_name IS NULL;

    v_merged_count := v_merged_count + 1;
    RAISE NOTICE 'Merged duplicates for item: % (total qty: %)', v_dup.item_name, v_total_qty;
  END LOOP;

  IF v_merged_count > 0 THEN
    RAISE NOTICE 'Total item types merged: %', v_merged_count;
  ELSE
    RAISE NOTICE 'No duplicates found to merge';
  END IF;
END $$;

-- ============================================
-- 4. Create unique index on item_name for order-linked items
-- ============================================

-- This prevents duplicates when matching by name
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_item_name_unique
  ON inventory_items(item_name)
  WHERE item_name IS NOT NULL AND is_active = true AND custom_name IS NULL;

-- Regular index for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_item_name
  ON inventory_items(item_name)
  WHERE item_name IS NOT NULL;

-- ============================================
-- 5. Drop the old unique_order_item constraint
-- ============================================

-- The order_id unique constraint is no longer the primary deduplication mechanism
-- because order_id changes on each import. Item name is now the stable identifier.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_order_item'
  ) THEN
    ALTER TABLE inventory_items DROP CONSTRAINT unique_order_item;
    RAISE NOTICE 'Dropped constraint: unique_order_item';
  END IF;
END $$;

-- ============================================
-- 6. Update add_inventory_from_order to match by item_name
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
  v_existing_id UUID;
BEGIN
  -- Get order details including item_name
  SELECT o.*, o.week_date as w_date, o.item_name as o_item_name
  INTO v_order
  FROM orders o WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  v_week_date := v_order.w_date;

  -- Check if an inventory item already exists for this item_name
  SELECT id, current_quantity
  INTO v_existing_id, v_previous_qty
  FROM inventory_items
  WHERE item_name = v_order.o_item_name
    AND is_active = true
    AND custom_name IS NULL;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing item: add quantity and update order_id reference
    UPDATE inventory_items SET
      current_quantity = current_quantity + p_quantity,
      order_id = p_order_id,  -- Update to current week's order for metadata
      last_updated_at = now(),
      last_updated_by = p_updated_by
    WHERE id = v_existing_id
    RETURNING * INTO v_item;
  ELSE
    -- Insert new inventory item
    v_previous_qty := 0;
    INSERT INTO inventory_items (
      order_id, item_name, current_quantity, unit_of_measure, category,
      storage_location, emoji, last_updated_by
    )
    VALUES (
      p_order_id,
      v_order.o_item_name,  -- Store item_name directly
      p_quantity,
      COALESCE(v_order.unit, 'Case'),
      COALESCE(v_order.storage_type, 'Pantry'),
      COALESCE(v_order.storage_type, 'Pantry'),
      COALESCE(v_order.emoji, '📦'),
      p_updated_by
    )
    RETURNING * INTO v_item;
  END IF;

  -- Record history
  INSERT INTO inventory_history (
    inventory_item_id, previous_quantity, new_quantity,
    change_type, changed_by, source_order_id, week_date
  )
  VALUES (
    v_item.id,
    COALESCE(v_previous_qty, 0),
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
  'Adds quantity to inventory from a confirmed order. Matches by item_name (not order_id) to prevent duplicates across imports.';

-- ============================================
-- 7. Update inventory_items_view to use stored item_name
-- ============================================

DROP VIEW IF EXISTS inventory_items_view;
CREATE OR REPLACE VIEW inventory_items_view AS
SELECT
  i.id,
  i.order_id,
  i.custom_name,
  i.current_quantity,
  i.low_stock_threshold,
  i.unit_of_measure,
  i.category,
  i.storage_location,
  i.emoji,
  i.last_updated_at,
  i.last_updated_by,
  i.created_at,
  i.is_active,
  -- item_name: prefer stored item_name, then custom_name, then fall back to orders JOIN
  COALESCE(i.custom_name, i.item_name, o.item_name) as item_name,
  i.current_quantity <= i.low_stock_threshold as is_low_stock,
  EXISTS (
    SELECT 1 FROM order_suggestions s
    WHERE s.inventory_item_id = i.id AND s.is_fulfilled = false
  ) as has_pending_suggestion
FROM inventory_items i
LEFT JOIN orders o ON o.id = i.order_id
WHERE i.is_active = true;

COMMENT ON VIEW inventory_items_view IS
  'Inventory items with computed fields. item_name prefers stored value, falls back to orders JOIN for legacy.';

-- ============================================
-- 8. Update import_non_allocated_to_inventory (batch version)
-- ============================================

CREATE OR REPLACE FUNCTION import_non_allocated_to_inventory(p_week_date DATE)
RETURNS TABLE(item_name TEXT, quantity_imported NUMERIC) AS $$
DECLARE
  v_order RECORD;
  v_item inventory_items;
BEGIN
  -- Process all orders with non_allocated > 0 for the given week
  FOR v_order IN
    SELECT id, orders.item_name, non_allocated
    FROM orders
    WHERE week_date = p_week_date
      AND COALESCE(non_allocated, 0) > 0
  LOOP
    BEGIN
      -- Use add_inventory_from_order (now matches by item_name)
      v_item := add_inventory_from_order(v_order.id, v_order.non_allocated, 'import');
      item_name := v_order.item_name;
      quantity_imported := v_order.non_allocated;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to import % to inventory: %', v_order.item_name, SQLERRM;
    END;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION import_non_allocated_to_inventory IS
  'Batch imports non_allocated quantities from orders to inventory. Uses additive logic matching by item_name.';

-- ============================================
-- Refresh PostgREST schema cache
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- Summary
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Inventory item_name matching migration complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  1. Added item_name column to inventory_items';
  RAISE NOTICE '  2. Merged existing duplicate entries';
  RAISE NOTICE '  3. Created unique index on item_name';
  RAISE NOTICE '  4. Updated add_inventory_from_order() to match by name';
  RAISE NOTICE '  5. Updated inventory_items_view';
  RAISE NOTICE '';
  RAISE NOTICE 'How it works now:';
  RAISE NOTICE '  - Inventory items match by item_name (not order_id)';
  RAISE NOTICE '  - Quantities are additive across imports';
  RAISE NOTICE '  - order_id is updated to latest order for metadata';
  RAISE NOTICE '';
END $$;
