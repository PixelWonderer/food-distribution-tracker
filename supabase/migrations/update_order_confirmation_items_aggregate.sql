-- Aggregate confirmation data across all allocations for each order
CREATE OR REPLACE FUNCTION get_order_confirmation_items()
RETURNS TABLE(
  order_id UUID,
  item_name TEXT,
  expected_quantity NUMERIC,
  received_quantity NUMERIC,
  is_confirmed BOOLEAN,
  ran_out BOOLEAN,
  unit TEXT,
  storage_type TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  allocation_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id AS order_id,
    o.item_name,
    COALESCE(o.quantity, SUM(a.allocated_quantity)) AS expected_quantity,
    CASE
      WHEN COUNT(a.received_quantity) FILTER (WHERE a.received_quantity IS NOT NULL) = 0 THEN NULL
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_order_confirmation_items IS
  'Returns order confirmation data with totals aggregated across allocations.';
