import { create } from 'zustand';
import {
  AppState,
  SyncChange,
  OrderConfirmationItem,
  OrderConfirmationStatus,
  RedirectedAwayBySource,
  BankedItem,
  ShiftTaskWithStatus,
} from '@/types';
import { SupabaseDataService, type SupabaseDataResponse } from './supabaseDataService';
import { getSupabaseService } from './supabaseService';
import { StorageService } from './storage';
import { debounce } from '@/utils/helpers';
import {
  GROUPS,
  COLUMN_MAP,
  DESTINATION_COLUMNS,
  RAN_OUT_COLUMN_INDEX,
  SURPLUS_COLUMN_INDEX,
  TOTAL_REQUESTED_COLUMN_INDEX,
} from '@/utils/constants';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import { determineItemStatus } from '@/app/utils/confirmation';
import {
  fetchInventoryItems as fetchInventoryItemsService,
  setInventoryCount as setInventoryCountService,
  addCustomInventoryItem as addCustomInventoryItemService,
  setLowStockThreshold as setLowStockThresholdService,
  deactivateInventoryItem as deactivateInventoryItemService,
  toggleInventoryPacked as toggleInventoryPackedService,
  setAllInventoryPacked as setAllInventoryPackedService,
  autoImportNonAllocatedToInventory,
  takeInventoryItem as takeInventoryItemService,
  undoTakeInventoryItem as undoTakeInventoryItemService,
} from './inventoryService';
import type { InventoryViewMode, InventoryItem } from '@/types';
import { demoStateManager } from './demoDataService';
import { getDefaultTabForRole, isTabVisibleForRole } from '@/app/utils/roles';
import { enqueueInventoryMutation } from './inventoryOfflineQueue';

interface StoreActions {
  // Data fetching
  fetchData: () => Promise<void>;
  fetchRedirections: () => Promise<void>;
  refreshInventory: () => Promise<void>;

  // Toggle actions
  toggleItem: (row: number, col: number, mode: 'storage' | 'tracking') => Promise<void>;
  markGroupPacked: (destination: string, packed: boolean, mode: 'storage' | 'tracking') => Promise<void>;

  // Order Confirmation actions
  confirmItemAtExpected: (orderId: string, confirmedBy?: string) => Promise<void>;
  confirmItemRanLow: (orderId: string, receivedQuantity: number, confirmedBy?: string) => Promise<void>;
  markItemRanOut: (orderId: string, confirmedBy?: string) => Promise<void>;
  unmarkItemRanOut: (orderId: string) => Promise<void>;
  confirmAllItems: (confirmedBy?: string) => Promise<void>;
  resetConfirmations: (confirmedBy?: string) => Promise<boolean>;

  // Preferences actions
  updatePreference: <K extends keyof import('@/types').UserPreferences>(
    key: K,
    value: import('@/types').UserPreferences[K]
  ) => void;

  // Inventory actions (replacing Surplus)
  setInventoryCount: (itemId: string, quantity: number) => Promise<boolean>;
  addCustomInventoryItem: (
    name: string,
    quantity: number,
    options?: {
      unit?: string;
      category?: string;
      subcategory?: import('@/types').PantrySubcategory;
      storageLocation?: string;
      lowStockThreshold?: number;
      emoji?: string;
    }
  ) => Promise<boolean>;
  setLowStockThreshold: (itemId: string, threshold: number) => Promise<boolean>;
  deactivateInventoryItem: (itemId: string) => Promise<boolean>;
  toggleInventoryPacked: (itemId: string) => Promise<boolean>;
  setAllInventoryPacked: (packed: boolean) => Promise<boolean>;
  takeInventoryItem: (
    itemId: string,
    quantity: number,
    destinationId?: string,
    destinationName?: string
  ) => Promise<boolean>;
  setInventoryViewMode: (mode: InventoryViewMode) => void;
  returnCustomItemToInventory: (customItemId: string, inventoryItemId: string, quantity: number, itemName: string) => Promise<boolean>;

  // Banking actions (save items for next week)
  refreshBankedItems: () => Promise<void>;
  bankItem: (allocationId: string, quantity: number) => Promise<boolean>;
  deleteBankedItem: (bankedItemId: string) => Promise<boolean>;

  // Shift tasks (recurring time-specific reminders)
  refreshShiftTasks: () => Promise<void>;
  toggleShiftTask: (taskId: string) => Promise<void>;

  // UI state
  setCurrentTab: (tab: 'orderConfirmation' | 'storage' | 'pickup' | 'inventory') => void;
  setSyncError: (error: string | null) => void;
  setDemoMode: (isActive: boolean, mode: 'demo' | 'live') => void;

  // Sync management
  syncPendingChanges: () => Promise<void>;
  retryFailedChanges: () => Promise<void>;

  // Direct data ingestion
  ingestSupabasePayload: (payload: SupabaseDataResponse, options?: { isRealtime?: boolean }) => void;
}

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const deriveOrderConfirmationStatus = (items: OrderConfirmationItem[]): OrderConfirmationStatus => {
  const totalItems = items.length;
  // Count any "addressed" item (confirmed, ran-out, ran-low) — not just isConfirmed
  const confirmedItems = items.filter(item => determineItemStatus(item) !== 'pending').length;
  return {
    totalItems,
    confirmedItems,
    allConfirmed: totalItems > 0 && confirmedItems === totalItems,
  };
};

const createInitialState = (): AppState => {
  const storage = StorageService.getInstance();
  const preferences = storage.loadPreferences();

  // Load cached inventory for offline-first startup
  const cachedInventory = storage.loadInventoryCache();

  return {
    preferences,
    sheetData: null,
    trackingData: null,
    storageData: null,
    storageTypes: {},
    syncMetadata: null,
    customItems: [],
    supplies: { mealBoxes: {}, forks: {} },
    destinations: [],
    orderConfirmationItems: [],
    orderConfirmationStatus: null,
    orderConfirmationResets: [],
    inventoryItems: cachedInventory?.items ?? [],
    inventoryViewMode: 'browse' as InventoryViewMode,
    currentWeekDate: null,
    itemRowLookup: {},
    allocationLookup: {},
    customDestinationAllocations: [],
    daySplits: [],
    redirectedAwayBySource: {},
    bankedItems: [],
    destinationCodes: {},
    pendingChanges: new Map(),
    failedChanges: new Map(),
    // Smart tab selection: use activeTab if valid for role, otherwise default to first role tab
    currentTab: (preferences.activeTab && isTabVisibleForRole(preferences.activeTab, preferences.role))
      ? preferences.activeTab
      : getDefaultTabForRole(preferences.role),
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
    hasInitializedTab: false,

    // Real-time sync status
    realtimeStatus: 'disconnected',
    syncMethod: 'unknown',

    // Tutorial demo mode
    isDemoMode: false,
    isTutorialActive: false,

    // Shift tasks (recurring time-specific reminders)
    shiftTasks: [],
  };
};

