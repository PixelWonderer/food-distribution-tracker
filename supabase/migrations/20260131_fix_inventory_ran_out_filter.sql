-- Migration: Filter out inventory items from ran-out orders
-- Date: 2026-01-31
-- Issue: Inventory items still show in storage/inventory tabs when linked order ran out
-- Fix: Add WHERE clause to exclude items where the linked order has ran_out = true

-- ============================================
-- Update inventory_items_view to filter out ran-out orders
-- ============================================

-- Drop and recreate the view to avoid column ordering issues
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
WHERE i.is_active = true
  AND (i.order_id IS NULL OR COALESCE(o.ran_out, false) = false);

COMMENT ON VIEW inventory_items_view IS
  'Inventory items with computed fields like item_name and is_low_stock. Excludes items from orders that ran out.';

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== Inventory Ran-Out Filter Migration ===';
  RAISE NOTICE 'Updated inventory_items_view to exclude items from ran-out orders';
  RAISE NOTICE 'Custom inventory items (order_id IS NULL) are unaffected';
END $$;
