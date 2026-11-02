-- Real-time Subscriptions Configuration

-- Enable real-time for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE storage_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE distribution_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE custom_items;
ALTER PUBLICATION supabase_realtime ADD TABLE supplies;
ALTER PUBLICATION supabase_realtime ADD TABLE destinations;

-- Create a function to broadcast changes for custom events
CREATE OR REPLACE FUNCTION broadcast_changes()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  channel TEXT;
BEGIN
  -- Determine the channel based on table name
  channel := 'tracking_' || TG_TABLE_NAME;
  
  -- Build the payload
  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'action', TG_OP,
    'new', row_to_json(NEW),
    'old', CASE WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    'timestamp', NOW()
  );
  
  -- Broadcast the change
  PERFORM pg_notify(channel, payload::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply broadcast triggers to tracking tables for custom notifications
CREATE TRIGGER broadcast_storage_changes
  AFTER INSERT OR UPDATE OR DELETE ON storage_tracking
  FOR EACH ROW EXECUTE FUNCTION broadcast_changes();

CREATE TRIGGER broadcast_distribution_changes
  AFTER INSERT OR UPDATE OR DELETE ON distribution_tracking
  FOR EACH ROW EXECUTE FUNCTION broadcast_changes();

CREATE TRIGGER broadcast_custom_items_changes
  AFTER INSERT OR UPDATE OR DELETE ON custom_items
  FOR EACH ROW EXECUTE FUNCTION broadcast_changes();

CREATE TRIGGER broadcast_supplies_changes
  AFTER INSERT OR UPDATE OR DELETE ON supplies
  FOR EACH ROW EXECUTE FUNCTION broadcast_changes();