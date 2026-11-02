-- Add optimized function to get order confirmation items
-- This replaces the inefficient loop-based approach

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
  confirmed_at TIMESTAMP WITH TIME ZONE,
  allocation_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id as order_id,
    o.item_name,
    o.quantity as expected_quantity,
    -- Use the first allocation's received_quantity (they should all be proportional)
    (
      SELECT a2.received_quantity
      FROM allocations a2
      WHERE a2.order_id = o.id
      ORDER BY a2.created_at
      LIMIT 1
    ) as received_quantity,
    -- All allocations must be confirmed for the order to be considered confirmed
    (
      SELECT BOOL_AND(COALESCE(a2.is_confirmed, false))
      FROM allocations a2
      WHERE a2.order_id = o.id
    ) as is_confirmed,
    COALESCE(o.ran_out, false) as ran_out,
    o.unit,
    o.storage_type,
    -- Use the first allocation's confirmed_by
    (
      SELECT a2.confirmed_by
      FROM allocations a2
      WHERE a2.order_id = o.id
      ORDER BY a2.created_at
      LIMIT 1
    ) as confirmed_by,
    -- Use the first allocation's confirmed_at
    (
      SELECT a2.confirmed_at
      FROM allocations a2
      WHERE a2.order_id = o.id
      ORDER BY a2.created_at
      LIMIT 1
    ) as confirmed_at,
    (
      SELECT COUNT(*)::INTEGER
      FROM allocations a2
      WHERE a2.order_id = o.id
    ) as allocation_count
  FROM orders o
  WHERE EXISTS (
    SELECT 1 FROM allocations a WHERE a.order_id = o.id
  )
  ORDER BY o.item_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_order_confirmation_items IS
  'Returns all orders with their confirmation status in a single efficient query';
