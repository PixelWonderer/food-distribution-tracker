-- Migration: link custom items to inventory, and the inventory "undo" helper
-- Must run after 20260121_add_inventory_tables.sql (needs inventory_items).

ALTER TABLE custom_items
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL;

COMMENT ON TABLE custom_items IS 'Custom items added by volunteers that are not from the Google Sheets import. These persist across imports.';

CREATE OR REPLACE FUNCTION increment_inventory_quantity(p_item_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE inventory_items
  SET current_quantity = current_quantity + p_amount,
      last_updated_at = NOW(),
      last_updated_by = 'system (undo)'
  WHERE id = p_item_id;
END;
$$;