export const useAppStore = create<AppState & StoreActions>((set, get) => {
  const supabaseData = SupabaseDataService.getInstance();
  const storage = StorageService.getInstance();

  // In-flight guards to prevent race conditions from rapid clicks
  const inFlightToggles = new Set<string>();
  const inFlightConfirmations = new Set<string>();

  // Debounced sync function with shorter delay for better responsiveness
  const debouncedSync = debounce(async () => {
    const state = get();
    if (state.pendingChanges.size > 0 && state.isOnline && !state.isSyncing) {
      await get().syncPendingChanges();
    }
  }, 300);

  const updateOrderConfirmationItems = (updater: (items: OrderConfirmationItem[]) => OrderConfirmationItem[]) => {
    set((state) => {
      const currentItems = state.orderConfirmationItems ?? [];
      if (currentItems.length === 0) {
        return {};
      }

      const updatedItems = updater(currentItems);
      const status = deriveOrderConfirmationStatus(updatedItems);
      const nextState: Partial<AppState> = {
        orderConfirmationItems: updatedItems,
        orderConfirmationStatus: status,
      };

      return nextState;
    });
  };

  const updateSheetRowQuantities = (
    orderId: string,
    updates: Array<{ destination_code: string; new_qty: number }>,
    options: { ranOut?: boolean } = {}
  ) => {
    set((state) => {
      const { sheetData, destinationCodes = {}, orderConfirmationItems } = state;
      if (!sheetData || !orderConfirmationItems) {
        return {};
      }

      const targetItem = orderConfirmationItems.find((item) => item.orderId === orderId);
      const rowIndex = targetItem?.sheetRow;
      if (rowIndex == null || rowIndex < 0 || !sheetData[rowIndex]) {
        return {};
      }

      const updatedSheet = [...sheetData];
      const row = [...updatedSheet[rowIndex]];
      const reverseLookup = new Map<string, string>(
        Object.entries(destinationCodes).map(([key, code]) => [code, key])
      );

      if (options.ranOut) {
        Object.keys(destinationCodes).forEach((destKey) => {
          const colIndex = COLUMN_MAP[destKey as keyof typeof COLUMN_MAP];
          if (colIndex !== undefined) {
            row[colIndex] = 0;
          }
        });
        // Flag ran out column
        row[RAN_OUT_COLUMN_INDEX] = true;
        row[SURPLUS_COLUMN_INDEX] = 0;
      } else {
        updates.forEach((update) => {
          const destKey = reverseLookup.get(update.destination_code);
          if (!destKey) return;
          const colIndex = COLUMN_MAP[destKey as keyof typeof COLUMN_MAP];
          if (colIndex === undefined) return;
          row[colIndex] = Number(update.new_qty);
        });
        row[RAN_OUT_COLUMN_INDEX] = false;
      }

      // Recalculate total requested (index 3)
      const totalRequested = DESTINATION_COLUMNS.reduce((sum, colIndex) => {
        const value = Number(row[colIndex]) || 0;
        return sum + value;
      }, 0);
      row[TOTAL_REQUESTED_COLUMN_INDEX] = totalRequested;

      const expectedQuantity = targetItem?.expectedQuantity ?? totalRequested;
      row[SURPLUS_COLUMN_INDEX] = Math.max(0, expectedQuantity - totalRequested);

      updatedSheet[rowIndex] = row;
      return { sheetData: updatedSheet };
    });
  };

  const addPendingChange = (key: string, change: SyncChange) => {
    const state = get();
    const newPendingChanges = new Map(state.pendingChanges);
    newPendingChanges.set(key, change);
    
    set({ pendingChanges: newPendingChanges });
    storage.savePendingChanges(newPendingChanges);
    
    // Trigger debounced sync
    debouncedSync();
  };

  const applySupabasePayload = (
    response: SupabaseDataResponse,
    options: { isRealtime?: boolean } = {}
  ) => {
    const now = Date.now();
    const confirmationItems = response.orderConfirmationItems || [];
    const storageTypes = response.storageTypes || {};

    set((prev) => {
      // Preserve existing data when API returns empty arrays (partial responses)
      const effectiveConfirmationItems = confirmationItems.length > 0
        ? confirmationItems
        : prev.orderConfirmationItems;
      const confirmationStatus = deriveOrderConfirmationStatus(effectiveConfirmationItems);

      // Preserve optimistic tracking/storage data when a toggle RPC is in-flight
      // to prevent real-time refreshes from overwriting the user's action.
      // Uses `inFlightToggles` (not `isSyncing`) since isSyncing is also set during initial data load.
      const hasToggleInFlight = inFlightToggles.size > 0;

      const nextState: Partial<AppState> = {
        sheetData: response.data,
        trackingData: hasToggleInFlight ? prev.trackingData : response.tracking,
        storageData: hasToggleInFlight ? prev.storageData : response.storage,
        storageTypes,
        customItems: (response.customItems?.length || 0) > 0
          ? response.customItems
          : prev.customItems,
        supplies: response.supplies && Object.keys(response.supplies.mealBoxes || {}).length > 0
          ? response.supplies
          : prev.supplies,
        destinations: (response.destinations?.length || 0) > 0
          ? response.destinations
          : prev.destinations,
        orderConfirmationItems: effectiveConfirmationItems,
        orderConfirmationStatus: confirmationStatus,
        orderConfirmationResets: response.orderConfirmationResets || [],
        currentWeekDate: response.currentWeekDate || null,
        inventoryItems: (response.inventoryItems?.length || 0) > 0
          ? response.inventoryItems
          : prev.inventoryItems,
        itemRowLookup: response.itemRowLookup || {},
        allocationLookup: response.allocationLookup || {},
        customDestinationAllocations: response.customDestinationAllocations || [],
        daySplits: response.daySplits || [],
        destinationCodes: response.destinationCodes || {},
        syncMetadata: response.syncMetadata,
        lastSyncTime: now,
        isSyncing: false,
        syncError: null,
        isOnline: options.isRealtime ? true : navigator.onLine,
      };

      nextState.hasInitializedTab = true;

      return nextState;
    });

    storage.saveLastSyncTime(now);
  };

  const baseState = createInitialState();

  return {
    ...baseState,

    // Load persisted state on initialization
    pendingChanges: storage.loadPendingChanges(),
    failedChanges: storage.loadFailedChanges(),
    lastSyncTime: storage.loadLastSyncTime(),
    isOnline: storage.isOnline(),

    ingestSupabasePayload(payload, options) {
      applySupabasePayload(payload, options);
    },

    async fetchData() {
      // Skip fetching real data in demo mode - use demo data instead
      if (get().isDemoMode) {
        logger.debug('📚 Skipping data fetch in demo mode');
        return;
      }
      try {
        set({ isSyncing: true, syncError: null });
        // Fetch all data from Supabase (including custom items that were imported from Google Sheets)
        const response = await supabaseData.getData();

        logger.debug('📊 Data loaded from Supabase (includes imported custom items)');
        applySupabasePayload(response);

        // Fetch redirections for the redirected-away indicator
        if (response.currentWeekDate) {
          try {
            const supabase = getSupabaseService();
            const redirections = await supabase.getRedirectionsEnriched(response.currentWeekDate);

            // Group by source destination ID
            const redirectedAwayBySource: RedirectedAwayBySource = {};
            for (const r of redirections) {
              if (!redirectedAwayBySource[r.sourceDestinationId]) {
                redirectedAwayBySource[r.sourceDestinationId] = [];
              }
              redirectedAwayBySource[r.sourceDestinationId].push({
                redirectionId: r.id,
                itemName: r.itemName,
                emoji: r.itemEmoji,
                quantity: r.quantity,
                targetDestinationId: r.targetDestinationId,
                targetDestinationName: r.targetDestinationName,
                redirectedAt: r.redirectedAt,
                redirectedBy: r.redirectedBy,
              });
            }
            set({ redirectedAwayBySource });
          } catch (redirectError) {
            console.warn('Failed to fetch redirections (non-critical):', redirectError);
          }

          // Fetch banked items for next week
          try {
            await get().refreshBankedItems();
          } catch (bankedError) {
            console.warn('Failed to fetch banked items (non-critical):', bankedError);
          }

          // Fetch shift tasks for current week
          try {
            await get().refreshShiftTasks();
          } catch (shiftTasksError) {
            console.warn('Failed to fetch shift tasks (non-critical):', shiftTasksError);
          }
        }

        // Fetch inventory items (separate from main data flow)
        try {
          await get().refreshInventory();
        } catch (inventoryError) {
          console.warn('Failed to fetch inventory data (non-critical):', inventoryError);
        }
      } catch (error) {
        console.error('Failed to fetch data from Supabase:', error);
        set({
          syncError: error instanceof Error ? error.message : 'Failed to fetch data',
          isSyncing: false
        });
      }
    },

    async fetchRedirections() {
      // Skip fetching redirections in demo mode
      if (get().isDemoMode) {
        logger.debug('📚 Skipping redirections fetch in demo mode');
        return;
      }

      const currentWeekDate = get().currentWeekDate;
      if (!currentWeekDate) {
        console.warn('⚠️ Cannot fetch redirections: no currentWeekDate');
        return;
      }

      try {
        const supabase = getSupabaseService();
        const redirections = await supabase.getRedirectionsEnriched(currentWeekDate);

        // Group by source destination ID
        const redirectedAwayBySource: RedirectedAwayBySource = {};
        for (const r of redirections) {
          if (!redirectedAwayBySource[r.sourceDestinationId]) {
            redirectedAwayBySource[r.sourceDestinationId] = [];
          }
          redirectedAwayBySource[r.sourceDestinationId].push({
            redirectionId: r.id,
            itemName: r.itemName,
            emoji: r.itemEmoji,
            quantity: r.quantity,
            targetDestinationId: r.targetDestinationId,
            targetDestinationName: r.targetDestinationName,
            redirectedAt: r.redirectedAt,
            redirectedBy: r.redirectedBy,
          });
        }

        logger.debug(`📍 Fetched ${redirections.length} redirections for ${Object.keys(redirectedAwayBySource).length} source destinations`);
        set({ redirectedAwayBySource });
      } catch (redirectError) {
        console.warn('Failed to fetch redirections:', redirectError);
      }
    },

    async refreshInventory() {
      // Skip refreshing inventory in demo mode - use demo data instead
      if (get().isDemoMode) {
        logger.debug('📚 Skipping inventory refresh in demo mode');
        return;
      }

      // If offline, silently skip — we already loaded from cache in createInitialState
      if (!navigator.onLine) {
        logger.debug('📴 Offline — using cached inventory data');
        return;
      }

      try {
        const items = await fetchInventoryItemsService();
        const currentItems = get().inventoryItems;

        // Smart merge: only update state if actual data changed
        // This prevents flickering during sync cycles
        const hasChanges =
          items.length !== currentItems.length ||
          items.some((item) => {
            const current = currentItems.find((c) => c.id === item.id);
            return (
              !current ||
              current.currentQuantity !== item.currentQuantity ||
              current.isLowStock !== item.isLowStock ||
              current.lowStockThreshold !== item.lowStockThreshold ||
              current.isActive !== item.isActive ||
              current.isPacked !== item.isPacked
            );
          });

        if (hasChanges) {
          set({ inventoryItems: items });
        }

        // Cache fresh data for offline use
        storage.saveInventoryCache(items);
      } catch (error) {
        // If fetch fails but we have no items yet, try loading from cache
        if (get().inventoryItems.length === 0) {
          const cached = storage.loadInventoryCache();
          if (cached) {
            logger.debug('📦 Using cached inventory after fetch failure');
            set({ inventoryItems: cached.items });
            return;
          }
        }
        console.error('Failed to fetch inventory items:', error);
        toast.error('Failed to load inventory');
      }
    },

    async toggleItem(row: number, col: number, mode: 'storage' | 'tracking' = 'tracking') {
      // Guard against rapid double-clicks on the same cell
      const toggleKey = `${mode}-${row}-${col}`;
      if (inFlightToggles.has(toggleKey)) return;
      inFlightToggles.add(toggleKey);

      const changeKey = `toggle-${mode}-${row}-${col}`;
      const change: SyncChange = { type: 'toggle', row, col, value: mode };

      // Optimistic update
      const state = get();
      const targetData = mode === 'storage' ? state.storageData : state.trackingData;

      if (targetData) {
        const newData = [...targetData];
        // Check if row exists and column is defined (could be false, which is valid)
        if (newData[row] && typeof newData[row][col] !== 'undefined') {
          newData[row] = [...newData[row]];
          newData[row][col] = !newData[row][col];

          logger.debug(`✅ Toggled item at row=${row}, col=${col}, mode=${mode}, new value=${newData[row][col]}`);

          set(mode === 'storage'
            ? { storageData: newData }
            : { trackingData: newData }
          );
        } else {
          console.warn(`⚠️ Cannot toggle item at row=${row}, col=${col} - row or column not found`);
        }
      }

      // Demo mode: update local state only, no database sync
      if (state.isDemoMode) {
        logger.debug('📚 Demo mode - skipping database sync for toggle');
        if (mode === 'storage') {
          demoStateManager.toggleStorage(row, col);
        } else {
          demoStateManager.toggleDistribution(row, col);
        }
        inFlightToggles.delete(toggleKey);
        return;
      }

      // Don't add to pending changes if we're going to sync immediately
      // This prevents the debounced sync from running

      // Immediate sync attempt
      if (state.isOnline) {
        try {
          // Set syncing flag to prevent data fetch
          set({ isSyncing: true });

          // Update in Supabase
          await supabaseData.toggleItem(row, col, mode);

          // Success - update last sync time
          set({
            lastSyncTime: Date.now(),
            isSyncing: false
          });
          storage.saveLastSyncTime(Date.now());

          logger.debug(`✅ Successfully synced toggle: row=${row}, col=${col}, mode=${mode}`);

          // DON'T fetch data here - our local state is already correct!
        } catch (error) {
          console.warn('Failed to sync toggle immediately:', error);
          // On failure, add to pending changes for retry
          addPendingChange(changeKey, change);
          set({ isSyncing: false });
          // Move to failed changes
          const newFailedChanges = new Map(get().failedChanges);
          newFailedChanges.set(changeKey, change);
          set({ failedChanges: newFailedChanges });
          storage.saveFailedChanges(newFailedChanges);
        } finally {
          inFlightToggles.delete(toggleKey);
        }
      } else {
        inFlightToggles.delete(toggleKey);
      }
    },

    async markGroupPacked(destination: string, packed: boolean, mode: 'storage' | 'tracking' = 'tracking') {
      logger.debug(`📦 Pack All: ${destination} - ${packed ? 'packing' : 'unpacking'} in ${mode} mode`);

      // Demo mode: just show a toast, don't actually sync
      const state = get();
      if (state.isDemoMode) {
        logger.debug('📚 Demo mode - skipping database sync for Pack All');
        toast.success(`Demo: ${packed ? 'Packed' : 'Unpacked'} items for ${GROUPS[destination]?.name || destination}`);
        return;
      }

      try {
        set({ isSyncing: true });

        // Use the Supabase service's bulk operation
        const itemCount = await supabaseData.markGroupPacked(destination, packed, mode);
        
        logger.debug(`✅ Pack All completed: ${itemCount} items ${packed ? 'packed' : 'unpacked'}`);
        
        // Show success toast
        if (itemCount > 0) {
          const groupName = GROUPS[destination]?.name || destination;
          toast.success(`${itemCount} items ${packed ? 'packed' : 'unpacked'} for ${groupName}`);
        } else {
          toast.warning(`No items to ${packed ? 'pack' : 'unpack'} for this destination`);
        }
        
        // The supabaseData.markGroupPacked already calls refreshData(),
        // but we need to update our local store
        logger.debug('🔄 Fetching updated data to refresh UI...');
        await get().fetchData();
        
        // Log the state after fetch
        const state = get();
        const targetData = mode === 'storage' ? state.storageData : state.trackingData;
        logger.debug(`📊 State after Pack All - mode: ${mode}, has data: ${!!targetData}`);
        
        set({ isSyncing: false });
      } catch (error) {
        const err = toError(error);
        console.error('Pack All failed:', err);
        set({ isSyncing: false, syncError: err.message });
        
        // Show error toast with retry option
        toast.error(`Failed to ${packed ? 'pack' : 'unpack'} items`, {
          label: 'Retry',
          callback: () => get().markGroupPacked(destination, packed, mode)
        });
        
        throw err;
      }
    },


    // Order Confirmation Actions
    async confirmItemAtExpected(orderId: string, confirmedBy?: string) {
      // Guard against rapid clicks on the same item
      if (inFlightConfirmations.has(orderId)) return;
      inFlightConfirmations.add(orderId);

      // Demo mode: update local state only
      if (get().isDemoMode) {
        logger.debug('📚 Demo mode - updating local confirmation state');
        demoStateManager.confirmItem(orderId);
        const timestamp = new Date().toISOString();
        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.orderId === orderId
              ? {
                  ...item,
                  isConfirmed: true,
                  ranOut: false,
                  receivedQuantity: item.expectedQuantity,
                  confirmedBy: 'Demo User',
                  confirmedAt: timestamp,
                }
              : item
          )
        );
        toast.success('✅ Demo: Item confirmed');
        inFlightConfirmations.delete(orderId);
        return;
      }

      try {
        set({ isSyncing: true, syncError: null });
        await supabaseData.confirmItemAtExpected(orderId, confirmedBy);

        const timestamp = new Date().toISOString();
        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.orderId === orderId
              ? {
                  ...item,
                  isConfirmed: true,
                  ranOut: false,
                  receivedQuantity: item.expectedQuantity,
                  confirmedBy: confirmedBy ?? item.confirmedBy,
                  confirmedAt: timestamp,
                }
              : item
          )
        );
        updateSheetRowQuantities(orderId, [], { ranOut: false });

        // Auto-import non-allocated quantity to inventory (if any)
        try {
          const prefs = get().preferences;
          const updatedBy = (prefs.volunteerName || 'Volunteer').trim() || 'Volunteer';
          const inventoryItem = await autoImportNonAllocatedToInventory(orderId, updatedBy);
          if (inventoryItem) {
            logger.debug(`📦 Auto-imported ${inventoryItem.currentQuantity} ${inventoryItem.unit} of "${inventoryItem.itemName}" to inventory`);
            // Refresh inventory to show the new item
            await get().refreshInventory();
          }
        } catch (inventoryError) {
          // Don't fail the confirmation if auto-import fails
          console.warn('Auto-import to inventory failed:', inventoryError);
        }

        // Refresh data to get updated confirmation status
        await wait(250);
        await get().fetchData();

        toast.success('✅ Item confirmed');
      } catch (error) {
        const err = toError(error);
        console.error('Failed to confirm item:', err);
        set({ syncError: err.message, isSyncing: false });
        toast.error('Failed to confirm item');
        throw err;
      } finally {
        inFlightConfirmations.delete(orderId);
      }
    },

    async confirmItemRanLow(orderId: string, receivedQuantity: number, confirmedBy?: string) {
      // Guard against rapid clicks on the same item
      if (inFlightConfirmations.has(orderId)) return;
      inFlightConfirmations.add(orderId);

      // Demo mode: update local state only
      if (get().isDemoMode) {
        logger.debug('📚 Demo mode - updating local ran low state');
        demoStateManager.updateItemQuantity(orderId, receivedQuantity);
        const timestamp = new Date().toISOString();
        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.orderId === orderId
              ? {
                  ...item,
                  isConfirmed: true,
                  ranOut: false,
                  receivedQuantity,
                  confirmedBy: 'Demo User',
                  confirmedAt: timestamp,
                }
              : item
          )
        );
        toast.success(`⚠️ Demo: Quantity adjusted to ${receivedQuantity}`);
        inFlightConfirmations.delete(orderId);
        return;
      }

      try {
        set({ isSyncing: true, syncError: null });
        const updates = await supabaseData.updateAllocationsProportionally(orderId, receivedQuantity, confirmedBy);

        const timestamp = new Date().toISOString();
        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.orderId === orderId
              ? {
                  ...item,
                  isConfirmed: true,
                  ranOut: false,
                  receivedQuantity,
                  confirmedBy: confirmedBy ?? item.confirmedBy,
                  confirmedAt: timestamp,
                }
              : item
          )
        );
        updateSheetRowQuantities(
          orderId,
          updates.map((update) => ({
            destination_code: update.destination_code,
            new_qty: Number(update.new_qty ?? 0),
          }))
        );

        // Refresh data to get updated quantities
        await wait(250);
        await get().fetchData();
        // Also refresh inventory since Ran Low may have reduced linked inventory
        await get().refreshInventory();

        const destinationCodes = get().destinationCodes;
        const formatQuantity = (value: number) => (Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.00$/, ''));
        const adjustments = updates
          .filter((update) => Number(update.original_qty) !== Number(update.new_qty))
          .map((update) => {
            const match = Object.entries(destinationCodes).find(([, code]) => code === update.destination_code);
            const groupKey = match ? match[0] : undefined;
            const groupName = groupKey && GROUPS[groupKey] ? GROUPS[groupKey].name : update.destination_code;
            return `${groupName}: ${formatQuantity(Number(update.original_qty))} → ${formatQuantity(Number(update.new_qty))}`;
          });

        const details =
          adjustments.length > 0
            ? `<br><small>${adjustments.join('<br>')}</small>`
            : '<br><small>All destinations updated proportionally.</small>';

        toast.show({
          type: 'success',
          duration: 6000,
          message: `⚠️ Quantity adjusted to ${formatQuantity(receivedQuantity)}${details}`,
        });
      } catch (error) {
        const err = toError(error);
        console.error('Failed to update quantity:', err);
        set({ syncError: err.message, isSyncing: false });
        toast.error('Failed to update quantity');
        throw err;
      } finally {
        inFlightConfirmations.delete(orderId);
      }
    },

    async markItemRanOut(orderId: string, confirmedBy?: string) {
      // Demo mode: update local state only
      if (get().isDemoMode) {
        logger.debug('📚 Demo mode - marking item as ran out locally');
        demoStateManager.markItemRanOut(orderId);
        const timestamp = new Date().toISOString();
        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.orderId === orderId
              ? {
                  ...item,
                  isConfirmed: true,
                  ranOut: true,
                  receivedQuantity: 0,
                  confirmedBy: 'Demo User',
                  confirmedAt: timestamp,
                }
              : item
          )
        );
        toast.success('❌ Demo: Item marked as unavailable');
        return;
      }

      try {
        set({ isSyncing: true, syncError: null });
        await supabaseData.markItemRanOut(orderId, confirmedBy);

        const timestamp = new Date().toISOString();
        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.orderId === orderId
              ? {
                  ...item,
                  isConfirmed: true,
                  ranOut: true,
                  receivedQuantity: 0,
                  confirmedBy: confirmedBy ?? item.confirmedBy,
                  confirmedAt: timestamp,
                }
              : item
          )
        );
        updateSheetRowQuantities(orderId, [], { ranOut: true });

        // Refresh data to get updated confirmation status
        await wait(250);
        await get().fetchData();
        // Also refresh inventory since Ran Out may have zeroed linked inventory
        await get().refreshInventory();

        toast.success('❌ Item marked as unavailable');
      } catch (error) {
        const err = toError(error);
        console.error('Failed to mark item as ran out:', err);
        set({ syncError: err.message, isSyncing: false });
        toast.error('Failed to mark item unavailable');
        throw err;
      }
    },

    async unmarkItemRanOut(orderId: string) {
      // Demo mode: optimistic local update only
      if (get().isDemoMode) {
        logger.debug('📚 Demo mode - unmarking item ran out locally');
        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.orderId === orderId
              ? {
                  ...item,
                  isConfirmed: false,
                  ranOut: false,
                  receivedQuantity: null,
                  confirmedBy: null,
                  confirmedAt: null,
                }
              : item
          )
        );
        toast.success('✅ Demo: Item restored');
        return;
      }

      try {
        set({ isSyncing: true, syncError: null });
        await supabaseData.unmarkItemRanOut(orderId);

        // Optimistic local update — refresh below pulls authoritative state
        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.orderId === orderId
              ? {
                  ...item,
                  isConfirmed: false,
                  ranOut: false,
                  receivedQuantity: null,
                  confirmedBy: null,
                  confirmedAt: null,
                }
              : item
          )
        );

        // Also un-flag in the sheet so the next /weekly-import doesn't re-mark it
        updateSheetRowQuantities(orderId, [], { ranOut: false });

        await wait(250);
        await get().fetchData();
        await get().refreshInventory();

        toast.success('✅ Item restored — confirm received quantity');
      } catch (error) {
        const err = toError(error);
        console.error('Failed to unmark item ran out:', err);
        set({ syncError: err.message, isSyncing: false });
        toast.error('Failed to restore item');
        throw err;
      }
    },

    async confirmAllItems(confirmedBy?: string) {
      try {
        set({ isSyncing: true, syncError: null });

        const weekDate = get().currentWeekDate;
        if (!weekDate) {
          throw new Error('No active week date found. Import data before confirming items.');
        }

        const count = await supabaseData.confirmAllItemsAtExpected(weekDate, confirmedBy);
        const timestamp = new Date().toISOString();

        updateOrderConfirmationItems((items) =>
          items.map((item) =>
            item.isConfirmed
              ? item
              : {
                  ...item,
                  isConfirmed: true,
                  ranOut: false,
                  receivedQuantity: item.expectedQuantity,
                  confirmedBy: confirmedBy ?? item.confirmedBy,
                  confirmedAt: timestamp,
                }
          )
        );

        const currentItems = get().orderConfirmationItems || [];
        currentItems.forEach((item) => {
          if (item.isConfirmed) {
            updateSheetRowQuantities(item.orderId, [], { ranOut: false });
          }
        });

        // Refresh data to get updated confirmation status
        await wait(350);
        await get().fetchData();

        toast.success(`🎉 Confirmed ${count} items`);
      } catch (error) {
        const err = toError(error);
        console.error('Failed to confirm all items:', err);
        set({ syncError: err.message, isSyncing: false });
        toast.error(err.message || 'Failed to confirm all items');
        throw err;
      }
    },

    async resetConfirmations(confirmedBy?: string) {
      try {
        // Confirm with user first
        const confirmed = window.confirm(
          '⚠️ Reset All Confirmations?\n\n' +
          'This will clear all confirmed items and quantities, allowing you to re-confirm everything from scratch.\n\n' +
          'Are you sure you want to reset all confirmations?'
        );

        if (!confirmed) {
          return false;
        }

        set({ isSyncing: true, syncError: null });

        const weekDate = get().currentWeekDate;
        if (!weekDate) {
          throw new Error('No active week date found. Import data before resetting confirmations.');
        }

        const count = await supabaseData.resetConfirmations(weekDate, confirmedBy);
        const timestamp = new Date().toISOString();

        updateOrderConfirmationItems((items) =>
          items.map((item) => ({
            ...item,
            isConfirmed: false,
            ranOut: false,
            receivedQuantity: null,
            confirmedBy: null,
            confirmedAt: null,
          }))
        );

        if (confirmedBy) {
          set((state) => ({
            orderConfirmationResets: [
              {
                weekDate,
                resetBy: confirmedBy,
                resetAt: timestamp,
              },
              ...state.orderConfirmationResets,
            ],
          }));
        }

        // Refresh data to get updated confirmation status
        await wait(350);
        await get().fetchData();

        toast.success(`🔄 Reset ${count} confirmations`);
        set({ isSyncing: false });
        return true;
      } catch (error) {
        const err = toError(error);
        console.error('Failed to reset confirmations:', err);
        set({ syncError: err.message, isSyncing: false });
        toast.error(err.message || 'Failed to reset confirmations');
        throw err;
      }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Inventory Actions (replacing Surplus)
    // ─────────────────────────────────────────────────────────────────────────

    async setInventoryCount(itemId: string, quantity: number) {
      const prefs = get().preferences;
      const updatedBy = (prefs.volunteerName || localStorage.getItem('volunteerName') || 'Volunteer').trim() || 'Volunteer';

      // Offline-aware: optimistic update + queue
      if (!navigator.onLine) {
        set((state) => ({
          inventoryItems: state.inventoryItems.map((item) =>
            item.id === itemId
              ? { ...item, currentQuantity: quantity, isLowStock: quantity <= item.lowStockThreshold, lastUpdatedBy: updatedBy }
              : item
          ),
        }));
        storage.saveInventoryCache(get().inventoryItems);
        enqueueInventoryMutation({ type: 'set_count', itemId, quantity });
        toast.success(`Count → ${quantity} (will sync when online)`);
        return true;
      }

      try {
        await setInventoryCountService(itemId, quantity, updatedBy);
        await get().refreshInventory();
        toast.success(`Updated count to ${quantity}`);
        return true;
      } catch (error) {
        console.error('Failed to set inventory count:', error);
        toast.error('Failed to update inventory');
        return false;
      }
    },

    async addCustomInventoryItem(name: string, quantity: number, options?: {
      emoji?: string;
      unit?: string;
      category?: string;
      subcategory?: import('@/types').PantrySubcategory;
      storageLocation?: string;
      lowStockThreshold?: number;
    }) {
      const prefs = get().preferences;
      const addedBy = (prefs.volunteerName || localStorage.getItem('volunteerName') || 'Volunteer').trim() || 'Volunteer';

      const trimmedName = name.trim();
      if (!trimmedName) {
        toast.warning('Enter an item name');
        return false;
      }

      // Offline-aware: optimistic local item + queue
      if (!navigator.onLine) {
        const localItem: InventoryItem = {
          id: `offline-${crypto.randomUUID()}`,
          orderId: null,
          customName: trimmedName,
          itemName: trimmedName,
          emoji: options?.emoji || '📦',
          unit: options?.unit || 'Case',
          category: options?.category || 'Pantry',
          subcategory: (options?.subcategory as import('@/types').PantrySubcategory) || null,
          storageLocation: options?.storageLocation || null,
          currentQuantity: quantity,
          lowStockThreshold: options?.lowStockThreshold ?? 2,
          isLowStock: quantity <= (options?.lowStockThreshold ?? 2),
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: addedBy,
          isActive: true,
          isPacked: false,
        };
        set((state) => ({
          inventoryItems: [...state.inventoryItems, localItem],
        }));
        storage.saveInventoryCache(get().inventoryItems);
        enqueueInventoryMutation({
          type: 'add_custom_item',
          name: trimmedName,
          quantity,
          options: { ...options, subcategory: options?.subcategory ?? undefined },
        });
        toast.success(`Added "${trimmedName}" (will sync when online)`);
        return true;
      }

      try {
        await addCustomInventoryItemService(trimmedName, quantity, {
          ...options,
          addedBy,
        });
        await get().refreshInventory();
        toast.success(`Added "${trimmedName}" to inventory`);
        return true;
      } catch (error) {
        console.error('Failed to add custom inventory item:', error);
        toast.error('Could not add item');
        return false;
      }
    },

    async setLowStockThreshold(itemId: string, threshold: number) {
      // Offline-aware: optimistic update + queue
      if (!navigator.onLine) {
        set((state) => ({
          inventoryItems: state.inventoryItems.map((item) =>
            item.id === itemId
              ? { ...item, lowStockThreshold: threshold, isLowStock: item.currentQuantity <= threshold }
              : item
          ),
        }));
        storage.saveInventoryCache(get().inventoryItems);
        enqueueInventoryMutation({ type: 'set_threshold', itemId, threshold });
        toast.success(`Threshold → ${threshold} (will sync when online)`);
        return true;
      }

      try {
        await setLowStockThresholdService(itemId, threshold);
        await get().refreshInventory();
        toast.success(`Threshold updated to ${threshold}`);
        return true;
      } catch (error) {
        console.error('Failed to set low stock threshold:', error);
        toast.error('Failed to update threshold');
        return false;
      }
    },

    async deactivateInventoryItem(itemId: string) {
      try {
        await deactivateInventoryItemService(itemId);
        await get().refreshInventory();
        toast.success('Item removed from inventory');
        return true;
      } catch (error) {
        console.error('Failed to deactivate inventory item:', error);
        toast.error('Could not remove item');
        return false;
      }
    },

    async toggleInventoryPacked(itemId: string) {
      try {
        await toggleInventoryPackedService(itemId);
        await get().refreshInventory();
        return true;
      } catch (error) {
        console.error('Failed to toggle inventory packed:', error);
        toast.error('Failed to update item');
        return false;
      }
    },

    async setAllInventoryPacked(packed: boolean) {
      try {
        const count = await setAllInventoryPackedService(packed);
        await get().refreshInventory();
        if (count > 0) {
          toast.success(`${count} item${count === 1 ? '' : 's'} ${packed ? 'packed' : 'unpacked'}`);
        }
        return true;
      } catch (error) {
        console.error('Failed to set all inventory packed:', error);
        toast.error('Failed to update items');
        return false;
      }
    },

    async takeInventoryItem(
      itemId: string,
      quantity: number,
      destinationId?: string,
      destinationName?: string
    ) {
      const prefs = get().preferences;
      const takenBy = (prefs.volunteerName || localStorage.getItem('volunteerName') || 'Volunteer').trim() || 'Volunteer';

      const items = get().inventoryItems;
      const item = items.find((i) => i.id === itemId);
      const itemName = item?.itemName ?? 'item';

      try {
        await takeInventoryItemService(itemId, quantity, {
          destinationId,
          destinationName,
          takenBy,
        });
        await get().refreshInventory();
        const displayName = destinationName || 'inventory';

        // If taken for a destination group, create a custom item so it appears in their Pickup tab
        let customItemId: string | null = null;
        if (destinationId) {
          try {
            const weekDate = get().currentWeekDate || new Date().toISOString().split('T')[0];
            const supabase = getSupabaseService();
            customItemId = await supabase.addCustomItemToDestination(
              destinationId, itemName, quantity, weekDate, takenBy, itemId
            );
            await get().fetchData();
          } catch (ciError) {
            console.error('Failed to create pickup item (take still succeeded):', ciError);
          }
        }

        // Show toast with undo action (10 second window)
        toast.show({
          message: `Took ${quantity} ${itemName} for ${displayName}`,
          type: 'success',
          duration: 10000,
          action: {
            label: 'Undo',
            callback: async () => {
              try {
                // Add back the taken quantity (relative delta, safe with concurrent changes)
                await undoTakeInventoryItemService(itemId, quantity);
                // Remove the pickup tab entry created for this take
                if (customItemId) {
                  const supabase = getSupabaseService();
                  await supabase.deleteCustomItemWrapper(customItemId);
                }
                await get().refreshInventory();
                await get().fetchData();
                toast.success('Take undone');
              } catch (undoError) {
                console.error('Failed to undo take:', undoError);
                toast.error('Failed to undo');
              }
            },
          },
        });
        return true;
      } catch (error) {
        console.error('Failed to take inventory item:', error);
        toast.error('Failed to take item');
        return false;
      }
    },

    setInventoryViewMode(mode: InventoryViewMode) {
      set({ inventoryViewMode: mode });
    },

    async returnCustomItemToInventory(
      customItemId: string,
      inventoryItemId: string,
      quantity: number,
      itemName: string
    ) {
      try {
        // Increment inventory quantity back
        await undoTakeInventoryItemService(inventoryItemId, quantity);
        // Delete the custom item from pickup
        const supabase = getSupabaseService();
        await supabase.deleteCustomItemWrapper(customItemId);
        // Refresh both inventory and pickup data
        await get().refreshInventory();
        await get().fetchData();
        toast.success(`Returned ${quantity} ${itemName} to inventory`);
        return true;
      } catch (error) {
        console.error('Failed to return item to inventory:', error);
        toast.error('Failed to return item');
        return false;
      }
    },

    // ---------- Banking Actions (save items for next week) ----------

    async refreshBankedItems() {
      // Skip in demo mode
      if (get().isDemoMode) {
        logger.debug('📚 Skipping banked items refresh in demo mode');
        return;
      }

      try {
        const supabase = getSupabaseService();
        const items = await supabase.getBankedItems();
        const bankedItems: BankedItem[] = items.map((item) => ({
          id: item.id,
          destinationId: item.destinationId,
          destinationName: item.destinationName,
          itemName: item.itemName,
          quantity: item.quantity,
          bankedBy: item.bankedBy,
          bankedAt: item.bankedAt,
          weekDate: item.weekDate,
        }));
        set({ bankedItems });
        logger.debug(`🏦 Loaded ${bankedItems.length} banked items`);
      } catch (error) {
        console.error('Failed to fetch banked items:', error);
        // Don't show toast - this is a background refresh
      }
    },

    async bankItem(allocationId: string, quantity: number) {
      // Skip in demo mode
      if (get().isDemoMode) {
        toast.error('Banking not available in demo mode');
        return false;
      }

      const prefs = get().preferences;
      const volunteerName = prefs.volunteerName || 'Volunteer';

      try {
        const supabase = getSupabaseService();
        const result = await supabase.bankItem(allocationId, quantity, volunteerName);

        toast.success(`Banked ${quantity} for next week (${result.destinationName})`);

        // Refresh data to show updated allocation
        await get().fetchData();

        return true;
      } catch (error) {
        console.error('Failed to bank item:', error);
        toast.error('Failed to bank item');
        return false;
      }
    },

    async deleteBankedItem(bankedItemId: string) {
      // Skip in demo mode
      if (get().isDemoMode) {
        toast.error('Banking not available in demo mode');
        return false;
      }

      try {
        const supabase = getSupabaseService();
        const success = await supabase.deleteBankedItem(bankedItemId);

        if (success) {
          toast.success('Banked item cancelled - quantity restored');
          await get().fetchData();
        }

        return success;
      } catch (error) {
        console.error('Failed to delete banked item:', error);
        toast.error('Failed to cancel banked item');
        return false;
      }
    },

    // ============================================
    // SHIFT TASKS (recurring time-specific reminders)
    // ============================================

    async refreshShiftTasks() {
      const weekDate = get().currentWeekDate;
      if (!weekDate) return;

      try {
        const supabase = getSupabaseService();
        const tasks = await supabase.getShiftTasksWithStatus(weekDate);
        set({ shiftTasks: tasks as ShiftTaskWithStatus[] });
      } catch (error) {
        console.warn('Failed to fetch shift tasks:', error);
      }
    },

    async toggleShiftTask(taskId: string) {
      const state = get();
      const weekDate = state.currentWeekDate;
      if (!weekDate) return;

      // Optimistic update
      set({
        shiftTasks: state.shiftTasks.map((task) =>
          task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task
        ),
      });

      try {
        const supabase = getSupabaseService();
        const volunteerName = state.preferences.volunteerName || undefined;
        await supabase.toggleShiftTask(taskId, weekDate, volunteerName);
      } catch (error) {
        console.error('Failed to toggle shift task:', error);
        // Revert on error
        await get().refreshShiftTasks();
      }
    },

    setCurrentTab(tab: 'orderConfirmation' | 'storage' | 'pickup' | 'inventory') {
      set({ currentTab: tab });
      // Persist active tab so user resumes where they left off
      storage.updatePreference('activeTab', tab);
    },

    setSyncError(error: string | null) {
      set({ syncError: error });
    },

    setDemoMode(isActive: boolean, mode: 'demo' | 'live') {
      set({
        isTutorialActive: isActive,
        isDemoMode: isActive && mode === 'demo',
      });
    },

    updatePreference(key, value) {
      const state = get();
      const updatedPreferences = { ...state.preferences, [key]: value };
      set({ preferences: updatedPreferences });
      storage.savePreferences(updatedPreferences);

      // Apply compact mode immediately to body element
      if (key === 'compactMode') {
        if (value) {
          document.body.classList.add('compact-mode');
        } else {
          document.body.classList.remove('compact-mode');
        }
      }
    },

    async syncPendingChanges() {
      const state = get();
      if (!state.isOnline || state.isSyncing || state.pendingChanges.size === 0) {
        return;
      }
      
      set({ isSyncing: true });
      
      const failedChanges = new Map<string, SyncChange>();
      
      for (const [key, change] of state.pendingChanges.entries()) {
        try {
          switch (change.type) {
            case 'toggle': {
              await supabaseData.toggleItem(change.row!, change.col!, change.value as any);
              break;
            }
            // 'group' case removed - markGroupPacked now uses individual toggleItem calls
            case 'supply': {
              // Supplies not implemented in Supabase yet
              console.warn('Supply updates not yet implemented in Supabase');
              break;
            }
          }
        } catch (error) {
          console.warn(`Failed to sync change ${key}:`, error);
          failedChanges.set(key, change);
        }
      }
      
      // Update state with successful syncs
      const newPendingChanges = new Map(failedChanges);
      const newFailedChanges = new Map([...state.failedChanges, ...failedChanges]);
      
      set({ 
        pendingChanges: newPendingChanges,
        failedChanges: newFailedChanges,
        isSyncing: false,
        lastSyncTime: Date.now()
      });
      
      storage.savePendingChanges(newPendingChanges);
      storage.saveFailedChanges(newFailedChanges);
      
      // DON'T fetch data after sync - our local state is already correct!
      // Fetching would overwrite our changes before the backend has written them
      if (failedChanges.size === 0) {
        logger.debug('✅ All pending changes synced successfully');
      }
    },

    async retryFailedChanges() {
      const state = get();
      const combinedChanges = new Map([...state.failedChanges, ...state.pendingChanges]);
      
      set({ 
        pendingChanges: combinedChanges,
        failedChanges: new Map()
      });
      
      storage.savePendingChanges(combinedChanges);
      storage.clearFailedChanges();
      
      await get().syncPendingChanges();
    }
  };
});

type ResetOptions = {
  withPersistedState?: boolean;
};

export const resetAppStore = (options?: ResetOptions): void => {
  const baseState = createInitialState();

  if (options?.withPersistedState) {
    const storage = StorageService.getInstance();
    useAppStore.setState({
      ...baseState,
      pendingChanges: storage.loadPendingChanges(),
      failedChanges: storage.loadFailedChanges(),
      lastSyncTime: storage.loadLastSyncTime(),
      isOnline: storage.isOnline(),
    });
    return;
  }

  useAppStore.setState({
    ...baseState,
  });
};

// Set up online/offline listeners
window.addEventListener('online', () => {
  useAppStore.setState({ isOnline: true });
  // retryFailedChanges moves failed changes back to pending, then calls syncPendingChanges
  useAppStore.getState().retryFailedChanges();
});

window.addEventListener('offline', () => {
  useAppStore.setState({ isOnline: false });
});
