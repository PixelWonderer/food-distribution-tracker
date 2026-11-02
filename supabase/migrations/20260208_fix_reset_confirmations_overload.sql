-- Drop stale one-parameter overload of reset_confirmations
-- This caused PGRST203 (ambiguous function) when PostgREST couldn't decide
-- between reset_confirmations(date) and reset_confirmations(date, text)
DROP FUNCTION IF EXISTS reset_confirmations(date);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
