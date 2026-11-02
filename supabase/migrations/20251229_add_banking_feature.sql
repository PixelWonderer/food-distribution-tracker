-- Banking Feature: Bank items for next week
-- Run this in Supabase SQL Editor

-- 1. Create banked_items table
CREATE TABLE IF NOT EXISTS public.banked_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  banked_by TEXT,
  banked_at TIMESTAMPTZ DEFAULT NOW(),
  week_date TEXT NOT NULL,
  is_released BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_banked_items_destination ON banked_items(destination_id);
CREATE INDEX IF NOT EXISTS idx_banked_items_released ON banked_items(is_released);
CREATE INDEX IF NOT EXISTS idx_banked_items_week ON banked_items(week_date);

-- Enable RLS
ALTER TABLE banked_items ENABLE ROW LEVEL SECURITY;

-- Allow anon access (same as other tables in this app)
CREATE POLICY "Allow anon full access to banked_items" ON banked_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. Function to bank an item from a destination's allocation
CREATE OR REPLACE FUNCTION bank_item(
  p_allocation_id UUID,
  p_quantity NUMERIC,
  p_banked_by TEXT DEFAULT NULL
)
RETURNS TABLE (
  banked_item_id UUID,
  source_remaining NUMERIC,
  destination_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allocation RECORD;
  v_order RECORD;
  v_current_qty NUMERIC;
  v_week_date TEXT;
  v_banked_id UUID;
BEGIN
  -- Get allocation details
  SELECT a.*, d.id as dest_id, d.name as dest_name
  INTO v_allocation
  FROM allocations a
  JOIN destinations d ON d.id = a.destination_id
  WHERE a.id = p_allocation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;

  -- Get order details for week_date and item_name
  SELECT o.* INTO v_order
  FROM orders o WHERE o.id = v_allocation.order_id;

  v_current_qty := v_allocation.allocated_quantity;
  v_week_date := v_order.week_date::TEXT;

  -- Validate quantity
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF p_quantity > v_current_qty THEN
    RAISE EXCEPTION 'Cannot bank more than available (% available)', v_current_qty;
  END IF;

  -- Reduce allocation quantity
  UPDATE allocations
  SET allocated_quantity = allocated_quantity - p_quantity
  WHERE id = p_allocation_id;

  -- Create banked item record
  INSERT INTO banked_items (
    allocation_id,
    destination_id,
    order_id,
    item_name,
    quantity,
    banked_by,
    week_date
  ) VALUES (
    p_allocation_id,
    v_allocation.destination_id,
    v_allocation.order_id,
    v_order.item_name,
    p_quantity,
    p_banked_by,
    v_week_date
  )
  RETURNING id INTO v_banked_id;

  RETURN QUERY SELECT
    v_banked_id,
    v_current_qty - p_quantity,
    v_allocation.dest_name;
END;
$$;

-- 3. Function to get all unreleased banked items
CREATE OR REPLACE FUNCTION get_banked_items()
RETURNS TABLE (
  id UUID,
  destination_id UUID,
  destination_name TEXT,
  item_name TEXT,
  quantity NUMERIC,
  banked_by TEXT,
  banked_at TIMESTAMPTZ,
  week_date TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    bi.id,
    bi.destination_id,
    d.name as destination_name,
    bi.item_name,
    bi.quantity,
    bi.banked_by,
    bi.banked_at,
    bi.week_date
  FROM banked_items bi
  JOIN destinations d ON d.id = bi.destination_id
  WHERE bi.is_released = FALSE
  ORDER BY d.name, bi.item_name;
$$;

-- 4. Function to delete/cancel a banked item (restores allocation)
CREATE OR REPLACE FUNCTION delete_banked_item(
  p_banked_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_banked RECORD;
BEGIN
  -- Get the banked item
  SELECT * INTO v_banked
  FROM banked_items
  WHERE id = p_banked_item_id AND is_released = FALSE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Restore the quantity to the original allocation (if it still exists)
  UPDATE allocations
  SET allocated_quantity = allocated_quantity + v_banked.quantity
  WHERE id = v_banked.allocation_id;

  -- Delete the banked item
  DELETE FROM banked_items WHERE id = p_banked_item_id;

  RETURN TRUE;
END;
$$;

-- 5. Function to release banked items into new week allocations
-- Called during Clear & Import
CREATE OR REPLACE FUNCTION release_banked_items(
  p_new_week_date DATE
)
RETURNS TABLE (
  items_released INT,
  allocations_created INT,
  allocations_augmented INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_banked RECORD;
  v_new_order_id UUID;
  v_existing_alloc_id UUID;
  v_released_count INT := 0;
  v_created_count INT := 0;
  v_augmented_count INT := 0;
BEGIN
  -- Process each unreleased banked item
  FOR v_banked IN
    SELECT bi.*, d.code as dest_code
    FROM banked_items bi
    JOIN destinations d ON d.id = bi.destination_id
    WHERE bi.is_released = FALSE
  LOOP
    -- Find the new order for this item in the new week
    SELECT id INTO v_new_order_id
    FROM orders
    WHERE item_name = v_banked.item_name
      AND week_date = p_new_week_date
    LIMIT 1;

    -- If item doesn't exist in new week, create a new order for it
    IF v_new_order_id IS NULL THEN
      INSERT INTO orders (week_date, item_name, quantity, unit, storage_type)
      VALUES (p_new_week_date, v_banked.item_name, 0, NULL, NULL)
      RETURNING id INTO v_new_order_id;
    END IF;

    -- Check if allocation already exists for this destination
    SELECT id INTO v_existing_alloc_id
    FROM allocations
    WHERE order_id = v_new_order_id
      AND destination_id = v_banked.destination_id
    LIMIT 1;

    IF v_existing_alloc_id IS NOT NULL THEN
      -- Augment existing allocation
      UPDATE allocations
      SET allocated_quantity = allocated_quantity + v_banked.quantity
      WHERE id = v_existing_alloc_id;

      v_augmented_count := v_augmented_count + 1;
    ELSE
      -- Create new allocation
      INSERT INTO allocations (
        order_id,
        destination_id,
        allocated_quantity
      ) VALUES (
        v_new_order_id,
        v_banked.destination_id,
        v_banked.quantity
      );

      v_created_count := v_created_count + 1;
    END IF;

    -- Mark as released
    UPDATE banked_items
    SET is_released = TRUE,
        released_at = NOW()
    WHERE id = v_banked.id;

    v_released_count := v_released_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_released_count, v_created_count, v_augmented_count;
END;
$$;
