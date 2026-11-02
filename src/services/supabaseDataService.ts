import { SupabaseService } from './supabaseService';
import type { SheetData, StorageTypes, CustomItem, Supplies } from '@/types';
import {
  COLUMN_MAP,
  DESTINATION_COLUMNS,
  NON_ALLOCATED_COLUMN_INDEX,
  RAN_OUT_COLUMN_INDEX,
  STORAGE_TYPE_COLUMN_INDEX,
  SURPLUS_COLUMN_INDEX,
  TOTAL_REQUESTED_COLUMN_INDEX,
} from '@/utils/constants';
import { getEmojiForItem } from '@/utils/helpers';
import type { InventoryItem } from '@/types';
import type { Database } from '@/types/supabase';
import { logger } from '@/lib/logger';

type AllocationMeta = {
  allocationId: string;
  destinationCode: string;
  row: number;
  col: number;
  isStored: boolean;
  isDistributed: boolean;
};

type SyncMetadataRow = { last_modified_at: string; modified_by: string | null } | null;

type DestinationRow = Database['public']['Tables']['destinations']['Row'];
type WeekDataRow = Database['public']['Functions']['get_all_week_data']['Returns'][number];

export type DestinationInfo = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  timing: string | null;
  defaultTiming: string | null;
  isDirect: boolean;
  displayOrder: number;
};

// Allocation data for items redirected to custom destinations
export type CustomDestinationAllocation = {
  allocationId: string;
  destinationId: string;
  destinationCode: string;
  itemName: string;
  quantity: number;
  isStored: boolean;
  isDistributed: boolean;
  emoji: string;
  storageType: string | null;
};

export interface SupabaseDataResponse {
  data: SheetData;
  tracking: SheetData;
  storage: SheetData;
  storageTypes: StorageTypes;
  customItems: CustomItem[];
  supplies: Supplies;
  destinations: DestinationInfo[];
  orderConfirmationItems: Array<{
    orderId: string;
    itemName: string;
    expectedQuantity: number;
    receivedQuantity: number | null;
    isConfirmed: boolean;
    ranOut: boolean;
    unit: string | null;
    emoji: string;
    storageType: string | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
    sheetRow: number | null;
  }>;
  orderConfirmationStatus: {
    totalItems: number;
    confirmedItems: number;
    allConfirmed: boolean;
  } | null;
  orderConfirmationResets: Array<{
    weekDate: string;
    resetBy: string | null;
    resetAt: string;
  }>;
  currentWeekDate: string | null;
  destinationCodes: Record<string, string>;
  itemRowLookup: Record<string, number>;
  allocationLookup: Record<string, AllocationMeta>;
  customDestinationAllocations: CustomDestinationAllocation[];
  daySplits: Array<{ allocationId: string; day: string; quantity: number }>;
  inventoryItems: InventoryItem[];
  syncMetadata?: any;
}

export class SupabaseDataService {
  private static instance: SupabaseDataService;
  private supabase: SupabaseService;
  private subscriptions: Array<() => void> = [];
  private onDataUpdate?: (data: SupabaseDataResponse) => void;
  private refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private cachedData?: SupabaseDataResponse;

  // Real-time connection status tracking
  private isRealtimeConnected: boolean = false;
  private lastRealtimeEventTime: number = Date.now();
  private realtimeRetryCount: number = 0;
  private maxRealtimeRetries: number = 3;
  private healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private healthCheckCounter: number = 0;

  // Fallback polling configuration
  private pollingInterval: number = 30000; // 30 seconds default
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPollingInterval: number = 30000;
  private onStatusChange?: (status: 'connected' | 'disconnected' | 'error' | 'polling') => void;

  // Prevent double-initialization from React StrictMode remounts
  private isInitialized: boolean = false;

  private constructor() {
    this.supabase = SupabaseService.getInstance();
  }

  static getInstance(): SupabaseDataService {
    if (!SupabaseDataService.instance) {
      SupabaseDataService.instance = new SupabaseDataService();
    }
    return SupabaseDataService.instance;
  }

