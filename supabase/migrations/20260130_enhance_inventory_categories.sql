-- Migration: Enhance Inventory with Categories and Attribution
-- Description: Adds subcategories, destination attribution, take_inventory_item RPC, and seeds common pantry items
-- Date: 2026-01-30

-- ============================================
-- 1. Add subcategory column to inventory_items
-- ============================================

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS subcategory TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_items_subcategory
  ON inventory_items(subcategory) WHERE is_active = true;

COMMENT ON COLUMN inventory_items.subcategory IS 'Pantry subcategory: Beans & Legumes, Grains & Pasta, Canned Goods, Condiments & Sauces, Protein, Snacks & Other';

-- ============================================
-- 2. Add destination attribution to inventory_history
-- ============================================

ALTER TABLE inventory_history
  ADD COLUMN IF NOT EXISTS destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_name TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_history_destination
  ON inventory_history(destination_id) WHERE destination_id IS NOT NULL;

COMMENT ON COLUMN inventory_history.destination_id IS 'Destination/group that took this item (optional)';
COMMENT ON COLUMN inventory_history.destination_name IS 'Display name of destination or Community member name';

-- ============================================
-- 3. Create RPC function: take_inventory_item
-- ============================================

CREATE OR REPLACE FUNCTION take_inventory_item(
  p_item_id UUID,
  p_quantity NUMERIC,
  p_destination_id UUID DEFAULT NULL,
  p_destination_name TEXT DEFAULT NULL,
  p_taken_by TEXT DEFAULT 'Volunteer'
)
RETURNS inventory_items AS $$
DECLARE
  v_item inventory_items;
  v_previous_qty NUMERIC;
  v_change_reason TEXT;
BEGIN
  -- Get current quantity
  SELECT current_quantity INTO v_previous_qty
  FROM inventory_items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found: %', p_item_id;
  END IF;

  -- Ensure we don't take more than available
  IF p_quantity > v_previous_qty THEN
    p_quantity := v_previous_qty;
  END IF;

  -- Update inventory (subtract quantity)
  UPDATE inventory_items SET
    current_quantity = GREATEST(0, current_quantity - p_quantity),
    last_updated_at = now(),
    last_updated_by = p_taken_by
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  -- Build change reason
  IF p_destination_name IS NOT NULL THEN
    v_change_reason := 'Taken by ' || p_destination_name;
  ELSE
    v_change_reason := 'Taken by ' || p_taken_by;
  END IF;

  -- Record history with attribution
  INSERT INTO inventory_history (
    inventory_item_id, previous_quantity, new_quantity,
    change_type, change_reason, changed_by,
    destination_id, destination_name
  )
  VALUES (
    p_item_id, v_previous_qty, v_item.current_quantity,
    'adjustment', v_change_reason, p_taken_by,
    p_destination_id, p_destination_name
  );

  -- Auto-manage suggestions based on threshold
  IF v_item.current_quantity <= v_item.low_stock_threshold THEN
    INSERT INTO order_suggestions (inventory_item_id, suggested_quantity, reason, added_by)
    VALUES (v_item.id, v_item.low_stock_threshold * 2, 'low_stock', 'system')
    ON CONFLICT (inventory_item_id) WHERE is_fulfilled = false DO NOTHING;
  END IF;

  RETURN v_item;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION take_inventory_item IS
  'Subtracts quantity from inventory with destination/member attribution for tracking';

-- ============================================
-- 4. Update inventory_items_view to include subcategory
-- ============================================

CREATE OR REPLACE VIEW inventory_items_view AS
SELECT
  i.*,
  COALESCE(i.custom_name, o.item_name) as item_name,
  i.current_quantity <= i.low_stock_threshold as is_low_stock,
  EXISTS (
    SELECT 1 FROM order_suggestions s
    WHERE s.inventory_item_id = i.id AND s.is_fulfilled = false
  ) as has_pending_suggestion
FROM inventory_items i
LEFT JOIN orders o ON o.id = i.order_id
WHERE i.is_active = true;

COMMENT ON VIEW inventory_items_view IS
  'Inventory items with computed fields including subcategory, item_name, and is_low_stock';

-- ============================================
-- 5. Seed common pantry items (24 items from order analysis)
-- ============================================

-- Beans & Legumes (6 items)
INSERT INTO inventory_items (custom_name, current_quantity, unit_of_measure, category, subcategory, low_stock_threshold, emoji, is_active)
VALUES
  ('Pinto Beans, 24/1lb', 0, 'Case', 'Pantry', 'Beans & Legumes', 2, '🫘', true),
  ('Garbanzo Beans, 24/1lb', 0, 'Case', 'Pantry', 'Beans & Legumes', 2, '🫘', true),
  ('Kidney Beans, 24/1lb', 0, 'Case', 'Pantry', 'Beans & Legumes', 2, '🫘', true),
  ('Black Beans, 24/1lb', 0, 'Case', 'Pantry', 'Beans & Legumes', 2, '🫘', true),
  ('Black Eyed Peas, 24/1lb', 0, 'Case', 'Pantry', 'Beans & Legumes', 2, '🫛', true),
  ('Lentils, 24/1lb', 0, 'Case', 'Pantry', 'Beans & Legumes', 2, '🫘', true)
ON CONFLICT DO NOTHING;

