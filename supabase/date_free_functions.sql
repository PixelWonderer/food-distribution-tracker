-- Date-free database functions for Food Tracker
-- Run these in your Supabase SQL Editor to eliminate date-based filtering

-- Drop existing functions first to allow type changes
DROP FUNCTION IF EXISTS get_all_week_data();
DROP FUNCTION IF EXISTS get_all_custom_items();
DROP FUNCTION IF EXISTS get_all_supplies_status();

-- 1. Get all week data without date filtering
CREATE OR REPLACE FUNCTION get_all_week_data()
RETURNS TABLE (
  allocation_id UUID,
  order_id UUID,
  destination_id UUID,
  item_name TEXT,
  quantity NUMERIC,
  allocated_quantity NUMERIC,
  received_quantity NUMERIC,
  unit TEXT,
  storage_type TEXT,
  destination_code TEXT,
  destination_name TEXT,
  is_stored BOOLEAN,
  stored_by TEXT,
  stored_at TIMESTAMP WITH TIME ZONE,
  is_distributed BOOLEAN,
  distributed_by TEXT,
  distributed_at TIMESTAMP WITH TIME ZONE,
  is_confirmed BOOLEAN,
  confirmed_by TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  ran_out BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as allocation_id,
    o.id as order_id,
    d.id as destination_id,
    o.item_name,
    o.quantity,
    a.allocated_quantity,
    a.received_quantity,
    o.unit,
    o.storage_type,
    d.code as destination_code,
    d.name as destination_name,
    COALESCE(st.is_stored, false) as is_stored,
    st.stored_by,
    st.stored_at,
    COALESCE(dt.is_distributed, false) as is_distributed,
    dt.distributed_by,
    dt.distributed_at,
    COALESCE(a.is_confirmed, false) as is_confirmed,
    a.confirmed_by,
    a.confirmed_at,
    COALESCE(o.ran_out, false) as ran_out
  FROM allocations a
  JOIN orders o ON o.id = a.order_id
  JOIN destinations d ON d.id = a.destination_id
  LEFT JOIN storage_tracking st ON st.allocation_id = a.id
  LEFT JOIN distribution_tracking dt ON dt.allocation_id = a.id
  WHERE a.allocated_quantity > 0
    AND o.week_date = (
      SELECT MAX(week_date) FROM orders
    )
  ORDER BY o.item_name, d.display_order;
END;
$$;

-- 2. Get all custom items without date filtering
CREATE OR REPLACE FUNCTION get_all_custom_items()
RETURNS TABLE (
  item_id UUID,
  destination_code TEXT,
  destination_name TEXT,
  item_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  is_packed BOOLEAN,
  added_by TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id as item_id,
    d.code as destination_code,
    d.name as destination_name,
    ci.item_name,
    ci.quantity,
    COALESCE(ci.unit, 'items') as unit,
    COALESCE(ci.is_packed, false) as is_packed,
    ci.added_by
  FROM custom_items ci
  JOIN destinations d ON d.id = ci.destination_id
  WHERE ci.week_date = (
    SELECT MAX(week_date) FROM orders
  )
  ORDER BY ci.created_at DESC;
END;
$$;

-- 3. Get all supplies without date filtering
CREATE OR REPLACE FUNCTION get_all_supplies_status()
RETURNS TABLE (
  supply_id UUID,
  destination_code TEXT,
  destination_name TEXT,
  supply_type TEXT,
  is_packed BOOLEAN,
  quantity NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as supply_id,
    d.code as destination_code,
    d.name as destination_name,
    s.supply_type,
    COALESCE(s.is_packed, false) as is_packed,
    s.quantity
  FROM supplies s
  JOIN destinations d ON d.id = s.destination_id
  WHERE s.week_date = (
    SELECT MAX(week_date) FROM orders
  )
  ORDER BY d.display_order, s.supply_type;
END;
$$;
