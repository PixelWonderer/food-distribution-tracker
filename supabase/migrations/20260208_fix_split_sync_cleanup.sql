-- Fix BUG-2/BUG-3: Split sync doesn't clean up destination allocations
--
-- Problem: sync_splits_to_destination_allocations only UPSERTs. When a
-- destination is removed from splits (or splits are cleared entirely),
-- the Partner 11/Partner 10 allocation rows persist as orphans.
--
-- Fix: After upserting active splits, DELETE destination allocations
-- for custom destinations (is_custom=true) that are no longer in splits.

CREATE OR REPLACE FUNCTION sync_splits_to_destination_allocations(p_allocation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $function$
DECLARE
  v_split RECORD;
  v_order_id UUID;
  v_active_dest_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Get the order_id from the source allocation
  SELECT order_id INTO v_order_id FROM allocations WHERE id = p_allocation_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Source allocation not found';
  END IF;

  -- Process each destination split: upsert allocation
  FOR v_split IN
    SELECT recipient, quantity, recipient_destination_id
    FROM allocation_day_splits
    WHERE allocation_id = p_allocation_id
      AND recipient_type = 'destination'
      AND recipient_destination_id IS NOT NULL
  LOOP
    -- Upsert allocation for the destination
    INSERT INTO allocations (order_id, destination_id, allocated_quantity)
    VALUES (v_order_id, v_split.recipient_destination_id, v_split.quantity)
    ON CONFLICT (order_id, destination_id) DO UPDATE
    SET allocated_quantity = EXCLUDED.allocated_quantity,
        updated_at = now();

    -- Track which destination IDs are still active
    v_active_dest_ids := array_append(v_active_dest_ids, v_split.recipient_destination_id);
  END LOOP;

  -- Clean up: delete destination allocations that are no longer in splits.
  -- Only delete allocations for Partner 10/Partner 11 (is_custom = true destinations)
  -- to avoid accidentally deleting allocations from the original import.
  DELETE FROM allocations a
  USING destinations d
  WHERE a.order_id = v_order_id
    AND a.destination_id = d.id
    AND d.is_custom = true
    AND (array_length(v_active_dest_ids, 1) IS NULL
         OR a.destination_id != ALL(v_active_dest_ids));

  RETURN TRUE;
END;
$function$;
