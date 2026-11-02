-- Migration: redirections, schedule history, custom destinations
-- Backs the "Redirect" action (move part of an allocation to another destination),
-- timing edits, and app-created (custom) destinations. Idempotent.

CREATE TABLE IF NOT EXISTS redirections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  source_destination_id UUID NOT NULL REFERENCES destinations(id),
  target_destination_id UUID NOT NULL REFERENCES destinations(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  redirected_by TEXT,
  redirected_at TIMESTAMPTZ DEFAULT NOW(),
  week_date DATE NOT NULL,
  CHECK (source_destination_id <> target_destination_id)
);
COMMENT ON TABLE redirections IS 'Audit log of item redirections between destinations';
CREATE INDEX IF NOT EXISTS idx_redirections_allocation ON redirections(allocation_id);
CREATE INDEX IF NOT EXISTS idx_redirections_source ON redirections(source_destination_id);
CREATE INDEX IF NOT EXISTS idx_redirections_target ON redirections(target_destination_id);
CREATE INDEX IF NOT EXISTS idx_redirections_week_date ON redirections(week_date);

CREATE TABLE IF NOT EXISTS schedule_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  destination_name TEXT NOT NULL,
  previous_timing TEXT,
  new_timing TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  week_date DATE DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_schedule_history_changed_at ON schedule_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_history_destination ON schedule_history(destination_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_week ON schedule_history(week_date);

-- Redirect part (or all) of an allocation to another destination
CREATE OR REPLACE FUNCTION redirect_item(
  p_allocation_id UUID,
  p_target_destination_id UUID,
  p_quantity NUMERIC,
  p_redirected_by TEXT DEFAULT NULL
)
RETURNS TABLE(source_remaining NUMERIC, target_new_quantity NUMERIC, target_allocation_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_source_destination_id UUID;
  v_source_qty NUMERIC;
  v_week_date DATE;
  v_existing_target_id UUID;
  v_new_source_qty NUMERIC;
  v_target_qty NUMERIC;
  v_target_id UUID;
  v_is_stored BOOLEAN;
  v_is_full_redirect BOOLEAN;
BEGIN
  SELECT order_id, destination_id, allocated_quantity
  INTO v_order_id, v_source_destination_id, v_source_qty
  FROM allocations WHERE id = p_allocation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Allocation not found: %', p_allocation_id;
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;
  IF p_quantity > v_source_qty THEN
    RAISE EXCEPTION 'Cannot redirect more than available (requested: %, available: %)', p_quantity, v_source_qty;
  END IF;

  v_new_source_qty := v_source_qty - p_quantity;
  v_is_full_redirect := (v_new_source_qty < 0.01);

  SELECT week_date INTO v_week_date FROM orders WHERE id = v_order_id;
  SELECT COALESCE(st.is_stored, FALSE) INTO v_is_stored
  FROM storage_tracking st WHERE st.allocation_id = p_allocation_id;

  SELECT id INTO v_existing_target_id
  FROM allocations WHERE order_id = v_order_id AND destination_id = p_target_destination_id;

  IF v_existing_target_id IS NOT NULL THEN
    UPDATE allocations
    SET allocated_quantity = allocated_quantity + p_quantity, updated_at = NOW()
    WHERE id = v_existing_target_id
    RETURNING allocated_quantity, id INTO v_target_qty, v_target_id;
  ELSE
    INSERT INTO allocations (order_id, destination_id, allocated_quantity, is_confirmed, created_at, updated_at)
    VALUES (v_order_id, p_target_destination_id, p_quantity, TRUE, NOW(), NOW())
    RETURNING allocated_quantity, id INTO v_target_qty, v_target_id;

    INSERT INTO storage_tracking (allocation_id, is_stored, stored_at, stored_by)
    VALUES (v_target_id, COALESCE(v_is_stored, FALSE),
      CASE WHEN v_is_stored THEN NOW() ELSE NULL END,
      CASE WHEN v_is_stored THEN p_redirected_by ELSE NULL END);

    INSERT INTO distribution_tracking (allocation_id, is_distributed)
    VALUES (v_target_id, FALSE);
  END IF;

  -- Log the redirection before modifying the source
  INSERT INTO redirections (allocation_id, source_destination_id, target_destination_id, quantity, redirected_by, redirected_at, week_date)
  VALUES (p_allocation_id, v_source_destination_id, p_target_destination_id, p_quantity, p_redirected_by, NOW(), v_week_date);

  IF v_is_full_redirect THEN
    -- Keep a tiny positive quantity and mark the source distributed so it drops out of the UI
    UPDATE allocations SET allocated_quantity = 0.001, updated_at = NOW() WHERE id = p_allocation_id;

    UPDATE distribution_tracking
    SET is_distributed = TRUE, distributed_at = NOW(), distributed_by = p_redirected_by
    WHERE allocation_id = p_allocation_id;

    v_new_source_qty := 0;
  ELSE
    UPDATE allocations SET allocated_quantity = v_new_source_qty, updated_at = NOW() WHERE id = p_allocation_id;
  END IF;

  source_remaining := v_new_source_qty;
  target_new_quantity := v_target_qty;
  target_allocation_id := v_target_id;
  RETURN NEXT;
END;
$$;

-- Timing edits (archived in schedule_history)
CREATE OR REPLACE FUNCTION update_destination_timing(
  p_destination_id UUID,
  p_new_timing TEXT,
  p_changed_by TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_old_timing TEXT;
  v_dest_name TEXT;
BEGIN
  SELECT timing, name INTO v_old_timing, v_dest_name FROM destinations WHERE id = p_destination_id;

  IF v_old_timing IS DISTINCT FROM p_new_timing THEN
    INSERT INTO schedule_history (destination_id, destination_name, previous_timing, new_timing, changed_by)
    VALUES (p_destination_id, v_dest_name, v_old_timing, p_new_timing, p_changed_by);

    UPDATE destinations SET timing = p_new_timing, updated_at = TIMEZONE('utc', NOW()) WHERE id = p_destination_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reset_destination_timings()
RETURNS VOID AS $$
BEGIN
  UPDATE destinations SET timing = default_timing, updated_at = TIMEZONE('utc', NOW())
  WHERE default_timing IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Custom (app-created) destinations
CREATE OR REPLACE FUNCTION create_custom_destination(
  p_name TEXT,
  p_timing TEXT DEFAULT 'Unscheduled',
  p_is_direct BOOLEAN DEFAULT FALSE,
  p_created_by TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
  v_code TEXT;
  v_max_order INT;
BEGIN
  v_code := LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]', '', 'g'));

  IF EXISTS (SELECT 1 FROM destinations WHERE code = v_code) THEN
    v_code := v_code || '_' || EXTRACT(EPOCH FROM NOW())::INT;
  END IF;

  SELECT COALESCE(MAX(display_order), 0) + 1 INTO v_max_order FROM destinations;

  INSERT INTO destinations (code, name, short_name, timing, default_timing, is_direct, display_order,
                            sheet_column_index, is_custom, created_by, is_active)
  VALUES (v_code, p_name, p_name, p_timing, p_timing, p_is_direct, v_max_order, NULL, TRUE, p_created_by, TRUE)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION deactivate_custom_destination(p_destination_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_custom BOOLEAN;
BEGIN
  SELECT is_custom INTO v_is_custom FROM destinations WHERE id = p_destination_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination not found: %', p_destination_id;
  END IF;
  IF NOT v_is_custom THEN
    RAISE EXCEPTION 'Cannot deactivate non-custom destination';
  END IF;

  UPDATE destinations SET is_active = FALSE WHERE id = p_destination_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reactivate_custom_destination(p_destination_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE destinations SET is_active = TRUE WHERE id = p_destination_id AND is_custom = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom destination not found: %', p_destination_id;
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Undo a "ran out" mark
CREATE OR REPLACE FUNCTION unmark_item_ran_out(p_order_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE orders SET ran_out = false WHERE id = p_order_id;

  UPDATE allocations
  SET received_quantity = NULL, is_confirmed = false, confirmed_at = NULL, confirmed_by = NULL
  WHERE order_id = p_order_id;
END;
$$ LANGUAGE plpgsql;
