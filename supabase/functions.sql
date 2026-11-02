-- Database Functions for Common Operations

-- Function to get complete week data with all related tracking
CREATE OR REPLACE FUNCTION get_week_data(target_date DATE)
RETURNS TABLE (
  allocation_id UUID,
  order_id UUID,
  destination_id UUID,
  item_name TEXT,
  quantity NUMERIC,
  allocated_quantity NUMERIC,
  unit TEXT,
  storage_type TEXT,
  destination_code TEXT,
  destination_name TEXT,
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
    d.code as destination_code,
    d.name as destination_name,
    COALESCE(st.is_stored, false) as is_stored,
    st.stored_by,
    st.stored_at,
    COALESCE(dt.is_distributed, false) as is_distributed,
    dt.distributed_by,
    dt.distributed_at
  FROM allocations a
  JOIN orders o ON a.order_id = o.id
  JOIN destinations d ON a.destination_id = d.id
  LEFT JOIN storage_tracking st ON st.allocation_id = a.id
  LEFT JOIN distribution_tracking dt ON dt.allocation_id = a.id
  WHERE o.week_date = target_date
  ORDER BY d.display_order, o.item_name;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle storage status
CREATE OR REPLACE FUNCTION toggle_storage(
  p_allocation_id UUID,
  p_user_name TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
  current_status BOOLEAN;
  result BOOLEAN;
BEGIN
  -- Get current status
  SELECT is_stored INTO current_status
  FROM storage_tracking
  WHERE allocation_id = p_allocation_id;
  
  -- If no record exists, create one with is_stored = true
  IF current_status IS NULL THEN
    INSERT INTO storage_tracking (allocation_id, is_stored, stored_by, stored_at)
    VALUES (p_allocation_id, true, p_user_name, NOW())
    ON CONFLICT (allocation_id) 
    DO UPDATE SET 
      is_stored = true,
      stored_by = p_user_name,
      stored_at = NOW();
    result := true;
  ELSE
    -- Toggle the status
    UPDATE storage_tracking
    SET 
      is_stored = NOT current_status,
      stored_by = CASE WHEN NOT current_status THEN p_user_name ELSE NULL END,
      stored_at = CASE WHEN NOT current_status THEN NOW() ELSE NULL END
    WHERE allocation_id = p_allocation_id;
    result := NOT current_status;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle distribution status
CREATE OR REPLACE FUNCTION toggle_distribution(
  p_allocation_id UUID,
  p_user_name TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
  current_status BOOLEAN;
  result BOOLEAN;
BEGIN
  -- Get current status
  SELECT is_distributed INTO current_status
  FROM distribution_tracking
  WHERE allocation_id = p_allocation_id;
  
  -- If no record exists, create one with is_distributed = true
  IF current_status IS NULL THEN
    INSERT INTO distribution_tracking (allocation_id, is_distributed, distributed_by, distributed_at)
    VALUES (p_allocation_id, true, p_user_name, NOW())
    ON CONFLICT (allocation_id) 
    DO UPDATE SET 
      is_distributed = true,
      distributed_by = p_user_name,
      distributed_at = NOW();
    result := true;
  ELSE
    -- Toggle the status
    UPDATE distribution_tracking
    SET 
      is_distributed = NOT current_status,
      distributed_by = CASE WHEN NOT current_status THEN p_user_name ELSE NULL END,
      distributed_at = CASE WHEN NOT current_status THEN NOW() ELSE NULL END
    WHERE allocation_id = p_allocation_id;
    result := NOT current_status;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to pack all items for storage for a specific destination and date
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

-- Function to pack all items for distribution for a specific destination and date
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
CREATE OR REPLACE FUNCTION get_custom_items(target_date DATE)
RETURNS TABLE (
  item_id UUID,
  destination_code TEXT,
  destination_name TEXT,
  item_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  is_packed BOOLEAN,
  added_by TEXT
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
    ci.added_by
  FROM custom_items ci
  JOIN destinations d ON ci.destination_id = d.id
  WHERE ci.week_date = target_date
  ORDER BY d.display_order, ci.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle custom item packed status
-- Since the UI removes the item when toggled, we'll delete it from the database
CREATE OR REPLACE FUNCTION toggle_custom_item_packed(
  p_item_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete the custom item (simulating it being "packed")
  DELETE FROM custom_items
  WHERE id = p_item_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Return true if an item was deleted, false otherwise
  RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get supplies status for a week
CREATE OR REPLACE FUNCTION get_supplies_status(target_date DATE)
RETURNS TABLE (
  supply_id UUID,
  destination_code TEXT,
  destination_name TEXT,
  supply_type TEXT,
  is_packed BOOLEAN,
  quantity NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as supply_id,
    d.code as destination_code,
    d.name as destination_name,
    s.supply_type,
    s.is_packed,
    s.quantity
  FROM supplies s
  JOIN destinations d ON s.destination_id = d.id
  WHERE s.week_date = target_date
  ORDER BY d.display_order, s.supply_type;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle supply packed status
CREATE OR REPLACE FUNCTION toggle_supply_packed(
  p_supply_id UUID
)
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

-- Function to sync data from Google Sheets (will be called by sync service)
CREATE OR REPLACE FUNCTION sync_from_sheets(
  p_week_date DATE,
  p_orders JSONB,
  p_allocations JSONB
)
RETURNS TABLE (
  orders_upserted INTEGER,
  allocations_upserted INTEGER
) AS $$
DECLARE
  order_count INTEGER := 0;
  allocation_count INTEGER := 0;
BEGIN
  -- Upsert orders
  WITH order_data AS (
    SELECT 
      (value->>'item_name')::TEXT as item_name,
      COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) as quantity,
      (value->>'unit')::TEXT as unit,
      (value->>'storage_type')::TEXT as storage_type
    FROM jsonb_array_elements(p_orders)
  )
  INSERT INTO orders (week_date, item_name, quantity, unit, storage_type)
  SELECT p_week_date, item_name, quantity, unit, storage_type
  FROM order_data
  ON CONFLICT (week_date, item_name) 
  DO UPDATE SET
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    storage_type = EXCLUDED.storage_type;
  
  GET DIAGNOSTICS order_count = ROW_COUNT;
  
  -- Upsert allocations
  WITH allocation_data AS (
    SELECT 
      o.id as order_id,
      d.id as destination_id,
      COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) as allocated_quantity
    FROM jsonb_array_elements(p_allocations) AS value
    JOIN orders o ON o.item_name = (value->>'item_name')::TEXT AND o.week_date = p_week_date
    JOIN destinations d ON d.code = (value->>'destination_code')::TEXT
  )
  INSERT INTO allocations (order_id, destination_id, allocated_quantity)
  SELECT order_id, destination_id, allocated_quantity
  FROM allocation_data
  ON CONFLICT (order_id, destination_id) 
  DO UPDATE SET
    allocated_quantity = EXCLUDED.allocated_quantity;
  
  GET DIAGNOSTICS allocation_count = ROW_COUNT;
  
  RETURN QUERY SELECT order_count, allocation_count;
END;
$$ LANGUAGE plpgsql;

--- Function to clear all weekly data and import fresh data
CREATE OR REPLACE FUNCTION clear_and_import_data(
  p_orders JSONB,
  p_allocations JSONB
)
RETURNS TABLE (
  orders_upserted INTEGER,
  allocations_upserted INTEGER
) AS $$
DECLARE
  order_count INTEGER := 0;
  allocation_count INTEGER := 0;
BEGIN
  -- Clear ALL weekly data tables (in dependency order)
  
  -- 1. Clear tracking data first (depends on allocations)
  DELETE FROM distribution_tracking WHERE id IS NOT NULL;
  DELETE FROM storage_tracking WHERE id IS NOT NULL;
  
  -- 2. Clear allocations (depends on orders and destinations)
  DELETE FROM allocations WHERE id IS NOT NULL;
  
  -- 3. Clear custom items
  DELETE FROM custom_items WHERE id IS NOT NULL;
  
  -- 4. Clear supplies
  DELETE FROM supplies WHERE id IS NOT NULL;
  
  -- 5. Clear orders (base table)
  DELETE FROM orders WHERE id IS NOT NULL;
  
  -- Insert new orders (using current date - simple and consistent)
  WITH order_data AS (
    SELECT 
      (value->>'item_name')::TEXT as item_name,
      COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) as quantity,
      (value->>'unit')::TEXT as unit,
      (value->>'storage_type')::TEXT as storage_type,
      COALESCE((value->>'ran_out')::BOOLEAN, false) as ran_out
    FROM jsonb_array_elements(p_orders)
  )
  INSERT INTO orders (week_date, item_name, quantity, unit, storage_type, ran_out)
  SELECT CURRENT_DATE, item_name, quantity, unit, storage_type, ran_out
  FROM order_data;
  
  GET DIAGNOSTICS order_count = ROW_COUNT;
  
  -- Insert new allocations
  WITH allocation_data AS (
    SELECT 
      o.id as order_id,
      d.id as destination_id,
      COALESCE((NULLIF(value->>'quantity', ''))::NUMERIC, 0) as allocated_quantity
    FROM jsonb_array_elements(p_allocations) AS value
    JOIN orders o ON o.item_name = (value->>'item_name')::TEXT 
      AND o.week_date = CURRENT_DATE
    JOIN destinations d ON d.code = (value->>'destination_code')::TEXT
  )
  INSERT INTO allocations (order_id, destination_id, allocated_quantity)
  SELECT order_id, destination_id, allocated_quantity
  FROM allocation_data;
  
  GET DIAGNOSTICS allocation_count = ROW_COUNT;
  
  RETURN QUERY SELECT order_count, allocation_count;
END;
$$ LANGUAGE plpgsql;
