-- Fix REPLICA IDENTITY for real-time subscriptions
-- UPDATE events require FULL replica identity to work properly

-- Set REPLICA IDENTITY to FULL for tracking tables
ALTER TABLE public.storage_tracking REPLICA IDENTITY FULL;
ALTER TABLE public.distribution_tracking REPLICA IDENTITY FULL;

-- Also set for main tables that might be tracked
ALTER TABLE public.allocations REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add comment explaining why
COMMENT ON TABLE public.storage_tracking IS 'Storage tracking with FULL replica identity for real-time subscriptions';
COMMENT ON TABLE public.distribution_tracking IS 'Distribution tracking with FULL replica identity for real-time subscriptions';
