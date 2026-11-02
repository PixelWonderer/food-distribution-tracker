-- Migration: Fix inventory subcategory and emoji backfill
-- Description: Previous migration only checked custom_name, missing order-linked items where name comes from orders table
-- Date: 2026-01-31

-- ============================================
-- 1. Backfill subcategory using actual item name
--    (either custom_name OR order.item_name)
-- ============================================

-- First, create a temp table with resolved item names
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.subcategory IS NULL
)
-- Beans & Legumes - check specific patterns first
UPDATE inventory_items inv
SET subcategory = 'Beans & Legumes'
FROM item_names n
WHERE inv.id = n.id
  AND (
    n.item_name LIKE '%black eyed pea%'
    OR n.item_name LIKE '%bean%'
    OR n.item_name LIKE '%lentil%'
    OR n.item_name LIKE '%garbanzo%'
    OR n.item_name LIKE '%chickpea%'
  );

-- Grains & Pasta
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.subcategory IS NULL
)
UPDATE inventory_items inv
SET subcategory = 'Grains & Pasta'
FROM item_names n
WHERE inv.id = n.id
  AND (
    n.item_name LIKE '%rice%'
    OR n.item_name LIKE '%oat%'
    OR n.item_name LIKE '%pasta%'
    OR n.item_name LIKE '%spaghetti%'
    OR n.item_name LIKE '%fideo%'
    OR n.item_name LIKE '%flour%'
    OR n.item_name LIKE '%masa%'
    OR n.item_name LIKE '%elbow%'
    OR n.item_name LIKE '%noodle%'
    OR n.item_name LIKE '%macaroni%'
    OR n.item_name LIKE '%quinoa%'
  );

-- Canned Goods
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.subcategory IS NULL
)
UPDATE inventory_items inv
SET subcategory = 'Canned Goods'
FROM item_names n
WHERE inv.id = n.id
  AND (
    n.item_name LIKE '%soup%'
    OR n.item_name LIKE '%tomato%'
    OR n.item_name LIKE '%canned%'
    OR n.item_name LIKE '%hominy%'
    OR n.item_name LIKE '%corn%'
  );

-- Condiments & Sauces (check BEFORE "Canned Goods" patterns that include "sauce")
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.subcategory IS NULL
)
UPDATE inventory_items inv
SET subcategory = 'Condiments & Sauces'
FROM item_names n
WHERE inv.id = n.id
  AND (
    n.item_name LIKE '%peanut butter%'
    OR n.item_name LIKE '%sriracha%'
    OR n.item_name LIKE '%hot sauce%'
    OR n.item_name LIKE '%chili sauce%'
    OR n.item_name LIKE '%ketchup%'
    OR n.item_name LIKE '%mustard%'
    OR n.item_name LIKE '%vinegar%'
    OR n.item_name LIKE '%salsa%'
    OR n.item_name LIKE '%dressing%'
  );

-- Snacks & Other - default for remaining NULL subcategories
UPDATE inventory_items
SET subcategory = 'Snacks & Other'
WHERE is_active = true
  AND subcategory IS NULL;

-- ============================================
-- 2. Fix emoji for items with default box emoji
-- ============================================

-- Update emojis based on item names (same CTE pattern)

-- Beans
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.emoji = '📦'
)
UPDATE inventory_items inv
SET emoji = '🫘'
FROM item_names n
WHERE inv.id = n.id
  AND (
    n.item_name LIKE '%bean%'
    OR n.item_name LIKE '%lentil%'
    OR n.item_name LIKE '%garbanzo%'
    OR n.item_name LIKE '%chickpea%'
    OR n.item_name LIKE '%black eyed pea%'
  );

-- Pasta/Grains
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.emoji = '📦'
)
UPDATE inventory_items inv
SET emoji = '🍝'
FROM item_names n
WHERE inv.id = n.id
  AND (
    n.item_name LIKE '%pasta%'
    OR n.item_name LIKE '%spaghetti%'
    OR n.item_name LIKE '%fideo%'
    OR n.item_name LIKE '%elbow%'
    OR n.item_name LIKE '%noodle%'
    OR n.item_name LIKE '%macaroni%'
  );

-- Rice
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.emoji = '📦'
)
UPDATE inventory_items inv
SET emoji = '🍚'
FROM item_names n
WHERE inv.id = n.id
  AND n.item_name LIKE '%rice%';

-- Soup
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.emoji = '📦'
)
UPDATE inventory_items inv
SET emoji = '🍲'
FROM item_names n
WHERE inv.id = n.id
  AND n.item_name LIKE '%soup%';

-- Coffee/Keurig
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.emoji = '📦'
)
UPDATE inventory_items inv
SET emoji = '☕'
FROM item_names n
WHERE inv.id = n.id
  AND (n.item_name LIKE '%coffee%' OR n.item_name LIKE '%keurig%');

-- Candy
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.emoji = '📦'
)
UPDATE inventory_items inv
SET emoji = '🍬'
FROM item_names n
WHERE inv.id = n.id
  AND n.item_name LIKE '%candy%';

-- Applesauce
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.emoji = '📦'
)
UPDATE inventory_items inv
SET emoji = '🍎'
FROM item_names n
WHERE inv.id = n.id
  AND n.item_name LIKE '%applesauce%';

-- Stroopwafel/Waffle
WITH item_names AS (
  SELECT
    i.id,
    LOWER(COALESCE(i.custom_name, o.item_name, '')) as item_name
  FROM inventory_items i
  LEFT JOIN orders o ON o.id = i.order_id
  WHERE i.is_active = true
    AND i.emoji = '📦'
)
UPDATE inventory_items inv
SET emoji = '🧇'
FROM item_names n
WHERE inv.id = n.id
  AND (n.item_name LIKE '%stroopwafel%' OR n.item_name LIKE '%waffle%');

-- ============================================
-- Migration Complete
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Inventory subcategory and emoji backfill fix completed';
  RAISE NOTICE '   - Backfilled subcategory using ACTUAL item names (custom_name OR orders.item_name)';
  RAISE NOTICE '   - Fixed emoji for items with default box emoji';
END $$;
