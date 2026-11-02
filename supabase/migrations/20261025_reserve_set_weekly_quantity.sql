-- Reserve: set each item to THIS week's col O amount instead of adding to last week's.
-- Problem (2026-10-25): import_non_allocated_to_inventory -> add_inventory_from_order added
-- non_allocated onto the same carried-over inventory row every week (rice +2/week since Feb
-- reached 31.75 when the week's Reserve was 2). Confirming an item at pickup called
-- auto_import_non_allocated_to_inventory, which added the Reserve a second time. is_packed
-- ("stored") also carried over, so a re-linked row could arrive already confirmed.
-- Fix: a set-based helper. Weekly import sets quantity + storage location and resets
-- is_packed for rows not already imported this week; the confirm-time path is a no-op once
-- the row is linked to the order. add_inventory_from_order is left as-is for other callers.

CREATE OR REPLACE FUNCTION set_reserve_inventory_from_order(
  p_order_id uuid,
  p_updated_by text DEFAULT 'system',
  p_reset_packed boolean DEFAULT false
)
RETURNS inventory_items
LANGUAGE plpgsql
AS $function$
DECLARE
  v_order RECORD;
  v_item inventory_items;
  v_existing inventory_items;
  v_qty NUMERIC;
BEGIN
  SELECT o.id, o.week_date, o.item_name, o.unit, o.storage_type, COALESCE(o.non_allocated, 0) AS non_alloc
  INTO v_order
  FROM orders o WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  v_qty := v_order.non_alloc;
  IF v_qty <= 0 THEN
    RETURN NULL;
  END IF;

  -- Same matching as add_inventory_from_order: order-linked (item_name) or custom (custom_name)
  SELECT * INTO v_existing
  FROM inventory_items
  WHERE (item_name = v_order.item_name OR custom_name = v_order.item_name)
    AND is_active = true
  ORDER BY current_quantity DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE inventory_items SET
      current_quantity = v_qty,
      order_id = p_order_id,
      item_name = COALESCE(item_name, v_order.item_name),
      storage_location = COALESCE(v_order.storage_type, storage_location),
      is_packed = CASE WHEN p_reset_packed THEN false ELSE is_packed END,
      last_updated_at = now(),
      last_updated_by = p_updated_by
    WHERE id = v_existing.id
    RETURNING * INTO v_item;
  ELSE
    INSERT INTO inventory_items (
      order_id, item_name, current_quantity, unit_of_measure, category,
      storage_location, emoji, last_updated_by
    )
    VALUES (
      p_order_id,
      v_order.item_name,
      v_qty,
      COALESCE(v_order.unit, 'Case'),
      COALESCE(v_order.storage_type, 'Pantry'),
      COALESCE(v_order.storage_type, 'Pantry'),
      '📦',
      p_updated_by
    )
    RETURNING * INTO v_item;
  END IF;

  INSERT INTO inventory_history (
    inventory_item_id, previous_quantity, new_quantity,
    change_type, changed_by, source_order_id, week_date
  )
  VALUES (
    v_item.id,
    COALESCE(v_existing.current_quantity, 0),
    v_item.current_quantity,
    'order_import', p_updated_by, p_order_id, v_order.week_date
  );

  IF v_item.current_quantity <= v_item.low_stock_threshold THEN
    INSERT INTO order_suggestions (inventory_item_id, suggested_quantity, reason, added_by)
    VALUES (v_item.id, v_item.low_stock_threshold * 2, 'low_stock', 'system')
    ON CONFLICT (inventory_item_id) WHERE is_fulfilled = false DO NOTHING;
  END IF;

  RETURN v_item;
END;
$function$;

-- Weekly import (Clear & Import and any scheduled backstop import both call this).
-- Re-importing the same week is idempotent: quantities are set, not added, and rows already
-- imported for this week keep their "stored" state.
CREATE OR REPLACE FUNCTION import_non_allocated_to_inventory(p_week_date date)
RETURNS TABLE(item_name text, quantity_imported numeric)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_order RECORD;
  v_item inventory_items;
  v_seen uuid[];
  v_match uuid;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT ih.inventory_item_id), '{}')
  INTO v_seen
  FROM inventory_history ih
  WHERE ih.week_date = p_week_date AND ih.change_type = 'order_import';

  DELETE FROM inventory_history
  WHERE week_date = p_week_date AND change_type = 'order_import';

  FOR v_order IN
    SELECT o.id, o.item_name, o.non_allocated
    FROM orders o
    WHERE o.week_date = p_week_date
      AND COALESCE(o.non_allocated, 0) > 0
  LOOP
    BEGIN
      -- Reset "stored" unless this row was already imported for this week (a re-import).
      SELECT ii.id INTO v_match
      FROM inventory_items ii
      WHERE (ii.item_name = v_order.item_name OR ii.custom_name = v_order.item_name)
        AND ii.is_active = true
      ORDER BY ii.current_quantity DESC
      LIMIT 1;
      v_item := set_reserve_inventory_from_order(
        v_order.id, 'import', NOT (COALESCE(v_match = ANY(v_seen), false))
      );
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

-- Confirm-time path (state.ts confirmItemAtExpected): no-op once the weekly import has linked
-- the row to this order; otherwise set (never add) without touching "stored".
CREATE OR REPLACE FUNCTION auto_import_non_allocated_to_inventory(p_order_id uuid, p_updated_by text DEFAULT 'system')
RETURNS inventory_items
LANGUAGE plpgsql
AS $function$
DECLARE
  v_linked inventory_items;
BEGIN
  SELECT * INTO v_linked
  FROM inventory_items
  WHERE order_id = p_order_id AND is_active = true
  LIMIT 1;

  IF v_linked.id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  RETURN set_reserve_inventory_from_order(p_order_id, p_updated_by, false);
END;
$function$;
