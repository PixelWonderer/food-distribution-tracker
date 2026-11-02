-- Fix BUG-7: Proportional rounding artifacts (±0.0002)
-- ROUND(v_assigned[i], 4) after remainder distribution can shift totals.
-- Add a post-ROUND correction: adjust largest allocation by the delta.
-- The corrected function body is the update_allocations_proportionally() definition in
-- add_order_confirmation.sql, so there is nothing further to apply here.

-- Key change: After ROUNDing all values, calculate v_delta = p_received_quantity - rounded_sum
-- and adjust the largest allocation by that delta to guarantee exact totals.
-- Only applies correction when |delta| < 0.01 (rounding artifact, not a logic error).
