-- Migration: Add non_allocated column and batch import RPC
-- Description: Ensures non_allocated column exists on orders table and adds RPC for batch inventory import
-- Date: 2026-01-22

-- ============================================
-- 1. Add non_allocated column to orders table (if not exists)
-- ============================================

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS non_allocated NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN orders.non_allocated IS 'Quantity not allocated to any destination (Column N in Google Sheet)';

-- ============================================
-- 2. Create RPC function for batch inventory import from non_allocated
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
      -- Use existing add_inventory_from_order function (which is ADDITIVE)
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
  'Batch imports non_allocated quantities from orders to inventory for a given week. Uses additive logic - adds to existing inventory counts.';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
