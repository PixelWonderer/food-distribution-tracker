-- Migration: Partner Distribution - Add Partner 11 & Partner 10 destinations and expand day splits
-- This allows splitting Partner Group 6's allocation to Partner 11 (Monday AM) and Partner 10 (Friday AM)

-- Add Partner 11 and Partner 10 destinations
-- is_custom = true ensures their allocations appear in pickup tabs
INSERT INTO destinations (code, name, timing, is_direct, display_order, is_active, is_custom)
VALUES
  ('partner_10', 'Partner 10', 'Friday AM', true, 15, true, true),
  ('partner_11', 'Partner 11', 'Monday AM', false, 16, true, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  timing = EXCLUDED.timing,
  is_direct = EXCLUDED.is_direct,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  is_custom = EXCLUDED.is_custom;

-- Expand allocation_day_splits table to support new recipients

-- 1. Rename target_day to recipient for clarity
ALTER TABLE allocation_day_splits
  RENAME COLUMN target_day TO recipient;

-- 2. Drop the old CHECK constraint
ALTER TABLE allocation_day_splits
  DROP CONSTRAINT IF EXISTS allocation_day_splits_target_day_check;

-- 3. Add expanded CHECK constraint for recipient values
ALTER TABLE allocation_day_splits
  ADD CONSTRAINT allocation_day_splits_recipient_check
  CHECK (recipient IN ('Friday', 'Saturday', 'Sunday', 'Partner 11', 'Partner 10'));

-- 4. Add recipient_type column to distinguish days vs destinations
ALTER TABLE allocation_day_splits
  ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'day'
  CHECK (recipient_type IN ('day', 'destination'));

-- 5. Update existing rows to have recipient_type = 'day'
UPDATE allocation_day_splits SET recipient_type = 'day' WHERE recipient_type IS NULL;

-- 6. Add destination_id column for when recipient is a destination
-- This links to the actual destination for allocation sync
ALTER TABLE allocation_day_splits
  ADD COLUMN IF NOT EXISTS recipient_destination_id UUID REFERENCES destinations(id);

-- 7. Drop and recreate unique constraint to use new column name
ALTER TABLE allocation_day_splits
  DROP CONSTRAINT IF EXISTS allocation_day_splits_allocation_id_target_day_key;

ALTER TABLE allocation_day_splits
  ADD CONSTRAINT allocation_day_splits_allocation_id_recipient_key
  UNIQUE (allocation_id, recipient);

-- Update RPC functions for new schema

-- Updated function to set day splits (now supports recipients)
CREATE OR REPLACE FUNCTION set_allocation_day_splits(
  p_allocation_id UUID,
  p_splits JSONB,  -- Array of {recipient: string, quantity: number, recipientType?: string}
  p_split_by TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_total NUMERIC;
  v_alloc_qty NUMERIC;
  v_split JSONB;
  v_recipient_type TEXT;
  v_dest_id UUID;
BEGIN
  -- Get allocation quantity
  SELECT allocated_quantity INTO v_alloc_qty
  FROM allocations WHERE id = p_allocation_id;

  IF v_alloc_qty IS NULL THEN
    RAISE EXCEPTION 'Allocation not found';
  END IF;

  -- Calculate split total
  SELECT COALESCE(SUM((s->>'quantity')::NUMERIC), 0) INTO v_total
  FROM jsonb_array_elements(p_splits) s;

  -- Validate sum equals allocation
  IF v_total != v_alloc_qty THEN
    RAISE EXCEPTION 'Split total (%) must equal allocation quantity (%)', v_total, v_alloc_qty;
  END IF;

  -- Clear existing splits
  DELETE FROM allocation_day_splits WHERE allocation_id = p_allocation_id;

  -- Insert new splits (only non-zero quantities)
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    IF (v_split->>'quantity')::NUMERIC > 0 THEN
      -- Determine recipient type from the recipient value
      v_recipient_type := COALESCE(
        v_split->>'recipientType',
        CASE
          WHEN (v_split->>'recipient') IN ('Friday', 'Saturday', 'Sunday') THEN 'day'
          ELSE 'destination'
        END
      );

      -- Look up destination ID for destination recipients
      v_dest_id := NULL;
      IF v_recipient_type = 'destination' THEN
        SELECT id INTO v_dest_id FROM destinations
        WHERE LOWER(name) = LOWER(v_split->>'recipient') OR LOWER(code) = LOWER(v_split->>'recipient');
      END IF;

      INSERT INTO allocation_day_splits (allocation_id, recipient, quantity, split_by, recipient_type, recipient_destination_id)
      VALUES (
        p_allocation_id,
        v_split->>'recipient',
        (v_split->>'quantity')::NUMERIC,
        p_split_by,
        v_recipient_type,
        v_dest_id
      );
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Updated function to get allocations with their splits
CREATE OR REPLACE FUNCTION get_destination_allocations_with_splits(
  p_destination_id UUID
)
RETURNS TABLE (
  allocation_id UUID,
  order_id UUID,
  item_name TEXT,
  emoji TEXT,
  total_quantity NUMERIC,
  storage_type TEXT,
  unit TEXT,
  splits JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id as allocation_id,
    a.order_id,
    o.item_name,
    o.emoji,
    a.allocated_quantity as total_quantity,
    o.storage_type,
    o.unit,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'recipient', s.recipient,
        'quantity', s.quantity,
        'recipientType', s.recipient_type,
        'destinationId', s.recipient_destination_id
      ))
       FROM allocation_day_splits s WHERE s.allocation_id = a.id),
      '[]'::jsonb
    ) as splits
  FROM allocations a
  JOIN orders o ON o.id = a.order_id
  WHERE a.destination_id = p_destination_id
    AND a.allocated_quantity > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to sync splits to destination allocations
-- This creates/updates allocations for Partner 11/Partner 10 when items are split to them
CREATE OR REPLACE FUNCTION sync_splits_to_destination_allocations(
  p_allocation_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_split RECORD;
  v_order_id UUID;
  v_dest_id UUID;
BEGIN
  -- Get the order_id from the source allocation
  SELECT order_id INTO v_order_id FROM allocations WHERE id = p_allocation_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Source allocation not found';
  END IF;

  -- Process each destination split
  FOR v_split IN
    SELECT recipient, quantity, recipient_destination_id
    FROM allocation_day_splits
    WHERE allocation_id = p_allocation_id
      AND recipient_type = 'destination'
      AND recipient_destination_id IS NOT NULL
  LOOP
    -- Upsert allocation for the destination
    INSERT INTO allocations (order_id, destination_id, allocated_quantity)
    VALUES (v_order_id, v_split.recipient_destination_id, v_split.quantity)
    ON CONFLICT (order_id, destination_id) DO UPDATE
    SET allocated_quantity = EXCLUDED.allocated_quantity,
        updated_at = now();
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update comments
COMMENT ON TABLE allocation_day_splits IS 'Stores recipient-specific quantity splits for allocations. Recipients can be days (Friday/Saturday/Sunday for Partner Group 6 internal scheduling) or destinations (Partner 11/Partner 10 for partner distribution).';
COMMENT ON COLUMN allocation_day_splits.recipient IS 'The recipient: a day (Friday, Saturday, Sunday) or a destination name (Partner 11, Partner 10)';
COMMENT ON COLUMN allocation_day_splits.recipient_type IS 'Type of recipient: day (Partner Group 6 internal) or destination (creates separate allocation)';
COMMENT ON COLUMN allocation_day_splits.recipient_destination_id IS 'Foreign key to destinations table when recipient_type is destination';
