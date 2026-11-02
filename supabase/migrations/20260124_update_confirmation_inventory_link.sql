-- Migration: Update confirmation RPCs to update linked inventory
-- Description: When items run low or out, automatically update linked inventory quantities
-- Date: 2026-01-24

-- ============================================
-- 1. Update update_allocations_proportionally to reduce linked inventory
-- This is called when an item "Ran Low"
-- ============================================

CREATE OR REPLACE FUNCTION update_allocations_proportionally(
  p_order_id UUID,
  p_received_quantity NUMERIC,
  p_confirmed_by TEXT DEFAULT NULL
)
RETURNS TABLE(
  allocation_id UUID,
  destination_code TEXT,
  original_qty NUMERIC,
  new_qty NUMERIC
) AS $$
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
  -- NEW: Variables for inventory update
  v_reduction NUMERIC;
  v_inv_id UUID;
  v_prev_qty NUMERIC;
  v_week_date DATE;
BEGIN
  -- Get original order quantity and week date
  SELECT quantity, week_date INTO v_original_qty, v_week_date
  FROM orders
  WHERE id = p_order_id;

  IF v_original_qty IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Handle edge case: original quantity is 0
  IF v_original_qty = 0 THEN
    RAISE EXCEPTION 'Cannot update allocations for order with 0 quantity';
  END IF;

  IF p_received_quantity < 0 THEN
    RAISE EXCEPTION 'Received quantity cannot be negative';
  END IF;

  -- Calculate ratio
  v_ratio := p_received_quantity / v_original_qty;

  -- Collect allocation data so we can distribute remainders fairly
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

  IF v_count = 0 THEN
    RETURN;
  END IF;

  -- Distribute remainder based on largest fractional remainders to keep totals accurate
  v_remainder := p_received_quantity - v_total_assigned;
  IF v_remainder < 0 THEN
    v_remainder := 0;
  END IF;

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

    -- No meaningful increment left, break to avoid infinite loop
    IF v_increment <= 1e-9 THEN
      EXIT;
    END IF;

    v_assigned[v_max_index] := v_assigned[v_max_index] + v_increment;
    -- Reduce the fraction so we rotate through ties in subsequent iterations
    v_fractions[v_max_index] := GREATEST(v_fractions[v_max_index] - v_increment, 0);
    v_remainder := GREATEST(v_remainder - v_increment, 0);
  END LOOP;

  -- If rounding left a tiny remainder, tack it onto the first allocation to preserve totals
  IF v_remainder > 0 THEN
    v_assigned[1] := v_assigned[1] + v_remainder;
    v_remainder := 0;
  END IF;

  -- Persist updates and return results
  FOR v_index IN 1..v_count LOOP
    UPDATE allocations
    SET
      received_quantity = ROUND(v_assigned[v_index], 4),
      is_confirmed = true,
      confirmed_at = TIMEZONE('utc', NOW()),
      confirmed_by = p_confirmed_by
    WHERE id = v_ids[v_index];

    allocation_id := v_ids[v_index];
    destination_code := v_codes[v_index];
    original_qty := v_originals[v_index];
    new_qty := v_assigned[v_index];
    RETURN NEXT;
  END LOOP;

  -- ============================================
  -- NEW: Update linked inventory item if exists
  -- ============================================
  v_reduction := v_original_qty - p_received_quantity;

  IF v_reduction > 0 THEN
    -- Get current inventory quantity for history
    SELECT id, current_quantity INTO v_inv_id, v_prev_qty
    FROM inventory_items
    WHERE order_id = p_order_id AND is_active = true;

    IF v_inv_id IS NOT NULL THEN
      -- Reduce inventory by the shortage amount
      UPDATE inventory_items
      SET current_quantity = GREATEST(0, current_quantity - v_reduction),
          last_updated_at = now(),
          last_updated_by = p_confirmed_by
      WHERE id = v_inv_id;

      -- Record history
      INSERT INTO inventory_history (
        inventory_item_id, previous_quantity, new_quantity,
        change_type, change_reason, changed_by, source_order_id, week_date
      )
      VALUES (
        v_inv_id, v_prev_qty, GREATEST(0, v_prev_qty - v_reduction),
        'adjustment', 'Ran low - reduced by ' || v_reduction, p_confirmed_by, p_order_id, v_week_date
      );

      RAISE NOTICE 'Reduced inventory for order % by % units (was: %, now: %)',
        p_order_id, v_reduction, v_prev_qty, GREATEST(0, v_prev_qty - v_reduction);
    END IF;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_allocations_proportionally IS
  'Updates all allocations for an order proportionally based on received quantity. Also reduces linked inventory by the shortage amount.';

-- ============================================
-- 2. Update mark_item_ran_out to zero linked inventory
-- ============================================

CREATE OR REPLACE FUNCTION mark_item_ran_out(
  p_order_id UUID,
  p_confirmed_by TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_inv_id UUID;
  v_prev_qty NUMERIC;
  v_week_date DATE;
BEGIN
  -- Get week date for history
  SELECT week_date INTO v_week_date FROM orders WHERE id = p_order_id;

  -- Set all allocations to 0
  UPDATE allocations
  SET
    received_quantity = 0,
    is_confirmed = true,
    confirmed_at = TIMEZONE('utc', NOW()),
    confirmed_by = p_confirmed_by
  WHERE order_id = p_order_id;

  -- Also mark the order as ran out
  UPDATE orders
  SET ran_out = true
  WHERE id = p_order_id;

  -- ============================================
  -- NEW: Zero linked inventory item if exists
  -- ============================================
  SELECT id, current_quantity INTO v_inv_id, v_prev_qty
  FROM inventory_items
  WHERE order_id = p_order_id AND is_active = true;

  IF v_inv_id IS NOT NULL AND v_prev_qty > 0 THEN
    UPDATE inventory_items
    SET current_quantity = 0,
        last_updated_at = now(),
        last_updated_by = p_confirmed_by
    WHERE id = v_inv_id;

    -- Record history
    INSERT INTO inventory_history (
      inventory_item_id, previous_quantity, new_quantity,
      change_type, change_reason, changed_by, source_order_id, week_date
    )
    VALUES (
      v_inv_id, v_prev_qty, 0,
      'adjustment', 'Ran out - zeroed inventory', p_confirmed_by, p_order_id, v_week_date
    );

    RAISE NOTICE 'Zeroed inventory for order % (was: %)', p_order_id, v_prev_qty;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_item_ran_out IS
  'Marks an item as completely unavailable (ran out) - sets all allocations to 0 and zeros linked inventory';

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== Confirmation Inventory Link Migration ===';
  RAISE NOTICE 'Updated update_allocations_proportionally to reduce linked inventory on Ran Low';
  RAISE NOTICE 'Updated mark_item_ran_out to zero linked inventory on Ran Out';
  RAISE NOTICE 'Both functions now record changes in inventory_history';
END $$;
