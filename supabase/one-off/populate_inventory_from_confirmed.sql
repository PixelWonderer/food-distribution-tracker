-- One-time script: Populate inventory from existing confirmed orders
-- Run this ONCE after applying the inventory tables migration
-- This imports non_allocated quantities from already-confirmed orders

DO $$
DECLARE
  v_order RECORD;
  v_item inventory_items;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📦 Starting inventory population from confirmed orders...';

  -- Find all confirmed orders with non_allocated > 0
  FOR v_order IN
    SELECT id, item_name, non_allocated
    FROM orders
    WHERE confirmed_at IS NOT NULL
      AND non_allocated > 0
  LOOP
    BEGIN
      -- Call the add_inventory_from_order function
      v_item := add_inventory_from_order(v_order.id, v_order.non_allocated, 'migration');
      v_count := v_count + 1;
      RAISE NOTICE '  ✓ Added % of "%" to inventory', v_order.non_allocated, v_order.item_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Failed to add "%": %', v_order.item_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '✅ Inventory population complete: % items imported', v_count;
END $$;
