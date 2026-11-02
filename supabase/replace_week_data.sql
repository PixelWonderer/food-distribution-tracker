-- Replace week data with fractional quantity support
-- Run this in Supabase SQL editor to update the RPC used by Clear & Import

DROP FUNCTION IF EXISTS replace_week_data(JSONB, JSONB, TEXT);

CREATE OR REPLACE FUNCTION replace_week_data(
  p_orders JSONB,
  p_allocations JSONB,
  p_week_date TEXT
)
RETURNS TABLE (
  orders_upserted INTEGER,
  allocations_upserted INTEGER
) AS $$
DECLARE
  v_week_date DATE := COALESCE(NULLIF(p_week_date, '')::DATE, CURRENT_DATE);
  order_count INTEGER := 0;
  allocation_count INTEGER := 0;
BEGIN
  -- Wipe existing data (preserves referential integrity and resets tracking)
  TRUNCATE TABLE
    distribution_tracking,
    storage_tracking,
    allocations,
    orders
  RESTART IDENTITY CASCADE;

  -- Older databases might not have the optional custom_items or supplies tables yet.
  -- Skip truncation gracefully when they are missing so Clear & Import still works.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'custom_items'
  ) THEN
    EXECUTE 'TRUNCATE TABLE custom_items RESTART IDENTITY CASCADE';
  ELSE
    RAISE NOTICE 'Skipping custom_items truncate (table not found)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'supplies'
  ) THEN
    EXECUTE 'TRUNCATE TABLE supplies RESTART IDENTITY CASCADE';
  ELSE
    RAISE NOTICE 'Skipping supplies truncate (table not found)';
  END IF;

  -- Insert orders
  WITH order_data AS (
    SELECT
      (value->>'item_name')::TEXT AS item_name,
      COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) AS quantity,
      NULLIF((value->>'unit')::TEXT, '') AS unit,
      NULLIF((value->>'storage_type')::TEXT, '') AS storage_type,
      COALESCE((value->>'ran_out')::BOOLEAN, FALSE) AS ran_out
    FROM jsonb_array_elements(p_orders)
  )
  INSERT INTO orders (week_date, item_name, quantity, unit, storage_type, ran_out)
  SELECT v_week_date, item_name, quantity, unit, storage_type, ran_out
  FROM order_data
  WHERE item_name IS NOT NULL;

  GET DIAGNOSTICS order_count = ROW_COUNT;

  -- Insert allocations
  WITH allocation_data AS (
    SELECT
      o.id AS order_id,
      d.id AS destination_id,
      COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) AS allocated_quantity
    FROM jsonb_array_elements(p_allocations) AS value
    JOIN orders o ON o.item_name = (value->>'item_name')::TEXT
    JOIN destinations d ON d.code = (value->>'destination_code')::TEXT
    WHERE o.week_date = v_week_date
  )
  INSERT INTO allocations (order_id, destination_id, allocated_quantity)
  SELECT order_id, destination_id, allocated_quantity
  FROM allocation_data
  WHERE allocated_quantity > 0;

  GET DIAGNOSTICS allocation_count = ROW_COUNT;

  RETURN QUERY SELECT order_count, allocation_count;
END;
$$ LANGUAGE plpgsql;
