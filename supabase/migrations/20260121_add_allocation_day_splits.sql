-- Migration: Add allocation_day_splits table for Partner Group 6 day-splitting feature
-- This allows splitting item quantities across Friday, Saturday, and Sunday
-- for more flexible distribution scheduling

-- Create the day splits table
CREATE TABLE IF NOT EXISTS allocation_day_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  target_day TEXT NOT NULL CHECK (target_day IN ('Friday', 'Saturday', 'Sunday')),
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity >= 0),
  split_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(allocation_id, target_day)
);

-- Index for fast lookups by allocation
CREATE INDEX IF NOT EXISTS idx_allocation_day_splits_allocation_id
  ON allocation_day_splits(allocation_id);

-- Enable RLS
ALTER TABLE allocation_day_splits ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (same as other tables in this app)
CREATE POLICY "Allow anonymous access to allocation_day_splits"
  ON allocation_day_splits
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_allocation_day_splits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_allocation_day_splits_updated_at
  BEFORE UPDATE ON allocation_day_splits
  FOR EACH ROW
  EXECUTE FUNCTION update_allocation_day_splits_updated_at();

-- RPC function to set day splits for an allocation
-- Validates that split quantities sum to the allocation total
CREATE OR REPLACE FUNCTION set_allocation_day_splits(
  p_allocation_id UUID,
  p_splits JSONB,  -- Array of {day: string, quantity: number}
  p_split_by TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_total NUMERIC;
  v_alloc_qty NUMERIC;
  v_split JSONB;
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
      INSERT INTO allocation_day_splits (allocation_id, target_day, quantity, split_by)
      VALUES (
        p_allocation_id,
        v_split->>'day',
        (v_split->>'quantity')::NUMERIC,
        p_split_by
      );
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- RPC function to get allocations with their splits for a destination
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
      (SELECT jsonb_agg(jsonb_build_object('day', s.target_day, 'quantity', s.quantity))
       FROM allocation_day_splits s WHERE s.allocation_id = a.id),
      '[]'::jsonb
    ) as splits
  FROM allocations a
  JOIN orders o ON o.id = a.order_id
  WHERE a.destination_id = p_destination_id
    AND a.allocated_quantity > 0;
END;
$$ LANGUAGE plpgsql;

-- RPC function to clear all splits for an allocation
CREATE OR REPLACE FUNCTION clear_allocation_day_splits(
  p_allocation_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM allocation_day_splits WHERE allocation_id = p_allocation_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE allocation_day_splits IS 'Stores day-specific quantity splits for allocations, primarily for Partner Group 6 distribution across Friday/Saturday/Sunday';
