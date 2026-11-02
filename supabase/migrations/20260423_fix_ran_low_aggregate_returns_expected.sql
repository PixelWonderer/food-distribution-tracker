-- Fix ran-low items incorrectly returning o.quantity (expected) instead of SUM(received).
-- Previously, the function short-circuited to o.quantity when all allocations were
-- is_confirmed=true and ran_out=false — but ran-low also sets is_confirmed=true and
-- leaves ran_out=false, so ran-low items were reporting their expected total.
--
-- Fix: detect ran-low by checking SUM(received) < o.quantity *before* the "all
-- confirmed at expected" branch. This preserves existing behavior for split
-- items (Partner 11/Partner 10 additive allocations where SUM(received) > o.quantity).
CREATE OR REPLACE FUNCTION public.get_order_confirmation_items()
RETURNS TABLE(
  order_id uuid,
  item_name text,
  expected_quantity numeric,
  received_quantity numeric,
  is_confirmed boolean,
  ran_out boolean,
  unit text,
  storage_type text,
  confirmed_by text,
  confirmed_at timestamp with time zone,
  allocation_count integer
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS order_id,
    o.item_name,
    COALESCE(o.quantity, SUM(a.allocated_quantity)) AS expected_quantity,
    CASE
      WHEN COUNT(a.received_quantity) FILTER (WHERE a.received_quantity IS NOT NULL) = 0 THEN NULL
      -- Ran-low path: received total is less than the order's expected quantity.
      -- Report the actual proportional sum so the UI shows "ran low · N/M".
      WHEN SUM(a.received_quantity) < COALESCE(o.quantity, SUM(a.allocated_quantity))
           AND NOT COALESCE(o.ran_out, false) THEN SUM(a.received_quantity)
      -- All confirmed at expected (not ran-low, not ran-out): use the order
      -- quantity, not SUM. This keeps split items (Partner 11/Partner 10 additive) from
      -- spuriously showing over-received.
      WHEN BOOL_AND(COALESCE(a.is_confirmed, false)) AND NOT COALESCE(o.ran_out, false) THEN o.quantity
      ELSE SUM(a.received_quantity)
    END AS received_quantity,
    BOOL_AND(COALESCE(a.is_confirmed, false)) AS is_confirmed,
    COALESCE(o.ran_out, false) AS ran_out,
    o.unit,
    o.storage_type,
    (
      SELECT a2.confirmed_by
      FROM allocations a2
      WHERE a2.order_id = o.id AND a2.confirmed_by IS NOT NULL
      ORDER BY a2.confirmed_at DESC NULLS LAST, a2.created_at DESC
      LIMIT 1
    ) AS confirmed_by,
    (
      SELECT a2.confirmed_at
      FROM allocations a2
      WHERE a2.order_id = o.id AND a2.confirmed_at IS NOT NULL
      ORDER BY a2.confirmed_at DESC
      LIMIT 1
    ) AS confirmed_at,
    COUNT(*)::INTEGER AS allocation_count
  FROM orders o
  JOIN allocations a ON a.order_id = o.id
  GROUP BY o.id, o.item_name, o.quantity, o.ran_out, o.unit, o.storage_type
  ORDER BY o.item_name;
END;
$function$;

COMMENT ON FUNCTION get_order_confirmation_items IS
  'Returns order confirmation data. Ran-low items report SUM(received); expected items report o.quantity to avoid false over-received on split allocations.';
