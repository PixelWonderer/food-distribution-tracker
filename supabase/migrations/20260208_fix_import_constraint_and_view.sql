-- Fix BUG-1: Clear & Import fails with check_has_identifier constraint violation
--
-- Root cause: inventory_items.order_id FK has ON DELETE SET NULL.
-- When Clear & Import deletes orders, order_id becomes NULL.
-- If custom_name is also NULL, the CHECK constraint fires.
-- Since migration 20260123 added item_name as the stable identifier,
-- the constraint should accept item_name IS NOT NULL too.

-- 1. Drop old constraint and add updated one
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS check_has_identifier;

ALTER TABLE inventory_items ADD CONSTRAINT check_has_identifier
  CHECK (order_id IS NOT NULL OR custom_name IS NOT NULL OR item_name IS NOT NULL);

-- 2. Backfill any inventory items that still have NULL item_name
UPDATE inventory_items i
SET item_name = o.item_name
FROM orders o
WHERE i.order_id = o.id
  AND i.item_name IS NULL
  AND i.custom_name IS NULL;

-- 3. Fix inventory_items_view regression from migration 20260124
-- The 20260124 migration dropped i.item_name from the COALESCE chain
DROP VIEW IF EXISTS inventory_items_view;

CREATE VIEW inventory_items_view AS
SELECT
  i.id,
  i.order_id,
  i.custom_name,
  i.current_quantity,
  i.low_stock_threshold,
  i.unit_of_measure,
  i.category,
  i.storage_location,
  i.emoji,
  i.last_updated_at,
  i.last_updated_by,
  i.created_at,
  i.is_active,
  i.is_packed,
  COALESCE(i.custom_name, i.item_name, o.item_name) as item_name,
  i.current_quantity <= i.low_stock_threshold as is_low_stock,
  EXISTS (
    SELECT 1 FROM order_suggestions s
    WHERE s.inventory_item_id = i.id AND s.is_fulfilled = false
  ) as has_pending_suggestion
FROM inventory_items i
LEFT JOIN orders o ON o.id = i.order_id
WHERE i.is_active = true;

COMMENT ON VIEW inventory_items_view IS
  'Inventory items with computed fields. item_name prefers stored value over orders JOIN.';

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