  async initialize(
    onUpdate?: (data: SupabaseDataResponse) => void,
    onStatusChange?: (status: 'connected' | 'disconnected' | 'error' | 'polling') => void
  ) {
    // Always update callbacks (they change on React StrictMode remount)
    this.onDataUpdate = onUpdate;
    this.onStatusChange = onStatusChange;

    // Prevent double-initialization from React StrictMode's mount→cleanup→remount cycle.
    // The singleton persists across remounts, so subscriptions from the first mount are still alive.
    if (this.isInitialized) {
      logger.debug('🔄 Already initialized — skipping duplicate setup (StrictMode remount)');
      return;
    }
    this.isInitialized = true;

    // Set up real-time subscriptions
    this.setupRealtimeSubscriptions();

    // Start fallback polling timer
    this.startFallbackPolling();

    // IMPORTANT: Fetch initial data and trigger callback
    logger.debug('📊 Fetching initial data from Supabase...');
    await this.refreshData();
  }

  private setupRealtimeSubscriptions() {
    logger.debug('📡 Setting up enhanced Supabase real-time subscriptions...');

    // Subscribe to tracking changes (storage_tracking and distribution_tracking only)
    // Note: custom_items and supplies tables don't exist in the database
    const unsubTracking = this.supabase.subscribeToAllTrackingUpdates(
      async (payload: any) => {
        logger.debug(`📡 Real-time update received (${payload.type}):`, payload);

        // Track that we received a real-time event
        this.lastRealtimeEventTime = Date.now();

        // Add timestamp to track when updates are received
        const updateTime = new Date().toISOString();
        logger.debug(`⏰ Update timestamp: ${updateTime}`);

        try {
          this.debouncedRefreshData();
          logger.debug('✅ Data refresh scheduled after real-time update');
        } catch (error) {
          console.error('❌ Failed to schedule data refresh after real-time update:', error);
          // Try again after a short delay
          setTimeout(() => this.debouncedRefreshData(), 2000);
        }
      },
      (status: string, error?: Error) => {
        // Handle subscription status changes
        if (status === 'connected') {
          logger.debug('✅ Real-time connected successfully');
          this.isRealtimeConnected = true;
          this.realtimeRetryCount = 0;
          this.currentPollingInterval = this.pollingInterval; // Reset polling interval
          this.onStatusChange?.('connected');
        } else if (status === 'disconnected' || status === 'timeout' || status === 'error') {
          console.warn(`⚠️ Real-time ${status} - will use fallback polling`, error);
          this.isRealtimeConnected = false;
          this.lastRealtimeEventTime = Date.now(); // avoid negative durations

          // Trigger immediate polling and status update instead of waiting 30–60s
          this.onStatusChange?.(status === 'error' ? 'error' : 'disconnected');
          this.currentPollingInterval = Math.min(this.currentPollingInterval, 15000);
          this.refreshData().catch((err) => console.error('❌ Fallback refresh failed:', err));

          // Attempt to retry subscription
          if (this.realtimeRetryCount < this.maxRealtimeRetries) {
            this.realtimeRetryCount++;
            const retryDelay = Math.min(5000 * this.realtimeRetryCount, 30000);
            logger.debug(`🔄 Will retry real-time subscription in ${retryDelay}ms (attempt ${this.realtimeRetryCount}/${this.maxRealtimeRetries})`);
            setTimeout(() => {
              // Clean up the failed subscription before retrying to prevent zombie accumulation
              if (this.subscriptions.length > 0) {
                const lastUnsub = this.subscriptions.pop()!;
                lastUnsub();
              }
              logger.debug('🔄 Retrying real-time subscription setup...');
              this.setupRealtimeSubscriptions();
            }, retryDelay);
          }
        }
      }
    );

    this.subscriptions.push(unsubTracking);

    // Add connection health monitoring (throttled)
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
    }
    this.healthCheckIntervalId = setInterval(() => {
      if (!this.lastRealtimeEventTime || this.lastRealtimeEventTime <= 0) {
        this.lastRealtimeEventTime = Date.now();
        return;
      }

      const now = Date.now();
      const timeSinceLastEvent =
        this.lastRealtimeEventTime > 0 && this.lastRealtimeEventTime <= now
          ? now - this.lastRealtimeEventTime
          : 0;
      const secondsSinceLastEvent = Math.max(0, Math.floor(timeSinceLastEvent / 1000));

      // Only warn if >2 minutes but < 1 day, and throttle warnings
      if (timeSinceLastEvent > 120000 && timeSinceLastEvent < 86_400_000) {
        if (this.healthCheckCounter % 10 === 0) {
          console.warn(
            `⚠️ No real-time events received for ~${Math.floor(secondsSinceLastEvent / 60)} minutes - real-time may be stalled`
          );
        }
      }

      if (this.healthCheckCounter % 2 === 0) {
        logger.debug('💓 Real-time health check:', {
          subscriptions: this.subscriptions.length,
          connected: this.isRealtimeConnected,
          lastEventAgo: `${secondsSinceLastEvent}s`,
        });
      }

      this.healthCheckCounter += 1;
    }, 30000); // Log every 30 seconds
  }

  private debouncedRefreshData() {
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }
    
    this.refreshDebounceTimer = setTimeout(() => {
      this.refreshData();
    }, 500); // Wait 500ms before refreshing to batch multiple updates
  }

  private async refreshData() {
    logger.debug('🔄 Refreshing data from Supabase...');
    try {
      const data = await this.getData();
      this.cachedData = data;
      
      // Log what we got
      const totalTracked = data.tracking?.reduce((acc, row) => {
        if (Array.isArray(row)) {
          return acc + row.filter((cell, idx) => idx > 0 && cell === true).length;
        }
        return acc;
      }, 0) || 0;
      
      const totalStored = data.storage?.reduce((acc, row) => {
        if (Array.isArray(row)) {
          return acc + row.filter((cell, idx) => idx > 0 && cell === true).length;
        }
        return acc;
      }, 0) || 0;
      
      logger.debug(`📊 Data refreshed: ${totalTracked} tracked, ${totalStored} stored`);
      
      if (this.onDataUpdate) {
        logger.debug('🎯 Triggering onDataUpdate callback...');
        this.onDataUpdate(data);
      }
    } catch (error) {
      console.error('❌ Failed to refresh data:', error);
      this.onStatusChange?.('error');
      throw error;
    }
  }

  async getData(): Promise<SupabaseDataResponse> {
    const [orders, destinations, syncMeta, customItemRows, confirmationItems, latestWeekDate, daySplitsRows] = await Promise.all([
      this.supabase.getAllWeekData(),
      this.supabase.getDestinations(),
      this.getSyncMetadata(),
      this.supabase.getCustomItems(),
      this.supabase.getOrderConfirmationItems(),
      this.supabase.getLatestWeekDate(),
      this.fetchDaySplits(),
    ]);

    const derivedWeekDate = latestWeekDate ?? this.extractWeekDateFromOrders(orders);
    // Note: Inventory items and order suggestions are fetched separately via inventoryService

    let confirmationStatus: SupabaseDataResponse['orderConfirmationStatus'] = null;
    let resetEvents: Array<{ week_date: string; reset_by: string | null; reset_at: string }> = [];

    if (derivedWeekDate) {
      [confirmationStatus, resetEvents] = await Promise.all([
        this.supabase.getConfirmationStatus(derivedWeekDate),
        this.supabase.getOrderConfirmationResetEvents(derivedWeekDate),
      ]);
    }

    const converted = this.convertSupabaseToLegacyFormat(orders, destinations, syncMeta);
    converted.daySplits = daySplitsRows;
    converted.customItems = customItemRows.map((row) => ({
      id: row.item_id,
      destinationCode: row.destination_code,
      destinationName: row.destination_name,
      itemName: row.item_name,
      quantity: Number(row.quantity ?? 0),
      unit: row.unit ?? null,
      isPacked: row.is_packed,
      addedBy: row.added_by ?? null,
      inventoryItemId: row.inventory_item_id ?? null,
    }));

    // Add order confirmation data - filter to only Food Bank items (exclude Hub supplies)
    converted.orderConfirmationItems = confirmationItems
      .filter(item => {
        const itemName = item.itemName.toLowerCase();
        // Exclude Hub supply items
        if (itemName.includes('hub supply')) return false;
        if (itemName.includes('(hub')) return false;
        // Exclude Produce Market and Grocery Store items
        if (itemName.includes('produce market')) return false;
        if (itemName.includes('grocery store')) return false;
        if (itemName.includes('pm prepared')) return false;
        if (itemName.includes('gs box')) return false;
        // Exclude other non-Food Bank items
        if (itemName.includes('200 box')) return false;
        if (itemName.includes('meal box')) return false;
        if (itemName.includes('put back')) return false;
        if (itemName.includes('fork')) return false;
        return true;
      })
      .map(item => ({
        orderId: item.orderId,
        itemName: item.itemName,
        expectedQuantity: Number(item.expectedQuantity ?? 0),
        receivedQuantity: item.receivedQuantity !== null ? Number(item.receivedQuantity) : null,
        isConfirmed: item.isConfirmed,
        ranOut: item.ranOut,
        unit: item.unit,
        emoji: getEmojiForItem(item.itemName),
        storageType: item.storageType,
        confirmedBy: item.confirmedBy,
        confirmedAt: item.confirmedAt,
        sheetRow: converted.itemRowLookup?.[item.itemName] ?? null,
      }));

    converted.orderConfirmationStatus = confirmationStatus;
    converted.orderConfirmationResets = resetEvents.map(event => ({
      weekDate: event.week_date,
      resetBy: event.reset_by,
      resetAt: event.reset_at,
    }));
    converted.currentWeekDate = derivedWeekDate ?? null;
    // Inventory items are initialized empty here
    // and fetched separately via inventoryService.refreshInventory()
    converted.inventoryItems = [];

    this.cachedData = converted;
    return converted;
  }

  private async fetchDaySplits(): Promise<Array<{ allocationId: string; day: string; quantity: number }>> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await (client as any)
        .from('allocation_day_splits')
        .select('allocation_id, recipient, quantity')
        .eq('recipient_type', 'day');

      if (error) {
        logger.debug('Failed to fetch day splits:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        allocationId: row.allocation_id,
        day: row.recipient,
        quantity: Number(row.quantity),
      }));
    } catch {
      return [];
    }
  }

  private extractWeekDateFromOrders(orders: WeekDataRow[]): string | null {
    const orderWithWeek = (orders as Array<WeekDataRow & { week_date?: string | null }>).find(
      (order) => order.week_date
    );
    return orderWithWeek?.week_date ?? null;
  }

  private convertSupabaseToLegacyFormat(
    orders: WeekDataRow[],
    destinations: DestinationRow[],
    syncMeta: SyncMetadataRow,
  ): SupabaseDataResponse {
    
    // Initialize empty data structures
    const sheetData: SheetData = [];
    const trackingData: SheetData = [];
    const storageData: SheetData = [];
    const storageTypes: StorageTypes = {};
    const supplies: Supplies = { mealBoxes: {}, forks: {} };
    const destinationCodes: Record<string, string> = {};
    const allocationLookup: Record<string, AllocationMeta> = {};
    const customDestinationAllocations: CustomDestinationAllocation[] = [];
    const itemRowLookup: Record<string, number> = {};

    // Create destination map
    const destMap = new Map<string, keyof typeof COLUMN_MAP>();
    destinations.forEach((dest) => {
      const normalizedShortName = this.normalizeDestinationKey(dest.short_name || dest.name || dest.code);
      if (normalizedShortName) {
        destMap.set(dest.id, normalizedShortName);
        if (dest.code) {
          destinationCodes[normalizedShortName] = dest.code;
        }
      }
    });

    // Group orders by item name
    const itemGroups = new Map<string, WeekDataRow[]>();
    orders.forEach((order) => {
      if (!itemGroups.has(order.item_name)) {
        itemGroups.set(order.item_name, []);
      }
      itemGroups.get(order.item_name)!.push(order);
    });

    // Add header rows (aligned with current sheet layout)
    const headerRow = [
      'Item',
      'UOM',
      'Total Qty Limit',
      'Total Qty Requested',
      'Partner Group 7',
      'Partner Group 1',
      'Partner Group 2',
      'Partner Group 3',
      'Co-op B',
      'Co-op A',
      'Partner Group 4',
      'Partner Group 5',
      'Partner Group 6',
      'Co-op C',
      'Max out?',
      'Surplus',
      'Ran out?',
      'Storage Type'
    ];
    sheetData[0] = [...headerRow];
    sheetData[1] = [...headerRow];
    trackingData[0] = [...headerRow];
    trackingData[1] = [...headerRow];
    storageData[0] = [...headerRow];
    storageData[1] = [...headerRow];

    // Build rows for each item (starting from row 2 = sheet row 3)
    let rowIndex = 2;
    itemGroups.forEach((itemOrders, itemName) => {
      const dataRow: any[] = new Array(headerRow.length).fill('');
      const trackingRow: any[] = new Array(headerRow.length).fill(false);
      const storageRow: any[] = new Array(headerRow.length).fill(false);
      let rowRanOut = false;
      // Track quantities redirected to custom destinations (e.g., Partner 11/Partner 10 splits from Partner Group 6)
      let customRedirectedTotal = 0;

      dataRow[0] = itemName; // Item name
      trackingRow[0] = itemName;
      storageRow[0] = itemName;

      // Fill quantities and tracking status for each destination
      itemOrders.forEach((order: WeekDataRow) => {
        const mappedKey = destMap.get(order.destination_id);
        const rawDestKey: string | undefined = order.destination_code ?? mappedKey;
        const destShortName = this.normalizeDestinationKey(rawDestKey);
        if (destShortName && order.destination_code && !destinationCodes[destShortName]) {
          destinationCodes[destShortName] = order.destination_code;
        }

        const colIndex = this.getColumnIndexForDestination(destShortName);

        if (colIndex !== -1 && destShortName) {
          const allocationQty =
            order.allocated_quantity === null || order.allocated_quantity === undefined
              ? null
              : Number(order.allocated_quantity);
          const receivedQty =
            order.received_quantity === null || order.received_quantity === undefined
              ? null
              : Number(order.received_quantity);
          const orderQty =
            order.quantity === null || order.quantity === undefined ? null : Number(order.quantity);
          const orderRanOut = order.ran_out === true;
          const baseQuantity = receivedQty !== null ? receivedQty : allocationQty ?? orderQty ?? 0;
          const displayQuantity = orderRanOut ? 0 : baseQuantity;
          const hasConfirmedValue = receivedQty !== null || orderRanOut;
          const hasPositiveQuantity = displayQuantity > 0;
          const hasQuantity = hasPositiveQuantity;
          const shouldDisplay = hasPositiveQuantity || hasConfirmedValue;

          dataRow[colIndex] = shouldDisplay ? Number(displayQuantity) : '';
          trackingRow[colIndex] = hasPositiveQuantity && order.is_distributed === true;
          storageRow[colIndex] = hasPositiveQuantity && order.is_stored === true;

          if (orderRanOut) {
            rowRanOut = true;
          }

          if (hasQuantity && order.allocation_id) {
            const key = `${rowIndex}:${colIndex}`;
            allocationLookup[key] = {
              allocationId: order.allocation_id,
              destinationCode: order.destination_code,
              row: rowIndex,
              col: colIndex,
              isStored: order.is_stored === true,
              isDistributed: order.is_distributed === true,
            };
          }
        } else if (rawDestKey && order.allocation_id) {
          // This is an allocation to a custom destination (not in the sheet columns)
          // Check if it's a custom or surplus destination
          const destInfo = destinations.find((d) => d.id === order.destination_id);
          const isCustomOrSurplus = destInfo?.is_custom === true || destInfo?.code === 'surplus';

          if (isCustomOrSurplus) {
            // Skip items that ran out — nothing to pick up
            if (order.ran_out === true) {
              // Don't add to customDestinationAllocations
            } else {
              // Use received_quantity for confirmed items (handles Ran Low),
              // fall back to allocated_quantity for unconfirmed items
              const effectiveQty =
                order.is_confirmed && order.received_quantity != null
                  ? Number(order.received_quantity)
                  : order.allocated_quantity == null
                    ? 0
                    : Number(order.allocated_quantity);

              if (effectiveQty > 0) {
                customDestinationAllocations.push({
                  allocationId: order.allocation_id,
                  destinationId: order.destination_id,
                  destinationCode: order.destination_code ?? destInfo?.code ?? '',
                  itemName: order.item_name,
                  quantity: effectiveQty,
                  isStored: order.is_stored === true,
                  isDistributed: order.is_distributed === true,
                  emoji: getEmojiForItem(order.item_name),
                  storageType: order.storage_type,
                });
                // Track redirected qty so we can subtract from source column (surplus excluded)
                if (destInfo?.code !== 'surplus') {
                  customRedirectedTotal += effectiveQty;
                }
              }
            }
          } else {
            console.warn(`⚠️ Unable to map destination "${rawDestKey}" to a column for item "${itemName}"`);
          }
        }
      });

      // Subtract quantities redirected to custom destinations (Partner 11/Partner 10 splits)
      // from the source column. The split RPC creates additive allocation rows
      // without reducing the source allocation, so we adjust here.
      if (customRedirectedTotal > 0) {
        const splitCol = COLUMN_MAP.partner_6;
        const currentVal = Number(dataRow[splitCol]);
        if (Number.isFinite(currentVal) && currentVal > 0) {
          dataRow[splitCol] = Math.max(0, currentVal - customRedirectedTotal);
        }
      }

      dataRow[RAN_OUT_COLUMN_INDEX] = rowRanOut;
      const totalRequested = DESTINATION_COLUMNS.reduce((sum, colIndex) => {
        const value = Number(dataRow[colIndex]);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);
      dataRow[TOTAL_REQUESTED_COLUMN_INDEX] = totalRequested;

      const orderTotal = itemOrders[0]?.quantity ?? 0;
      // Non-allocated quantity from the order (items not assigned to any destination)
      dataRow[NON_ALLOCATED_COLUMN_INDEX] = (itemOrders[0] as any)?.non_allocated ?? 0;
      dataRow[SURPLUS_COLUMN_INDEX] = Math.max(0, Number(orderTotal) - totalRequested - customRedirectedTotal);

      sheetData[rowIndex] = dataRow;
      trackingData[rowIndex] = trackingRow;
      storageData[rowIndex] = storageRow;

      // Set normalized storage type (default to Pantry if missing)
      storageTypes[itemName] = this.normalizeStorageType(itemOrders[0]?.storage_type ?? null);
      dataRow[STORAGE_TYPE_COLUMN_INDEX] = storageTypes[itemName];
      itemRowLookup[itemName] = rowIndex;

      rowIndex++;
    });

    // Convert destinations to DestinationInfo format
    const destinationsInfo: DestinationInfo[] = destinations.map((dest) => ({
      id: dest.id,
      code: dest.code,
      name: dest.name,
      shortName: dest.short_name,
      timing: dest.timing,
      defaultTiming: dest.default_timing,
      isDirect: dest.is_direct ?? false,
      displayOrder: dest.display_order ?? 0,
      isCustom: dest.is_custom ?? false,
      isActive: dest.is_active ?? true,
    }));

    return {
      data: sheetData,
      tracking: trackingData,
      storage: storageData,
      storageTypes,
      customItems: [],
      supplies,
      destinations: destinationsInfo,
      orderConfirmationItems: [],
      orderConfirmationStatus: null,
      orderConfirmationResets: [],
      currentWeekDate: null,
      inventoryItems: [],
      destinationCodes,
      itemRowLookup,
      allocationLookup,
      customDestinationAllocations,
      daySplits: [],
      syncMetadata: syncMeta,
    };
  }

  private normalizeDestinationKey(value?: string | null): keyof typeof COLUMN_MAP | undefined {
    if (!value) return undefined;

    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Exact match against known column keys
    if (Object.prototype.hasOwnProperty.call(COLUMN_MAP, trimmed)) {
      return trimmed as keyof typeof COLUMN_MAP;
    }

    const lowerValue = trimmed.toLowerCase();

    const aliasMap: Record<string, keyof typeof COLUMN_MAP> = {
      'partner group 1': 'partner_1',
      'partner group 2': 'partner_2',
      'partner group 3': 'partner_3',
      'partner group 4': 'partner_4',
      'partner group 5': 'partner_5',
      'partner group 6': 'partner_6',
      'partner group 7': 'partner_7',
      'co-op a': 'coop_a',
      'co-op b': 'coop_b',
      'co-op c': 'coop_c',
      'coopa': 'coop_a',
      'coopb': 'coop_b',
      'coopc': 'coop_c',
    };

    if (aliasMap[lowerValue]) {
      return aliasMap[lowerValue];
    }

    // Handle short destination codes (e.g., CO-B, P1, etc.)
    const codeMap: Record<string, keyof typeof COLUMN_MAP> = {
      'P1': 'partner_1',
      'P2': 'partner_2',
      'P3': 'partner_3',
      'P4': 'partner_4',
      'P5': 'partner_5',
      'P6': 'partner_6',
      'P7': 'partner_7',
      'CO-A': 'coop_a',
      'CO-B': 'coop_b',
      'CO-C': 'coop_c',
    };

    const upperValue = trimmed.toUpperCase();
    if (codeMap[upperValue]) {
      return codeMap[upperValue];
    }

    return undefined;
  }

  private normalizeStorageType(value: string | null): string {
    if (!value) {
      return 'Pantry';
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return 'Pantry';
    }

    const lower = trimmed.toLowerCase();

    if (lower.includes('fridge') || lower.includes('refrigerat') || lower.includes('cooler')) {
      return 'Fridge';
    }

    if (lower.includes('freezer')) {
      return 'Freezer';
    }

    if (lower.includes('pantry') || lower.includes('dry') || lower.includes('table')) {
      return 'Pantry';
    }

    // Default: capitalize the first letter for display
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  private getColumnIndexForDestination(destShortName?: keyof typeof COLUMN_MAP): number {
    if (!destShortName) return -1;

    // Keep Supabase mapping aligned with the sheet column map defined in constants.
    // We already encode the 0-based indices (including Surplus offset) in COLUMN_MAP,
    // so reuse it directly to avoid off-by-one drift.
    return COLUMN_MAP[destShortName] ?? -1;
  }

  async toggleItem(row: number, col: number, mode: 'storage' | 'tracking') {
    if (!this.cachedData) {
      await this.getData();
    }

    const cached = this.cachedData;
    const key = `${row}:${col}`;
    const meta = cached?.allocationLookup[key];

    if (!meta) {
      throw new Error(`No allocation metadata for row=${row}, col=${col}`);
    }

    if (mode === 'storage') {
      await this.supabase.toggleStorage(meta.allocationId);
      meta.isStored = !meta.isStored;
    } else {
      await this.supabase.toggleDistribution(meta.allocationId);
      meta.isDistributed = !meta.isDistributed;
    }
  }

  async markGroupPacked(destination: string, packed: boolean, mode: 'storage' | 'tracking') {
    const colIndex = COLUMN_MAP[destination];

    if (typeof colIndex !== 'number') {
      throw new Error(`Invalid destination: ${destination}`);
    }

    if (!this.cachedData) {
      await this.getData();
    }

    const data = this.cachedData;
    if (!data) {
      throw new Error('Cached data unavailable for bulk update');
    }

    const pendingOperations: Array<Promise<unknown>> = [];
    let processed = 0;

    Object.values(data.allocationLookup).forEach((meta) => {
      if (meta.col !== colIndex) {
        return;
      }

      const shouldBePacked = mode === 'storage' ? meta.isStored : meta.isDistributed;
      if (shouldBePacked === packed) {
        return;
      }

      processed += 1;
      if (mode === 'storage') {
        pendingOperations.push(
          this.supabase.toggleStorage(meta.allocationId).then(() => {
            meta.isStored = !meta.isStored;
          })
        );
      } else {
        pendingOperations.push(
          this.supabase.toggleDistribution(meta.allocationId).then(() => {
            meta.isDistributed = !meta.isDistributed;
          })
        );
      }
    });

    if (pendingOperations.length === 0) {
      return 0;
    }

    const results = await Promise.allSettled(pendingOperations);
    const successCount = results.filter((result) => result.status === 'fulfilled').length;

    if (successCount > 0) {
      await this.refreshData();
    }

    logger.debug(`📦 Pack All (${mode}) for ${destination}: ${successCount}/${processed} updated`);
    return successCount;
  }

  async addCustomItem(name: string, quantity: string, destination: string) {
    await this.supabase.addCustomItemWrapper({ name, quantity, destination });
  }

  async getCustomItems() {
    return await this.supabase.getCustomItems();
  }

  async toggleCustomItemPacked(itemId: string) {
    return await this.supabase.toggleCustomItemPacked(itemId);
  }

  async deleteCustomItem(itemId: string) {
    await this.supabase.deleteCustomItemWrapper(itemId);
  }


  async getSyncMetadata() {
    return this.supabase.getSyncMetadata();
  }

  // Order Confirmation Methods (proxy to supabase service)
  async confirmItemAtExpected(orderId: string, confirmedBy?: string): Promise<void> {
    await this.supabase.confirmItemAtExpected(orderId, confirmedBy);
  }

  async updateAllocationsProportionally(
    orderId: string,
    receivedQuantity: number,
    confirmedBy?: string
  ): Promise<Array<{
    allocation_id: string;
    destination_code: string;
    original_qty: number;
    new_qty: number;
  }>> {
    return await this.supabase.updateAllocationsProportionally(orderId, receivedQuantity, confirmedBy);
  }

  async markItemRanOut(orderId: string, confirmedBy?: string): Promise<void> {
    await this.supabase.markItemRanOut(orderId, confirmedBy);
  }

  async unmarkItemRanOut(orderId: string): Promise<void> {
    await this.supabase.unmarkItemRanOut(orderId);
  }

  async confirmAllItemsAtExpected(weekDate: string, confirmedBy?: string): Promise<number> {
    return await this.supabase.confirmAllItemsAtExpected(weekDate, confirmedBy);
  }

  async resetConfirmations(weekDate: string, confirmedBy?: string): Promise<number> {
    return await this.supabase.resetConfirmations(weekDate, confirmedBy);
  }

  /**
   * Start fallback polling that only kicks in when real-time is disconnected
   * or no events have been received recently
   */
  private startFallbackPolling() {
    logger.debug(`⏱️ Starting fallback polling timer (${this.pollingInterval / 1000}s interval)`);

    const checkAndPoll = () => {
      const timeSinceLastEvent = Date.now() - this.lastRealtimeEventTime;
      const shouldPoll =
        !this.isRealtimeConnected || // Real-time is disconnected
        timeSinceLastEvent > 60000; // No events in 60 seconds

      if (shouldPoll) {
        const reason = !this.isRealtimeConnected ? 'disconnected' : `no events for ${Math.floor(timeSinceLastEvent / 1000)}s`;
        logger.debug(`📊 Fallback polling triggered (reason: ${reason})`);
        // Reset timer reference to avoid runaway "no events for decades" logs
        this.lastRealtimeEventTime = Date.now();
        this.onStatusChange?.('polling');
        this.refreshData();
      }

      // Schedule next check
      this.pollingTimer = setTimeout(checkAndPoll, this.currentPollingInterval);
    };

    // Start polling
    checkAndPoll();
  }

  /**
   * Stop fallback polling (used during cleanup)
   */
  private stopFallbackPolling() {
    if (this.pollingTimer) {
      logger.debug('⏱️ Stopping fallback polling timer');
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Get sync status information for UI display
   */
  getSyncStatus(): {
    isConnected: boolean;
    lastEventTime: number;
    method: 'realtime' | 'polling' | 'unknown';
    timeSinceLastEvent: number;
  } {
    const timeSinceLastEvent = this.lastRealtimeEventTime > 0 ? Date.now() - this.lastRealtimeEventTime : -1;

    return {
      isConnected: this.isRealtimeConnected,
      lastEventTime: this.lastRealtimeEventTime,
      method: this.isRealtimeConnected ? 'realtime' : timeSinceLastEvent > 60000 ? 'polling' : 'unknown',
      timeSinceLastEvent,
    };
  }

  cleanup() {
    // Stop polling
    this.stopFallbackPolling();

    // Prevent any pending retry timers from re-subscribing after cleanup
    this.realtimeRetryCount = this.maxRealtimeRetries;

    // Clean up subscriptions
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions = [];

    // Allow re-initialization after cleanup
    this.isInitialized = false;

    logger.debug('🧹 SupabaseDataService cleaned up');
  }
}
