-- Migration: Fix add_inventory_from_order emoji reference
-- Date: 2026-01-29
-- Issue: Function referenced v_order.emoji but orders table doesn't have emoji column
-- Fix: Use hardcoded default emoji '📦' instead

CREATE OR REPLACE FUNCTION add_inventory_from_order(
  p_order_id UUID,
  p_quantity NUMERIC,
  p_updated_by TEXT DEFAULT 'system'
)
RETURNS inventory_items AS $$
DECLARE
  v_item inventory_items;
  v_order RECORD;
  v_previous_qty NUMERIC;
  v_week_date DATE;
  v_existing_id UUID;
BEGIN
  -- Get order details including item_name
  SELECT o.*, o.week_date as w_date, o.item_name as o_item_name
  INTO v_order
  FROM orders o WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  v_week_date := v_order.w_date;

  -- Check if an inventory item already exists for this item_name
  SELECT id, current_quantity
  INTO v_existing_id, v_previous_qty
  FROM inventory_items
  WHERE item_name = v_order.o_item_name
    AND is_active = true
    AND custom_name IS NULL;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing item: add quantity and update order_id reference
    UPDATE inventory_items SET
      current_quantity = current_quantity + p_quantity,
      order_id = p_order_id,
      last_updated_at = now(),
      last_updated_by = p_updated_by
    WHERE id = v_existing_id
    RETURNING * INTO v_item;
  ELSE
    -- Insert new inventory item (use default emoji since orders table doesn't have one)
    v_previous_qty := 0;
    INSERT INTO inventory_items (
      order_id, item_name, current_quantity, unit_of_measure, category,
      storage_location, emoji, last_updated_by
    )
    VALUES (
      p_order_id,
      v_order.o_item_name,
      p_quantity,
      COALESCE(v_order.unit, 'Case'),
      COALESCE(v_order.storage_type, 'Pantry'),
      COALESCE(v_order.storage_type, 'Pantry'),
      '📦',  -- Default emoji (orders table doesn't have emoji column)
      p_updated_by
    )
    RETURNING * INTO v_item;
  END IF;

  -- Record history
  INSERT INTO inventory_history (
    inventory_item_id, previous_quantity, new_quantity,
    change_type, changed_by, source_order_id, week_date
  )
  VALUES (
    v_item.id,
    COALESCE(v_previous_qty, 0),
    v_item.current_quantity,
    'order_import', p_updated_by, p_order_id, v_week_date
  );

  -- Check if low stock and create suggestion
  IF v_item.current_quantity <= v_item.low_stock_threshold THEN
    INSERT INTO order_suggestions (inventory_item_id, suggested_quantity, reason, added_by)
    VALUES (v_item.id, v_item.low_stock_threshold * 2, 'low_stock', 'system')
    ON CONFLICT (inventory_item_id) WHERE is_fulfilled = false DO NOTHING;
  END IF;

  RETURN v_item;
END;
$$ LANGUAGE plpgsql;
