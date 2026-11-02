-- Fix: "operator does not exist: date = text" in clear_and_import_week_data
--
-- Root cause: Line "DELETE FROM order_confirmation_resets WHERE week_date = p_week_date"
-- uses p_week_date (TEXT) instead of v_parsed_date (DATE).
-- All other comparisons in the function correctly use v_parsed_date.

DROP FUNCTION IF EXISTS clear_and_import_week_data(jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION clear_and_import_week_data(
  p_orders JSONB,
  p_allocations JSONB,
  p_week_date TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_null_uuid UUID := '00000000-0000-0000-0000-000000000000';
  v_orders_count INT := 0;
  v_allocations_count INT := 0;
  v_parsed_date DATE;
  v_skipped_allocations INT := 0;
BEGIN
  v_parsed_date := p_week_date::DATE;

  -- 1. Clear existing data (order matters for foreign keys)
  DELETE FROM distribution_tracking WHERE id != v_null_uuid;
  DELETE FROM storage_tracking WHERE id != v_null_uuid;
  DELETE FROM allocations WHERE id != v_null_uuid;
  DELETE FROM orders WHERE id != v_null_uuid;
  DELETE FROM custom_items WHERE id != v_null_uuid;

  -- supplies table may not exist
  BEGIN
    DELETE FROM supplies WHERE id != v_null_uuid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- Clear reset history for this week (FIX: use v_parsed_date not p_week_date)
  DELETE FROM order_confirmation_resets WHERE week_date = v_parsed_date;

  -- 2. Insert orders from JSONB array
  INSERT INTO orders (week_date, item_name, quantity, unit, storage_type, ran_out, non_allocated)
  SELECT
    v_parsed_date,
    o->>'item_name',
    COALESCE((o->>'quantity')::NUMERIC, 0),
    o->>'unit',
    o->>'storage_type',
    COALESCE((o->>'ran_out')::BOOLEAN, false),
    COALESCE((o->>'non_allocated')::NUMERIC, 0)
  FROM jsonb_array_elements(p_orders) AS o
  ON CONFLICT (week_date, item_name) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    storage_type = EXCLUDED.storage_type,
    ran_out = EXCLUDED.ran_out,
    non_allocated = EXCLUDED.non_allocated;

  GET DIAGNOSTICS v_orders_count = ROW_COUNT;

  -- 3. Insert allocations by joining on orders + destinations
  INSERT INTO allocations (order_id, destination_id, allocated_quantity)
  SELECT
    ord.id,
    dest.id,
    (a->>'quantity')::NUMERIC
  FROM jsonb_array_elements(p_allocations) AS a
  JOIN orders ord ON ord.item_name = a->>'item_name' AND ord.week_date = v_parsed_date
  JOIN destinations dest ON dest.code = a->>'destination_code'
  WHERE (a->>'quantity')::NUMERIC > 0;

  GET DIAGNOSTICS v_allocations_count = ROW_COUNT;

  -- Count skipped allocations (no matching order or destination)
  SELECT COUNT(*)::INT INTO v_skipped_allocations
  FROM jsonb_array_elements(p_allocations) AS a
  WHERE (a->>'quantity')::NUMERIC > 0
    AND (
      NOT EXISTS (
        SELECT 1 FROM orders ord
        WHERE ord.item_name = a->>'item_name' AND ord.week_date = v_parsed_date
      )
      OR NOT EXISTS (
        SELECT 1 FROM destinations dest
        WHERE dest.code = a->>'destination_code'
      )
    );

  RETURN jsonb_build_object(
    'orders_upserted', v_orders_count,
    'allocations_upserted', v_allocations_count,
    'allocations_skipped', v_skipped_allocations
  );
END;
$$ LANGUAGE plpgsql;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
