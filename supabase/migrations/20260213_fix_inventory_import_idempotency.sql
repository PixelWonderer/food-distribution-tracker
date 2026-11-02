-- Fix: Make import_non_allocated_to_inventory idempotent
-- Problem: Each "Clear & Import" re-adds non-allocated quantities to inventory,
-- causing quantities to inflate when the same week is imported multiple times.
-- Solution: Reverse any previous order_import additions for the same week before re-adding.

CREATE OR REPLACE FUNCTION import_non_allocated_to_inventory(p_week_date date)
RETURNS TABLE(item_name text, quantity_imported numeric)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_order RECORD;
  v_item inventory_items;
  v_prev RECORD;
BEGIN
  -- STEP 1: Reverse any previous inventory imports for this week
  -- This makes re-importing the same week safe (idempotent)
  FOR v_prev IN
    SELECT ih.inventory_item_id, SUM(ih.new_quantity - ih.previous_quantity) as total_added
    FROM inventory_history ih
    WHERE ih.week_date = p_week_date
      AND ih.change_type = 'order_import'
    GROUP BY ih.inventory_item_id
  LOOP
    UPDATE inventory_items
    SET current_quantity = GREATEST(current_quantity - v_prev.total_added, 0),
        last_updated_at = now()
    WHERE id = v_prev.inventory_item_id;
  END LOOP;

  -- Delete old history entries for this week's imports
  DELETE FROM inventory_history
  WHERE week_date = p_week_date AND change_type = 'order_import';

  -- STEP 2: Import fresh (existing additive logic)
  FOR v_order IN
    SELECT id, orders.item_name, non_allocated
    FROM orders
    WHERE week_date = p_week_date
      AND COALESCE(non_allocated, 0) > 0
  LOOP
    BEGIN
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
$function$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
