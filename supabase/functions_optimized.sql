-- Optimized Database Functions for Food Tracker
-- Cleaned up and improved versions of existing functions

-- Function to get complete week data with all related tracking
CREATE OR REPLACE FUNCTION get_week_data(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  allocation_id UUID,
  order_id UUID,
  destination_id UUID,
  item_name TEXT,
  quantity NUMERIC,
  allocated_quantity NUMERIC,
  unit TEXT,
  storage_type TEXT,
  ran_out BOOLEAN,
  destination_code TEXT,
  destination_name TEXT,
  timing TEXT,
  is_direct BOOLEAN,
  is_stored BOOLEAN,
  stored_by TEXT,
  stored_at TIMESTAMP WITH TIME ZONE,
  is_distributed BOOLEAN,
  distributed_by TEXT,
  distributed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as allocation_id,
    o.id as order_id,
    d.id as destination_id,
    o.item_name,
    o.quantity,
    a.allocated_quantity,
    o.unit,
    o.storage_type,
    o.ran_out,
    d.code as destination_code,
    d.name as destination_name,
    d.timing,
    d.is_direct,
    COALESCE(st.is_stored, false) as is_stored,
    st.stored_by,
    st.stored_at,
    COALESCE(dt.is_distributed, false) as is_distributed,
    dt.distributed_by,
    dt.distributed_at
  FROM allocations a
  JOIN orders o ON a.order_id = o.id
  JOIN destinations d ON a.destination_id = d.id AND d.is_active = true
  LEFT JOIN storage_tracking st ON st.allocation_id = a.id
  LEFT JOIN distribution_tracking dt ON dt.allocation_id = a.id
  WHERE o.week_date = target_date
  ORDER BY d.display_order, o.item_name;
END;
$$ LANGUAGE plpgsql;

-- Simplified function to toggle storage status
CREATE OR REPLACE FUNCTION toggle_storage(
  p_allocation_id UUID,
  p_user_name TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
  current_status BOOLEAN;
  new_status BOOLEAN;
BEGIN
  -- Get current status
  SELECT is_stored INTO current_status
  FROM storage_tracking
  WHERE allocation_id = p_allocation_id;
  
  -- Calculate new status
  new_status := NOT COALESCE(current_status, false);
  
  -- Upsert the record
  INSERT INTO storage_tracking (allocation_id, is_stored, stored_by, stored_at)
  VALUES (
    p_allocation_id, 
    new_status, 
    CASE WHEN new_status THEN p_user_name ELSE NULL END,
    CASE WHEN new_status THEN NOW() ELSE NULL END
  )
  ON CONFLICT (allocation_id) 
  DO UPDATE SET 
    is_stored = new_status,
    stored_by = CASE WHEN new_status THEN p_user_name ELSE NULL END,
    stored_at = CASE WHEN new_status THEN NOW() ELSE NULL END;
  
  RETURN new_status;
END;
$$ LANGUAGE plpgsql;

-- Simplified function to toggle distribution status
CREATE OR REPLACE FUNCTION toggle_distribution(
  p_allocation_id UUID,
  p_user_name TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
  current_status BOOLEAN;
  new_status BOOLEAN;
BEGIN
  -- Get current status
  SELECT is_distributed INTO current_status
  FROM distribution_tracking
  WHERE allocation_id = p_allocation_id;
  
  -- Calculate new status
  new_status := NOT COALESCE(current_status, false);
  
  -- Upsert the record
  INSERT INTO distribution_tracking (allocation_id, is_distributed, distributed_by, distributed_at)
  VALUES (
    p_allocation_id, 
    new_status, 
    CASE WHEN new_status THEN p_user_name ELSE NULL END,
    CASE WHEN new_status THEN NOW() ELSE NULL END
  )
  ON CONFLICT (allocation_id) 
  DO UPDATE SET 
    is_distributed = new_status,
    distributed_by = CASE WHEN new_status THEN p_user_name ELSE NULL END,
    distributed_at = CASE WHEN new_status THEN NOW() ELSE NULL END;
  
  RETURN new_status;
END;
$$ LANGUAGE plpgsql;

-- Optimized bulk pack function for storage
CREATE OR REPLACE FUNCTION pack_all_storage(
  p_week_date DATE,
  p_destination_code TEXT,
  p_user_name TEXT DEFAULT 'system'
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH target_allocations AS (
    SELECT a.id
    FROM allocations a
    JOIN orders o ON a.order_id = o.id
    JOIN destinations d ON a.destination_id = d.id
    WHERE o.week_date = p_week_date
      AND d.code = p_destination_code
      AND d.is_active = true
      AND o.storage_type IS NOT NULL
      AND o.storage_type != ''
  )
  INSERT INTO storage_tracking (allocation_id, is_stored, stored_by, stored_at)
  SELECT ta.id, true, p_user_name, NOW()
  FROM target_allocations ta
  ON CONFLICT (allocation_id) 
  DO UPDATE SET 
    is_stored = true,
    stored_by = p_user_name,
    stored_at = NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Optimized bulk pack function for distribution
CREATE OR REPLACE FUNCTION pack_all_distribution(
  p_week_date DATE,
  p_destination_code TEXT,
  p_user_name TEXT DEFAULT 'system'
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH target_allocations AS (
    SELECT a.id
    FROM allocations a
    JOIN orders o ON a.order_id = o.id
    JOIN destinations d ON a.destination_id = d.id
    WHERE o.week_date = p_week_date
      AND d.code = p_destination_code
      AND d.is_active = true
  )
  INSERT INTO distribution_tracking (allocation_id, is_distributed, distributed_by, distributed_at)
  SELECT ta.id, true, p_user_name, NOW()
  FROM target_allocations ta
  ON CONFLICT (allocation_id) 
  DO UPDATE SET 
    is_distributed = true,
    distributed_by = p_user_name,
    distributed_at = NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get custom items for a week
CREATE OR REPLACE FUNCTION get_custom_items(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  item_id UUID,
  destination_code TEXT,
  destination_name TEXT,
  item_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  is_packed BOOLEAN,
  added_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id as item_id,
    d.code as destination_code,
    d.name as destination_name,
    ci.item_name,
    ci.quantity,
    ci.unit,
    ci.is_packed,
    ci.added_by,
    ci.created_at
  FROM custom_items ci
  JOIN destinations d ON ci.destination_id = d.id
  WHERE ci.week_date = target_date
    AND d.is_active = true
  ORDER BY d.display_order, ci.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle custom item packed status
CREATE OR REPLACE FUNCTION toggle_custom_item_packed(p_item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  new_status BOOLEAN;
BEGIN
  UPDATE custom_items
  SET is_packed = NOT is_packed
  WHERE id = p_item_id
  RETURNING is_packed INTO new_status;
  
  RETURN new_status;
END;
$$ LANGUAGE plpgsql;

-- Function to get supplies status for a week
CREATE OR REPLACE FUNCTION get_supplies_status(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  supply_id UUID,
  destination_code TEXT,
  destination_name TEXT,
  supply_type TEXT,
  is_packed BOOLEAN,
  quantity NUMERIC,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as supply_id,
    d.code as destination_code,
    d.name as destination_name,
    s.supply_type,
    s.is_packed,
    s.quantity,
    s.notes
  FROM supplies s
  JOIN destinations d ON s.destination_id = d.id
  WHERE s.week_date = target_date
    AND d.is_active = true
  ORDER BY d.display_order, s.supply_type;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle supply packed status
CREATE OR REPLACE FUNCTION toggle_supply_packed(p_supply_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  new_status BOOLEAN;
BEGIN
  UPDATE supplies
  SET is_packed = NOT is_packed
  WHERE id = p_supply_id
  RETURNING is_packed INTO new_status;
  
  RETURN new_status;
END;
$$ LANGUAGE plpgsql;

-- Enhanced clear and import function with better error handling
CREATE OR REPLACE FUNCTION clear_and_import_data(
  p_orders JSONB,
  p_allocations JSONB
)
RETURNS TABLE (
  orders_upserted INTEGER,
  allocations_upserted INTEGER,
  operation_status TEXT
) AS $$
DECLARE
  order_count INTEGER := 0;
  allocation_count INTEGER := 0;
BEGIN
  -- Clear weekly data tables using TRUNCATE for better performance
  TRUNCATE distribution_tracking, storage_tracking, allocations, orders RESTART IDENTITY CASCADE;

  -- Optional tables may not exist on older databases; skip them gracefully
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
  
  -- Insert new orders with better error handling
  WITH order_data AS (
    SELECT 
      (value->>'item_name')::TEXT as item_name,
      COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) as quantity,
      NULLIF(trim(value->>'unit'), '')::TEXT as unit,
      NULLIF(trim(value->>'storage_type'), '')::TEXT as storage_type,
      COALESCE((value->>'ran_out')::BOOLEAN, false) as ran_out
    FROM jsonb_array_elements(p_orders)
    WHERE (value->>'item_name') IS NOT NULL 
      AND COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) > 0
  )
  INSERT INTO orders (week_date, item_name, quantity, unit, storage_type, ran_out)
  SELECT CURRENT_DATE, item_name, quantity, unit, storage_type, ran_out
  FROM order_data;
  
  GET DIAGNOSTICS order_count = ROW_COUNT;
  
  -- Insert new allocations with validation
  WITH allocation_data AS (
    SELECT 
      o.id as order_id,
      d.id as destination_id,
      COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) as allocated_quantity
    FROM jsonb_array_elements(p_allocations) AS value
    JOIN orders o ON o.item_name = (value->>'item_name')::TEXT 
      AND o.week_date = CURRENT_DATE
    JOIN destinations d ON d.code = (value->>'destination_code')::TEXT
      AND d.is_active = true
    WHERE COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) > 0
  )
  INSERT INTO allocations (order_id, destination_id, allocated_quantity)
  SELECT order_id, destination_id, allocated_quantity
  FROM allocation_data;
  
  GET DIAGNOSTICS allocation_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    order_count, 
    allocation_count, 
    'SUCCESS'::TEXT as operation_status;
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      0, 
      0, 
      ('ERROR: ' || SQLERRM)::TEXT as operation_status;
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard summary
CREATE OR REPLACE FUNCTION get_dashboard_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_items INTEGER,
  total_destinations INTEGER,
  storage_complete INTEGER,
  distribution_complete INTEGER,
  custom_items_count INTEGER,
  supplies_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT a.id)::INTEGER as total_items,
    COUNT(DISTINCT d.id)::INTEGER as total_destinations,
    COUNT(CASE WHEN st.is_stored = true THEN 1 END)::INTEGER as storage_complete,
    COUNT(CASE WHEN dt.is_distributed = true THEN 1 END)::INTEGER as distribution_complete,
    (SELECT COUNT(*)::INTEGER FROM custom_items WHERE week_date = target_date) as custom_items_count,
    (SELECT COUNT(*)::INTEGER FROM supplies WHERE week_date = target_date) as supplies_count
  FROM allocations a
  JOIN orders o ON a.order_id = o.id
  JOIN destinations d ON a.destination_id = d.id
  LEFT JOIN storage_tracking st ON a.id = st.allocation_id
  LEFT JOIN distribution_tracking dt ON a.id = dt.allocation_id
  WHERE o.week_date = target_date
    AND d.is_active = true;
END;
$$ LANGUAGE plpgsql;