-- Grains & Pasta (5 items)
INSERT INTO inventory_items (custom_name, current_quantity, unit_of_measure, category, subcategory, low_stock_threshold, emoji, is_active)
VALUES
  ('White Rice, 20/1lb', 0, 'Case', 'Pantry', 'Grains & Pasta', 2, '🍚', true),
  ('Quick Oats, 12/18oz', 0, 'Case', 'Pantry', 'Grains & Pasta', 2, '🌾', true),
  ('Spaghetti, 20/1lb', 0, 'Case', 'Pantry', 'Grains & Pasta', 2, '🍝', true),
  ('Fideo Pasta, 20/1lb', 0, 'Case', 'Pantry', 'Grains & Pasta', 2, '🍝', true),
  ('Flour, Masa Harina, 10/1.8lb', 0, 'Case', 'Pantry', 'Grains & Pasta', 2, '🌾', true)
ON CONFLICT DO NOTHING;

-- Canned Goods (5 items)
INSERT INTO inventory_items (custom_name, current_quantity, unit_of_measure, category, subcategory, low_stock_threshold, emoji, is_active)
VALUES
  ('Pasta Sauce, 24/15oz', 0, 'Case', 'Pantry', 'Canned Goods', 2, '🥫', true),
  ('Hominy, 12/25oz', 0, 'Case', 'Pantry', 'Canned Goods', 2, '🥫', true),
  ('Tomato Sauce, 12/15oz', 0, 'Case', 'Pantry', 'Canned Goods', 2, '🥫', true),
  ('Canned Corn, 24/15oz', 0, 'Case', 'Pantry', 'Canned Goods', 2, '🌽', true),
  ('EZO Assorted Soup, 6/14.5oz', 0, 'Case', 'Pantry', 'Canned Goods', 2, '🍲', true)
ON CONFLICT DO NOTHING;

-- Condiments & Sauces (3 items)
INSERT INTO inventory_items (custom_name, current_quantity, unit_of_measure, category, subcategory, low_stock_threshold, emoji, is_active)
VALUES
  ('Sriracha Hot Sauce, 12/28oz', 0, 'Case', 'Pantry', 'Condiments & Sauces', 2, '🌶️', true),
  ('Peanut Butter, 12/16oz', 0, 'Case', 'Pantry', 'Condiments & Sauces', 2, '🥜', true),
  ('Garlic Chili Sauce, 12/14oz', 0, 'Case', 'Pantry', 'Condiments & Sauces', 2, '🌶️', true)
ON CONFLICT DO NOTHING;

-- Protein (2 items)
INSERT INTO inventory_items (custom_name, current_quantity, unit_of_measure, category, subcategory, low_stock_threshold, emoji, is_active)
VALUES
  ('Sardines, 24/4.4oz', 0, 'Case', 'Pantry', 'Protein', 2, '🐟', true),
  ('Tuna, 48/5oz', 0, 'Case', 'Pantry', 'Protein', 2, '🐟', true)
ON CONFLICT DO NOTHING;

-- Snacks & Other (3 items)
INSERT INTO inventory_items (custom_name, current_quantity, unit_of_measure, category, subcategory, low_stock_threshold, emoji, is_active)
VALUES
  ('Recovered Candy, 35lb', 0, 'Case', 'Pantry', 'Snacks & Other', 2, '🍬', true),
  ('Applesauce, 24/3.2oz', 0, 'Case', 'Pantry', 'Snacks & Other', 2, '🍎', true),
  ('Energy Stroopwafel, 16/1.1oz', 0, 'Case', 'Pantry', 'Snacks & Other', 2, '🧇', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. Backfill subcategory for existing items
-- ============================================

-- Beans & Legumes
UPDATE inventory_items SET subcategory = 'Beans & Legumes'
WHERE subcategory IS NULL
  AND (
    LOWER(COALESCE(custom_name, '')) LIKE '%bean%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%pea%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%lentil%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%garbanzo%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%chickpea%'
  );

-- Grains & Pasta
UPDATE inventory_items SET subcategory = 'Grains & Pasta'
WHERE subcategory IS NULL
  AND (
    LOWER(COALESCE(custom_name, '')) LIKE '%rice%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%oat%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%pasta%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%spaghetti%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%fideo%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%flour%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%masa%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%elbow%'
  );

-- Canned Goods
UPDATE inventory_items SET subcategory = 'Canned Goods'
WHERE subcategory IS NULL
  AND (
    LOWER(COALESCE(custom_name, '')) LIKE '%sauce%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%tomato%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%soup%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%canned%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%hominy%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%corn%'
  );

-- Condiments & Sauces (be more specific to avoid overlap with Canned Goods)
UPDATE inventory_items SET subcategory = 'Condiments & Sauces'
WHERE subcategory IS NULL
  AND (
    LOWER(COALESCE(custom_name, '')) LIKE '%sriracha%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%peanut butter%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%chili sauce%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%hot sauce%'
  );

-- Protein
UPDATE inventory_items SET subcategory = 'Protein'
WHERE subcategory IS NULL
  AND (
    LOWER(COALESCE(custom_name, '')) LIKE '%tuna%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%sardine%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%fish%'
    OR LOWER(COALESCE(custom_name, '')) LIKE '%chicken%'
  );

-- Default remaining Pantry items to Snacks & Other
UPDATE inventory_items SET subcategory = 'Snacks & Other'
WHERE subcategory IS NULL
  AND LOWER(COALESCE(category, '')) = 'pantry';

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Inventory Categories Enhancement migration completed';
  RAISE NOTICE '   - Added subcategory column to inventory_items';
  RAISE NOTICE '   - Added destination attribution to inventory_history';
  RAISE NOTICE '   - Created take_inventory_item RPC function';
  RAISE NOTICE '   - Seeded 24 common pantry items';
  RAISE NOTICE '   - Backfilled subcategory for existing items';
END $$;
