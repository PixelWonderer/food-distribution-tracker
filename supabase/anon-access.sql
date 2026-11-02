-- Enable anonymous access for testing
-- Run this after the main RLS policies

-- Allow anonymous users to read destinations
CREATE POLICY "Allow anon read destinations" ON destinations
  FOR SELECT USING (true);

-- Allow anonymous users to read orders
CREATE POLICY "Allow anon read orders" ON orders
  FOR SELECT USING (true);

-- Allow anonymous users to read allocations  
CREATE POLICY "Allow anon read allocations" ON allocations
  FOR SELECT USING (true);

-- Allow anonymous users to read tracking
CREATE POLICY "Allow anon read storage_tracking" ON storage_tracking
  FOR SELECT USING (true);

CREATE POLICY "Allow anon read distribution_tracking" ON distribution_tracking
  FOR SELECT USING (true);

-- Allow anonymous users to read custom items
CREATE POLICY "Allow anon read custom_items" ON custom_items
  FOR SELECT USING (true);

-- Allow anonymous users to read supplies
CREATE POLICY "Allow anon read supplies" ON supplies
  FOR SELECT USING (true);

-- For testing, also allow anonymous writes (remove in production)
CREATE POLICY "Allow anon insert orders" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update orders" ON orders
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon insert allocations" ON allocations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update allocations" ON allocations
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon insert storage_tracking" ON storage_tracking
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update storage_tracking" ON storage_tracking
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon insert distribution_tracking" ON distribution_tracking
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update distribution_tracking" ON distribution_tracking
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon insert custom_items" ON custom_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update custom_items" ON custom_items
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon delete custom_items" ON custom_items
  FOR DELETE USING (true);