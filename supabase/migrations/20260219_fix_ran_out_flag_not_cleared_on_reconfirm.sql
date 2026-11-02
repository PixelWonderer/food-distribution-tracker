-- Fix: confirm_item_at_expected and update_allocations_proportionally did not
-- clear orders.ran_out = false, so items marked "Ran Out" could not be changed
-- back to Expected or Ran Low — the button appeared to work but snapped back
-- after the next fetchData() refresh.

-- Fix confirm_item_at_expected (Ran Out → Expected)
CREATE OR REPLACE FUNCTION confirm_item_at_expected(
  p_order_id UUID,
  p_confirmed_by TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_expected_qty NUMERIC;
BEGIN
  -- Get expected quantity
  SELECT quantity INTO v_expected_qty
  FROM orders
  WHERE id = p_order_id;

  IF v_expected_qty IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Update allocations at full expected quantity
  UPDATE allocations
  SET
    received_quantity = allocated_quantity,
    is_confirmed = true,
    confirmed_at = TIMEZONE('utc', NOW()),
    confirmed_by = p_confirmed_by
  WHERE order_id = p_order_id;

  -- Clear ran_out flag so item can transition back from Ran Out to Expected
  UPDATE orders SET ran_out = false WHERE id = p_order_id;
END;
$$;

-- Fix update_allocations_proportionally (Ran Out → Ran Low)
CREATE OR REPLACE FUNCTION update_allocations_proportionally(
  p_order_id UUID,
  p_received_quantity NUMERIC,
  p_confirmed_by TEXT DEFAULT NULL
)
RETURNS TABLE(allocation_id UUID, destination_code TEXT, original_qty NUMERIC, new_qty NUMERIC)
LANGUAGE plpgsql AS $$
DECLARE
  v_original_qty NUMERIC;
  v_ratio NUMERIC;
  v_allocation RECORD;
  v_total_assigned NUMERIC := 0;
  v_remainder NUMERIC := 0;
  v_count INTEGER := 0;
  v_index INTEGER;
  v_max_index INTEGER;
  v_increment NUMERIC;
  v_current_scaled NUMERIC;
  v_base_qty NUMERIC;
  v_fraction NUMERIC;
  v_ids UUID[] := ARRAY[]::UUID[];
  v_codes TEXT[] := ARRAY[]::TEXT[];
  v_originals NUMERIC[] := ARRAY[]::NUMERIC[];
  v_assigned NUMERIC[] := ARRAY[]::NUMERIC[];
  v_fractions NUMERIC[] := ARRAY[]::NUMERIC[];
  v_reduction NUMERIC;
  v_inv_id UUID;
  v_prev_qty NUMERIC;
  v_week_date DATE;
  v_rounded NUMERIC[] := ARRAY[]::NUMERIC[];
  v_rounded_sum NUMERIC := 0;
  v_delta NUMERIC;
  v_largest_index INTEGER := 1;
BEGIN
  SELECT quantity, week_date INTO v_original_qty, v_week_date
  FROM orders WHERE id = p_order_id;

  IF v_original_qty IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_original_qty = 0 THEN
    RAISE EXCEPTION 'Cannot update allocations for order with 0 quantity';
  END IF;

  IF p_received_quantity < 0 THEN
    RAISE EXCEPTION 'Received quantity cannot be negative';
  END IF;

  -- Clear ran_out flag so item can transition back from Ran Out to Ran Low/Expected
  UPDATE orders SET ran_out = false WHERE id = p_order_id;

  v_ratio := p_received_quantity / v_original_qty;

  FOR v_allocation IN
    SELECT a.id, a.allocated_quantity, d.code
    FROM allocations a
    JOIN destinations d ON d.id = a.destination_id
    WHERE a.order_id = p_order_id
    ORDER BY d.display_order, a.created_at
  LOOP
    v_count := v_count + 1;
    v_current_scaled := v_allocation.allocated_quantity * v_ratio;
    v_base_qty := FLOOR(v_current_scaled);
    v_fraction := v_current_scaled - v_base_qty;

    v_ids := array_append(v_ids, v_allocation.id);
    v_codes := array_append(v_codes, v_allocation.code);
    v_originals := array_append(v_originals, v_allocation.allocated_quantity);
    v_assigned := array_append(v_assigned, v_base_qty);
    v_fractions := array_append(v_fractions, v_fraction);
    v_total_assigned := v_total_assigned + v_base_qty;
  END LOOP;

  IF v_count = 0 THEN RETURN; END IF;

  -- Distribute remainder using largest-fractional-remainder method
  v_remainder := p_received_quantity - v_total_assigned;
  IF v_remainder < 0 THEN v_remainder := 0; END IF;

  WHILE v_remainder > 0 LOOP
    v_max_index := 1;
    FOR v_index IN 2..v_count LOOP
      IF v_fractions[v_index] > v_fractions[v_max_index] + 1e-9 THEN
        v_max_index := v_index;
      ELSIF abs(v_fractions[v_index] - v_fractions[v_max_index]) <= 1e-9
            AND v_originals[v_index] > v_originals[v_max_index] THEN
        v_max_index := v_index;
      END IF;
    END LOOP;

    v_increment := LEAST(v_fractions[v_max_index], v_remainder);
    IF v_increment <= 1e-9 THEN EXIT; END IF;

    v_assigned[v_max_index] := v_assigned[v_max_index] + v_increment;
    v_fractions[v_max_index] := GREATEST(v_fractions[v_max_index] - v_increment, 0);
    v_remainder := GREATEST(v_remainder - v_increment, 0);
  END LOOP;

  IF v_remainder > 0 THEN
    v_assigned[1] := v_assigned[1] + v_remainder;
  END IF;

  -- ROUND each value and track the sum + find the largest allocation
  FOR v_index IN 1..v_count LOOP
    v_rounded := array_append(v_rounded, ROUND(v_assigned[v_index], 4));
    v_rounded_sum := v_rounded_sum + ROUND(v_assigned[v_index], 4);
    IF v_rounded[v_index] > v_rounded[v_largest_index] THEN
      v_largest_index := v_index;
    END IF;
  END LOOP;

  -- Correction pass: adjust largest allocation so sum equals exactly p_received_quantity
  v_delta := p_received_quantity - v_rounded_sum;
  IF abs(v_delta) > 0 AND abs(v_delta) < 0.01 THEN
    v_rounded[v_largest_index] := v_rounded[v_largest_index] + v_delta;
  END IF;

  -- Persist updates and return results
  FOR v_index IN 1..v_count LOOP
    UPDATE allocations
    SET received_quantity = v_rounded[v_index],
        is_confirmed = true,
        confirmed_at = TIMEZONE('utc', NOW()),
        confirmed_by = p_confirmed_by
    WHERE id = v_ids[v_index];

    allocation_id := v_ids[v_index];
    destination_code := v_codes[v_index];
    original_qty := v_originals[v_index];
    new_qty := v_rounded[v_index];
    RETURN NEXT;
  END LOOP;

  -- Update linked inventory item if exists
  v_reduction := v_original_qty - p_received_quantity;
  IF v_reduction > 0 THEN
    SELECT id, current_quantity INTO v_inv_id, v_prev_qty
    FROM inventory_items WHERE order_id = p_order_id AND is_active = true;

    IF v_inv_id IS NOT NULL THEN
      UPDATE inventory_items
      SET current_quantity = GREATEST(0, current_quantity - v_reduction),
          last_updated_at = now(),
          last_updated_by = p_confirmed_by
      WHERE id = v_inv_id;

      INSERT INTO inventory_history (
        inventory_item_id, previous_quantity, new_quantity,
        change_type, change_reason, changed_by, source_order_id, week_date
      ) VALUES (
        v_inv_id, v_prev_qty, GREATEST(0, v_prev_qty - v_reduction),
        'adjustment', 'Ran low - reduced by ' || v_reduction, p_confirmed_by, p_order_id, v_week_date
      );
    END IF;
  END IF;

  RETURN;
END;
$$;
