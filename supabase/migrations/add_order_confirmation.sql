-- Migration: Add Order Confirmation Support
-- Description: Adds columns to track confirmed received quantities and proportional allocation updates
-- Date: 2025-10-19

-- ============================================
-- 1. Add columns to allocations table
-- ============================================

ALTER TABLE allocations
ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(12,4),
ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmed_by TEXT;

-- Add comments for documentation
COMMENT ON COLUMN allocations.received_quantity IS 'Actual quantity received from Food Bank pickup (may differ from allocated_quantity if items ran low/out)';
COMMENT ON COLUMN allocations.is_confirmed IS 'Whether this allocation has been confirmed during order confirmation';
COMMENT ON COLUMN allocations.confirmed_at IS 'Timestamp when this allocation was confirmed';
COMMENT ON COLUMN allocations.confirmed_by IS 'Name of person who confirmed this allocation';

-- ============================================
-- 2. Create function to update allocations proportionally
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
BEGIN
  -- Get original order quantity
  SELECT quantity INTO v_original_qty
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

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION update_allocations_proportionally IS
  'Updates all allocations for an order proportionally based on received quantity. Handles rounding and remainder distribution.';

-- ============================================
-- 3. Create helper function to check if all items confirmed
-- ============================================

CREATE OR REPLACE FUNCTION get_confirmation_status(p_week_date DATE)
RETURNS TABLE(
  total_items BIGINT,
  confirmed_items BIGINT,
  all_confirmed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT o.id)::BIGINT as total_items,
    COUNT(DISTINCT CASE WHEN a.is_confirmed THEN o.id END)::BIGINT as confirmed_items,
    COUNT(DISTINCT o.id) = COUNT(DISTINCT CASE WHEN a.is_confirmed THEN o.id END) as all_confirmed
  FROM orders o
  LEFT JOIN allocations a ON a.order_id = o.id
  WHERE o.week_date = p_week_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_confirmation_status IS
  'Returns confirmation status for a given week: total items, confirmed items, and whether all are confirmed';

-- ============================================
-- 4. Create function to confirm item at expected quantity
-- ============================================

CREATE OR REPLACE FUNCTION confirm_item_at_expected(
  p_order_id UUID,
  p_confirmed_by TEXT DEFAULT NULL
)
RETURNS void AS $$
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
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION confirm_item_at_expected IS
  'Confirms an item at its full expected quantity (no shortages)';

-- ============================================
-- 5. Create function to mark item as ran out
-- ============================================

CREATE OR REPLACE FUNCTION mark_item_ran_out(
  p_order_id UUID,
  p_confirmed_by TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_item_ran_out IS
  'Marks an item as completely unavailable (ran out) - sets all allocations to 0';

-- ============================================
-- 6. Create function to confirm all items at expected quantity
-- ============================================

CREATE OR REPLACE FUNCTION confirm_all_items_at_expected(
  p_week_date DATE,
  p_confirmed_by TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_count BIGINT := 0;
  v_order RECORD;
BEGIN
  -- Confirm all unconfirmed items for this week
  FOR v_order IN
    SELECT DISTINCT o.id
    FROM orders o
    JOIN allocations a ON a.order_id = o.id
    WHERE o.week_date = p_week_date
      AND NOT COALESCE(a.is_confirmed, false)
  LOOP
    PERFORM confirm_item_at_expected(v_order.id, p_confirmed_by);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION confirm_all_items_at_expected IS
  'Confirms all unconfirmed items for a week at their expected quantities';

-- ============================================
-- 7. Backfill existing data
-- ============================================

-- For existing allocations without confirmation data,
-- set received_quantity = allocated_quantity and mark as confirmed
UPDATE allocations
SET
  received_quantity = allocated_quantity,
  is_confirmed = true,
  confirmed_at = created_at,
  confirmed_by = 'System Migration'
WHERE received_quantity IS NULL;

-- ============================================
-- 8. Create index for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_allocations_is_confirmed ON allocations(is_confirmed);
CREATE INDEX IF NOT EXISTS idx_allocations_order_confirmed ON allocations(order_id, is_confirmed);

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Order Confirmation migration completed successfully';
  RAISE NOTICE '   - Added 4 columns to allocations table';
  RAISE NOTICE '   - Created 6 helper functions';
  RAISE NOTICE '   - Backfilled existing data';
  RAISE NOTICE '   - Added performance indexes';
END $$;
