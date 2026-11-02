-- Migration: Add is_packed column for Storage view integration
-- Description: Adds packed status tracking and toggle RPCs for inventory items in StorageView
-- Date: 2026-01-24

-- ============================================
-- 1. Add is_packed column to inventory_items
-- ============================================

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_packed BOOLEAN DEFAULT false;

COMMENT ON COLUMN inventory_items.is_packed IS 'Whether this inventory item has been packed/stored (for StorageView tracking)';

-- ============================================
-- 2. Create index for faster filtering
-- ============================================

CREATE INDEX IF NOT EXISTS idx_inventory_items_is_packed
  ON inventory_items(is_packed)
  WHERE is_active = true;

-- ============================================
-- 3. Drop and recreate view with explicit columns (to avoid duplicate item_name)
-- ============================================

DROP VIEW IF EXISTS inventory_items_view;

CREATE VIEW inventory_items_view AS
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
  i.is_packed,
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
  'Inventory items with computed fields like item_name, is_low_stock, and is_packed';

-- ============================================
-- 4. Create RPC to toggle inventory packed status
-- ============================================

CREATE OR REPLACE FUNCTION toggle_inventory_packed(p_item_id UUID)
RETURNS inventory_items AS $$
DECLARE
  v_item inventory_items;
BEGIN
  UPDATE inventory_items
  SET is_packed = NOT COALESCE(is_packed, false),
      last_updated_at = now()
  WHERE id = p_item_id AND is_active = true
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_item_id;
  END IF;

  RETURN v_item;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION toggle_inventory_packed IS
  'Toggles the is_packed status of an inventory item for StorageView';

-- ============================================
-- 5. Create RPC to set all inventory items packed status
-- ============================================

CREATE OR REPLACE FUNCTION set_all_inventory_packed(p_packed BOOLEAN)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE inventory_items
  SET is_packed = p_packed,
      last_updated_at = now()
  WHERE is_active = true AND current_quantity > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_all_inventory_packed IS
  'Sets all active inventory items with positive quantity to packed/unpacked status';

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== Inventory is_packed Migration ===';
  RAISE NOTICE 'Added is_packed column to inventory_items';
  RAISE NOTICE 'Created index for is_packed filtering';
  RAISE NOTICE 'Updated inventory_items_view';
  RAISE NOTICE 'Created toggle_inventory_packed RPC';
  RAISE NOTICE 'Created set_all_inventory_packed RPC';
END $$;
