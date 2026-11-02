import React, { useEffect } from 'react';
import { useAppStore } from '@/services/state';
import { SupabaseDataService, type SupabaseDataResponse } from '@/services/supabaseDataService';
import { GoogleSheetsSync } from '@/services/googleSheetsSync';
import { StorageService } from '@/services/storage';
import { toast } from '@/lib/toast';
import { demoStateManager } from '@/services/demoDataService';
import { logger } from '@/lib/logger';
import { drainInventoryQueue } from '@/services/inventoryOfflineQueue';

type AppBootstrapProps = {
  children: React.ReactNode;
};

export const AppBootstrap: React.FC<AppBootstrapProps> = ({ children }) => {
  useEffect(() => {
    // CRITICAL: Validate and clear corrupted localStorage BEFORE any service initialization
    // This prevents Supabase client failures due to corrupted storage
    const storageValidation = StorageService.validateAndClearCorruptedStorage();
    if (storageValidation.wasCorrupted) {
      console.warn('🧹 localStorage corruption detected and cleared:', storageValidation);

      // Notify user if corruption was cleared
      if (storageValidation.versionMismatch) {
        toast.info('App updated! Your local data has been refreshed.');
      } else {
        toast.info('Local storage recovered. Reloading fresh data...');
      }
    }

    const supabaseService = SupabaseDataService.getInstance();
    const googleSync = new GoogleSheetsSync();

    // Expose shared services for legacy utilities and debugging
    (window as any).supabaseDataService = supabaseService;
    (window as any).googleSync = googleSync;
    (window as any).useAppStore = useAppStore;

    // Apply compact mode on initial load if enabled in preferences
    const preferences = useAppStore.getState().preferences;
    if (preferences.compactMode) {
      document.body.classList.add('compact-mode');
    }

    let isMounted = true;
    let cachedRealData: SupabaseDataResponse | null = null;
    let hasLoadedRedirections = false;
    let hasLoadedShiftTasks = false;
    let inventoryRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    const handleRealtimePayload = (payload: SupabaseDataResponse) => {
      if (!isMounted) {
        return;
      }

      // Cache real data for restoration after demo mode
      cachedRealData = payload;

      // Skip ingesting real data when in demo mode
      const { isDemoMode } = useAppStore.getState();
      if (isDemoMode) {
        logger.debug('📚 Demo mode active - skipping real data ingestion');
        return;
      }

      useAppStore.getState().ingestSupabasePayload(payload, { isRealtime: true });
      useAppStore.setState({
        isOnline: true,
        syncError: null,
        lastSyncTime: Date.now(),
      });

      // Debounce inventory refresh to prevent flickering
      // (inventory is fetched separately from main data, so ingestSupabasePayload sets it to [])
      if (inventoryRefreshTimer) clearTimeout(inventoryRefreshTimer);
      inventoryRefreshTimer = setTimeout(() => {
        useAppStore.getState().refreshInventory();
      }, 300);

      // Fetch redirections on first load (for Redirected-Away indicator in PickupView)
      if (!hasLoadedRedirections && payload.currentWeekDate) {
        hasLoadedRedirections = true;
        useAppStore.getState().fetchRedirections();
      }

      // Fetch shift tasks on first load (so Pickup tab shows tasks without manual sync)
      if (!hasLoadedShiftTasks && payload.currentWeekDate) {
        hasLoadedShiftTasks = true;
        useAppStore.getState().refreshShiftTasks();
      }
    };

    // Subscribe to demo mode changes
    let prevIsDemoMode = useAppStore.getState().isDemoMode;
    const unsubscribeDemoMode = useAppStore.subscribe((state) => {
      if (!isMounted) return;

      const isDemoMode = state.isDemoMode;
      if (isDemoMode === prevIsDemoMode) return;

      if (isDemoMode && !prevIsDemoMode) {
        // Update FIRST to prevent re-entry from ingestSupabasePayload triggering more state changes
        prevIsDemoMode = isDemoMode;
        // Demo mode just activated - inject demo data
        logger.debug('📚 Demo mode activated - injecting demo data');
        const demoData = demoStateManager.initialize();
        useAppStore.getState().ingestSupabasePayload(demoData, { isRealtime: false });
      } else if (!isDemoMode && prevIsDemoMode) {
        // Update FIRST to prevent re-entry
        prevIsDemoMode = isDemoMode;
        // Demo mode just deactivated - restore real data
        logger.debug('📚 Demo mode deactivated - restoring real data');
        demoStateManager.reset();
        if (cachedRealData) {
          useAppStore.getState().ingestSupabasePayload(cachedRealData, { isRealtime: false });
        } else {
          // No cached data, fetch fresh
          supabaseService.getData().then((data) => {
            if (isMounted) {
              useAppStore.getState().ingestSupabasePayload(data, { isRealtime: false });
            }
          });
        }
      }
    });

    const handleStatusChange = (status: 'connected' | 'disconnected' | 'error' | 'polling') => {
      if (!isMounted) {
        return;
      }

      logger.debug(`🔄 Sync status changed: ${status}`);

      const syncMethod =
        status === 'connected'
          ? ('realtime' as const)
          : status === 'polling'
            ? ('polling' as const)
            : ('unknown' as const);

      useAppStore.setState({
        realtimeStatus: status,
        syncMethod,
      });

      // If we're in error state, set syncError
      if (status === 'error') {
        useAppStore.setState({
          syncError: 'Real-time sync connection failed. Using fallback polling.',
        });
      } else if (status === 'connected') {
        // Clear error when reconnected
        useAppStore.setState({
          syncError: null,
        });
      }
    };

    const initialize = async () => {
      try {
        useAppStore.setState({ isSyncing: true, syncError: null });
        await supabaseService.initialize(handleRealtimePayload, handleStatusChange);
      } catch (error) {
        console.error('Failed to initialize Supabase services', error);
        useAppStore.setState({
          syncError: error instanceof Error ? error.message : 'Failed to initialize services',
          isSyncing: false,
          isOnline: navigator.onLine,
          realtimeStatus: 'error',
          syncMethod: 'unknown',
        });
      }
    };

    const handleOnline = async () => {
      useAppStore.setState({ isOnline: true });
      // Drain any inventory mutations queued while offline, then reconcile
      const synced = await drainInventoryQueue();
      if (synced > 0) {
        await useAppStore.getState().refreshInventory();
      }
    };
    const handleOffline = () => useAppStore.setState({ isOnline: false });

    initialize();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      if (inventoryRefreshTimer) clearTimeout(inventoryRefreshTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Don't call supabaseService.cleanup() — it's a singleton that should
      // survive React StrictMode's mount→cleanup→remount cycle. Cleaning it up
      // here causes an infinite disconnect/reconnect loop in development.
      unsubscribeDemoMode();
      demoStateManager.reset();
    };
  }, []);

  return <>{children}</>;
};
