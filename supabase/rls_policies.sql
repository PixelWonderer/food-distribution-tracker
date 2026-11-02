-- Row Level Security Policies for Food Tracker

-- Enable RLS on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;

-- For now, we'll create permissive policies for authenticated users
-- Later we can add more granular permissions based on user roles

-- Orders table policies
CREATE POLICY "Enable read access for all authenticated users" ON orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON orders
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON orders
  FOR DELETE USING (auth.role() = 'authenticated');

-- Destinations table policies (read-only for most users)
CREATE POLICY "Enable read access for all authenticated users" ON destinations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON destinations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON destinations
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Allocations table policies
CREATE POLICY "Enable read access for all authenticated users" ON allocations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON allocations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON allocations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON allocations
  FOR DELETE USING (auth.role() = 'authenticated');

-- Storage tracking policies
CREATE POLICY "Enable read access for all authenticated users" ON storage_tracking
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON storage_tracking
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON storage_tracking
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Distribution tracking policies
CREATE POLICY "Enable read access for all authenticated users" ON distribution_tracking
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON distribution_tracking
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON distribution_tracking
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Custom items policies
CREATE POLICY "Enable read access for all authenticated users" ON custom_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON custom_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON custom_items
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON custom_items
  FOR DELETE USING (auth.role() = 'authenticated');

-- Supplies policies
CREATE POLICY "Enable read access for all authenticated users" ON supplies
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON supplies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON supplies
  FOR UPDATE USING (auth.role() = 'authenticated');

-- For anonymous access (if needed for read-only operations)
-- Uncomment these policies if you want to allow anonymous read access

-- CREATE POLICY "Enable read access for anonymous users" ON orders
--   FOR SELECT USING (true);

-- CREATE POLICY "Enable read access for anonymous users" ON destinations
--   FOR SELECT USING (true);

-- CREATE POLICY "Enable read access for anonymous users" ON allocations
--   FOR SELECT USING (true);

-- CREATE POLICY "Enable read access for anonymous users" ON storage_tracking
--   FOR SELECT USING (true);

-- CREATE POLICY "Enable read access for anonymous users" ON distribution_tracking
--   FOR SELECT USING (true);