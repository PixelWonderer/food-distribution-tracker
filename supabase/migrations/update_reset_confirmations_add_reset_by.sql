-- Capture who triggers a full confirmation reset and log audit info
CREATE TABLE IF NOT EXISTS order_confirmation_resets (
  id BIGSERIAL PRIMARY KEY,
  week_date DATE NOT NULL,
  reset_by TEXT,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

COMMENT ON TABLE order_confirmation_resets IS
  'Audit log of volunteers who reset all order confirmations for a week';

COMMENT ON COLUMN order_confirmation_resets.reset_by IS
  'Name provided by volunteer when resetting confirmations';

COMMENT ON COLUMN order_confirmation_resets.reset_at IS
  'Timestamp when the reset was requested (UTC)';

-- Allow reset_confirmations to accept volunteer name and record the event
CREATE OR REPLACE FUNCTION reset_confirmations(
  p_week_date DATE,
  p_reset_by TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Reset confirmation fields for allocations in this week
  UPDATE allocations
  SET
    received_quantity = NULL,
    is_confirmed = false,
    confirmed_at = NULL,
    confirmed_by = NULL
  WHERE order_id IN (
    SELECT id FROM orders WHERE week_date = p_week_date
  );

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  -- Clear ran_out flags on related orders
  UPDATE orders
  SET ran_out = false
  WHERE week_date = p_week_date AND ran_out = true;

  -- Record the reset event for auditing
  INSERT INTO order_confirmation_resets (week_date, reset_by)
  VALUES (p_week_date, p_reset_by);

  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_confirmations(date, text) IS
  'Resets order confirmations for a week and logs who initiated the reset';