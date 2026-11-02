import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { getEmojiForItem } from '../utils/helpers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { logger } from '@/lib/logger';

// Types returned by various Supabase RPC helpers
type DestinationRow = Database['public']['Tables']['destinations']['Row'];
type WeekDataRow = Database['public']['Functions']['get_all_week_data']['Returns'][number];
type SupplyStatusRow = Database['public']['Functions']['get_all_supplies_status']['Returns'][number];
type CustomItemSummary = Database['public']['Functions']['get_all_custom_items']['Returns'][number];
type SurplusClaimRow = Database['public']['Tables']['surplus_claims']['Row'];
type SurplusGroupRow = Database['public']['Tables']['surplus_groups']['Row'];
export type ReplaceWeekDataArgs = Database['public']['Functions']['replace_week_data']['Args'];
type SyncMetadataRow = { last_modified_at: string; modified_by: string | null };

// Local types for import data arrays (Supabase types are JSON which is too broad)
type ImportOrder = {
  item_name: string;
  quantity: number;
  unit?: string | null;
  storage_type?: string | null;
  ran_out?: boolean | null;
  non_allocated?: number | null;
};
type ImportAllocation = {
  item_name: string;
  destination_code: string;
  quantity: number;
};

// Schedule history types
export type ScheduleHistoryEntry = {
  id: string;
  destination_id: string;
  destination_name: string;
  previous_timing: string | null;
  new_timing: string;
  changed_by: string | null;
  changed_at: string | null;
  week_date: string | null;
};

type CustomItemPayload = {
  destinationId: string;
  itemName: string;
  quantity: number;
  weekDate: string;
  unit?: string | null;
  addedBy?: string | null;
};

export class SupabaseService {
  private static instance: SupabaseService;

  private readonly client: SupabaseClient<Database>;
  private readonly channels: Map<string, RealtimeChannel> = new Map();
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor(url?: string, anonKey?: string) {
    const supabaseUrl = url || SUPABASE_URL;
    const supabaseAnonKey = anonKey || SUPABASE_ANON_KEY;

    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL and Anon Key are required');
    }

    const persistSession = this.checkLocalStorageAvailable();

    this.client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession,
        autoRefreshToken: true,
        storage: persistSession
          ? undefined
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            },
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  /**
   * Fallback direct REST call for environments where the Supabase client fetch
   * may be blocked (e.g., Safari quirks with service workers/caching).
   */
  private async directRpc<T>(fnName: string, payload: Record<string, unknown> = {}): Promise<T> {
    const url = `${this.supabaseUrl}/rest/v1/rpc/${fnName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.supabaseAnonKey,
        Authorization: `Bearer ${this.supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Direct RPC ${fnName} failed (${res.status}): ${text}`);
    }

    return (await res.json()) as T;
  }

  private checkLocalStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      window.localStorage.setItem(test, test);
      window.localStorage.removeItem(test);
      logger.debug('✅ localStorage available - Supabase will persist session');
      return true;
    } catch (error) {
      // Determine the specific reason for failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      if (errorName === 'QuotaExceededError' || errorMessage.includes('quota')) {
        console.error('❌ localStorage QUOTA EXCEEDED - Supabase will use memory-only session', {
          error: errorMessage,
          suggestion: 'User needs to clear browser data or localStorage',
        });
      } else if (!window.localStorage) {
        console.error('❌ localStorage NOT AVAILABLE (disabled or private mode) - Supabase will use memory-only session', {
          error: errorMessage,
          suggestion: 'Exit private browsing or enable localStorage',
        });
      } else {
        console.error('❌ localStorage ACCESS FAILED (corrupted or blocked) - Supabase will use memory-only session', {
          error: errorMessage,
          errorName,
          suggestion: 'Browser may have corrupted localStorage - try clearing site data',
        });
      }

      return false;
    }
  }

  static getInstance(url?: string, anonKey?: string): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService(url, anonKey);
    }
    return SupabaseService.instance;
  }

  /**
   * Get the raw Supabase client for direct queries
   * Use this when you need to make queries not covered by existing methods
   */
  getClient(): SupabaseClient<Database> {
    return this.client;
  }

  // ---------- Core data fetchers ----------

  async getAllWeekData(): Promise<WeekDataRow[]> {
    try {
      const { data, error } = await this.client.rpc('get_all_week_data');
      if (error) {
        throw error;
      }
      const rows = data ?? [];
      return rows.map((row) => ({
        ...row,
        // Supabase returns NUMERIC columns as strings; normalize to numbers for app logic
        quantity:
          row.quantity === null || row.quantity === undefined
            ? row.quantity
            : Number(row.quantity),
        allocated_quantity:
          row.allocated_quantity === null || row.allocated_quantity === undefined
            ? row.allocated_quantity
            : Number(row.allocated_quantity),
        received_quantity:
          row.received_quantity === null || row.received_quantity === undefined
            ? row.received_quantity
            : Number(row.received_quantity),
      }));
    } catch (error) {
      console.warn('⚠️ getAllWeekData via client failed, using direct RPC fallback:', error);
      const data = await this.directRpc<WeekDataRow[]>('get_all_week_data');
      return (data ?? []).map((row) => ({
        ...row,
        quantity:
          (row as any).quantity === null || (row as any).quantity === undefined
            ? (row as any).quantity
            : Number((row as any).quantity),
        allocated_quantity:
          (row as any).allocated_quantity === null || (row as any).allocated_quantity === undefined
            ? (row as any).allocated_quantity
            : Number((row as any).allocated_quantity),
        received_quantity:
          (row as any).received_quantity === null || (row as any).received_quantity === undefined
            ? (row as any).received_quantity
            : Number((row as any).received_quantity),
      }));
    }
  }

  async getAllSuppliesStatus(): Promise<SupplyStatusRow[]> {
    const { data, error } = await this.client.rpc('get_all_supplies_status');
    if (error) {
      console.error('Error fetching supplies:', error);
      throw error;
    }
    const rows = data ?? [];
    return rows.map((row) => ({
      ...row,
      quantity:
        row.quantity === null || row.quantity === undefined ? row.quantity : Number(row.quantity),
    }));
  }

  async getDestinations(): Promise<DestinationRow[]> {
    try {
      const { data, error } = await this.client
        .from('destinations')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      }

      return data ?? [];
    } catch (error) {
      console.warn('⚠️ getDestinations via client failed, using direct RPC fallback:', error);
      // No direct RPC exists; use REST table endpoint
      const url = `${this.supabaseUrl}/rest/v1/destinations?select=*&order=display_order.asc`;
      const res = await fetch(url, {
        headers: {
          apikey: this.supabaseAnonKey,
          Authorization: `Bearer ${this.supabaseAnonKey}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Direct destinations fetch failed (${res.status}): ${text}`);
      }
      return (await res.json()) as DestinationRow[];
    }
  }

  // ---------- Allocation toggles ----------

  async toggleStorage(allocationId: string, userName = 'system'): Promise<boolean> {
    const { data, error } = await this.client.rpc('toggle_storage', {
      p_allocation_id: allocationId,
      p_user_name: userName,
    });

    if (error) {
      console.error('Error toggling storage:', error);
      throw error;
    }

    return data ?? false;
  }

  async toggleDistribution(allocationId: string, userName = 'system'): Promise<boolean> {
    const { data, error } = await this.client.rpc('toggle_distribution', {
      p_allocation_id: allocationId,
      p_user_name: userName,
    });

    if (error) {
      console.error('Error toggling distribution:', error);
      throw error;
    }

    return data ?? false;
  }

  async toggleCustomItemPacked(itemId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('toggle_custom_item_packed', {
      p_item_id: itemId,
    });

    if (error) {
      console.error('Error toggling custom item:', error);
      throw error;
    }

    return data ?? false;
  }

  async toggleSupplyPacked(supplyId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('toggle_supply_packed', {
      p_supply_id: supplyId,
    });

    if (error) {
      console.error('Error toggling supply:', error);
      throw error;
    }

    return data ?? false;
  }

  // ---------- Custom items ----------

  async getCustomItems(): Promise<CustomItemSummary[]> {
    const { data, error } = await this.client.rpc('get_all_custom_items');
    if (error) {
      const message = (error.message || '').toLowerCase();
      const hint = (error.hint || '').toLowerCase();
      const isMissingFunction =
        error.code === 'PGRST301' ||
        error.code === 'PGRST404' ||
        error.code === '42883' ||
        message.includes('not found') ||
        message.includes('does not exist') ||
        hint.includes('not found');

      if (isMissingFunction) {
        console.warn(
          '⚠️ Custom items RPC `get_all_custom_items` is not available; continuing with no custom items.',
          error
        );
        return [];
      }

      console.error('Error fetching custom items:', error);
      throw error;
    }
    const rows = data ?? [];
    return rows.map((row) => ({
      ...row,
      quantity:
        row.quantity === null || row.quantity === undefined ? row.quantity : Number(row.quantity),
    }));
  }

  private async createCustomItem(payload: CustomItemPayload): Promise<void> {
    const { destinationId, itemName, quantity, weekDate, unit, addedBy } = payload;
    const { error } = await this.client.from('custom_items').insert({
      destination_id: destinationId,
      item_name: itemName,
      quantity,
      week_date: weekDate,
      unit: unit ?? null,
      added_by: addedBy ?? 'system',
      is_packed: false,
    });

    if (error) {
      console.error('Error creating custom item:', error);
      throw error;
    }
  }

  async addCustomItemWrapper(item: { name: string; quantity: string; destination: string }) {
    const destinations = await this.getDestinations();
    const destination = destinations.find((dest) => dest.short_name === item.destination);

    if (!destination) {
      throw new Error(`Destination not found for short name: ${item.destination}`);
    }

    const quantity = parseFloat(item.quantity);
    if (Number.isNaN(quantity)) {
      throw new Error(`Invalid quantity for custom item: ${item.quantity}`);
    }

    const currentDate = new Date().toISOString().split('T')[0];

    await this.createCustomItem({
      destinationId: destination.id,
      itemName: item.name,
      quantity,
      weekDate: currentDate,
      unit: null,
      addedBy: 'system',
    });
  }

  async deleteCustomItemWrapper(itemId: string) {
    const { error } = await this.client.from('custom_items').delete().eq('id', itemId);
    if (error) {
      console.error('Error deleting custom item:', error);
      throw error;
    }
  }

  // ---------- Bulk imports ----------

  async clearAndImportData(
    orders: ImportOrder[],
    allocations: ImportAllocation[],
    weekDate: string,
  ): Promise<{ orders_upserted: number; allocations_upserted: number; warnings: string[] }> {
    logger.debug('🔄 Starting atomic import via RPC...', {
      ordersCount: orders.length,
      allocationsCount: allocations.length,
      weekDate,
    });

    const warnings: string[] = [];
    const parsedWeekDate = weekDate.includes('T') ? weekDate.split('T')[0] : weekDate;

    try {
      // Deduplicate orders by item_name - aggregate quantities for duplicates
      const orderDedupeMap = new Map<string, {
        item_name: string;
        quantity: number;
        unit: string | null | undefined;
        storage_type: string | null | undefined;
        ran_out: boolean | null | undefined;
        non_allocated: number;
      }>();

      for (const o of orders) {
        const key = o.item_name;
        const existing = orderDedupeMap.get(key);
        if (existing) {
          existing.quantity = (existing.quantity || 0) + (o.quantity || 0);
          existing.non_allocated = (existing.non_allocated || 0) + (o.non_allocated || 0);
          logger.debug(`⚠️ Duplicate item "${key}" found - aggregating quantities (new total: ${existing.quantity})`);
        } else {
          orderDedupeMap.set(key, {
            item_name: o.item_name,
            quantity: o.quantity || 0,
            unit: o.unit,
            storage_type: o.storage_type,
            ran_out: o.ran_out,
            non_allocated: o.non_allocated || 0,
          });
        }
      }

      const dedupedOrders = Array.from(orderDedupeMap.values());
      logger.debug(`📊 Deduplicated ${orders.length} orders → ${dedupedOrders.length} unique items`);

      // Call atomic RPC — all deletes + inserts happen in a single transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (this.client as any).rpc('clear_and_import_week_data', {
        p_orders: dedupedOrders,
        p_allocations: allocations,
        p_week_date: parsedWeekDate,
      });

      if (error) {
        console.error('❌ Atomic import RPC failed:', error);
        throw error;
      }

      const result = data as { orders_upserted: number; allocations_upserted: number; allocations_skipped: number };
      logger.debug('✅ Atomic import complete:', result);

      if (result.allocations_skipped > 0) {
        warnings.push(`${result.allocations_skipped} allocation(s) skipped (unknown destination or order)`);
      }

      // Release banked items from previous weeks (non-critical, separate from atomic import)
      try {
        logger.debug('🏦 Releasing banked items...');
        const bankResult = await this.releaseBankedItems(parsedWeekDate);
        if (bankResult.itemsReleased > 0) {
          logger.debug(`🏦 Released ${bankResult.itemsReleased} banked items: ${bankResult.allocationsCreated} new allocations, ${bankResult.allocationsAugmented} augmented`);
        }
      } catch (bankError) {
        console.warn('⚠️ Failed to release banked items:', bankError);
      }

      return {
        orders_upserted: result.orders_upserted,
        allocations_upserted: result.allocations_upserted,
        warnings,
      };
    } catch (err) {
      console.error('❌ Import failed:', err);
      throw err;
    }
  }

  async syncFromSheets(
    orders: ImportOrder[],
    allocations: ImportAllocation[],
    weekDate: string,
  ) {
    return this.clearAndImportData(orders, allocations, weekDate);
  }

  async clearResetHistory(weekDate: string): Promise<void> {
    const { error } = await this.client
      .from('order_confirmation_resets')
      .delete()
      .eq('week_date', weekDate);

    if (error) {
      console.error('Error clearing reset history:', error);
      throw error;
    }
  }

  /**
   * Import non-allocated quantities from orders to inventory for a given week.
   * Uses additive logic - adds to existing inventory counts.
   * Note: RPC function not in generated types yet - using type assertion.
   */
  async importNonAllocatedToInventory(weekDate: string): Promise<{ item_name: string; quantity_imported: number }[]> {
    const parsedWeekDate = weekDate.includes('T') ? weekDate.split('T')[0] : weekDate;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client as any).rpc('import_non_allocated_to_inventory', {
      p_week_date: parsedWeekDate
    });

    if (error) {
      console.error('Error importing non-allocated to inventory:', error);
      throw error;
    }

    const result = (data || []) as { item_name: string; quantity_imported: number }[];
    if (result.length > 0) {
      logger.debug(`📦 Imported ${result.length} item(s) to inventory:`, result.map(r => `${r.item_name}: ${r.quantity_imported}`));
    }
    return result;
  }

  // ---------- Realtime subscriptions ----------

  subscribeToCustomItems(
    callback: (payload: unknown) => void,
    statusCallback?: (status: string, error?: Error) => void
  ): () => void {
    const channel = this.client
      .channel('custom-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_items' }, callback)
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('✅ Real-time subscribed: custom_items');
          statusCallback?.('connected', undefined);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error (custom_items):', error);
          statusCallback?.('error', error instanceof Error ? error : new Error(String(error)));
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Real-time subscription timed out (custom_items)');
          statusCallback?.('timeout', new Error('Subscription timed out'));
        } else if (status === 'CLOSED') {
          console.warn('🔌 Real-time subscription closed (custom_items)');
          statusCallback?.('disconnected', undefined);
        }
      });

    return () => channel.unsubscribe();
  }

  subscribeToAllTrackingUpdates(
    callback: (payload: unknown) => void,
    statusCallback?: (status: string, error?: Error) => void
  ): () => void {
    const channelName = 'tracking-all';

    if (this.channels.has(channelName)) {
      logger.debug('🔄 Unsubscribing existing tracking-all channel before re-subscribing');
      this.channels.get(channelName)!.unsubscribe();
    }

    // Only subscribe to tables that actually exist in the database
    // Note: custom_items and supplies tables don't exist
    const channel = this.client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storage_tracking' }, (payload) =>
        callback({ type: 'storage', ...payload }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'distribution_tracking' }, (payload) =>
        callback({ type: 'distribution', ...payload }),
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('✅ Real-time subscribed: tracking-all (2 tables: storage_tracking, distribution_tracking)');
          statusCallback?.('connected', undefined);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error (tracking-all):', error);
          statusCallback?.('error', error instanceof Error ? error : new Error(String(error)));
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Real-time subscription timed out (tracking-all)');
          statusCallback?.('timeout', new Error('Subscription timed out'));
        } else if (status === 'CLOSED') {
          console.warn('🔌 Real-time subscription closed (tracking-all)');
          statusCallback?.('disconnected', undefined);
        }
      });

    this.channels.set(channelName, channel);

    return () => {
      logger.debug('🔌 Unsubscribing from tracking-all channel');
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  subscribeToOrderUpdates(
    callback: (payload: unknown) => void,
    statusCallback?: (status: string, error?: Error) => void
  ): () => void {
    const channel = this.client
      .channel('orders-allocations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) =>
        callback({ type: 'orders', ...payload }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, (payload) =>
        callback({ type: 'allocations', ...payload }),
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('✅ Real-time subscribed: orders-allocations');
          statusCallback?.('connected', undefined);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error (orders-allocations):', error);
          statusCallback?.('error', error instanceof Error ? error : new Error(String(error)));
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Real-time subscription timed out (orders-allocations)');
          statusCallback?.('timeout', new Error('Subscription timed out'));
        } else if (status === 'CLOSED') {
          console.warn('🔌 Real-time subscription closed (orders-allocations)');
          statusCallback?.('disconnected', undefined);
        }
      });

    return () => channel.unsubscribe();
  }

  // ---------- Diagnostics & metadata ----------

  async testConnection() {
    try {
      const { error } = await this.client.from('destinations').select('id').limit(1);
      if (error) {
        throw error;
      }
      return { connected: true, error: null };
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string; hint?: string; code?: string };
      return {
        connected: false,
        error: {
          message: err.message || 'Unknown error',
          details: err.stack || '',
          hint: err.hint || '',
          code: err.code || '',
        },
      };
    }
  }

  async getSyncMetadata(): Promise<SyncMetadataRow | null> {
    const { data, error } = await this.client
      .from('sync_metadata')
      .select('last_modified_at, modified_by')
      .order('last_modified_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch sync metadata:', error);
      return null;
    }

    return data ?? null;
  }

  async updateSyncMetadata(sheetDate: string): Promise<void> {
    const { error } = await this.client.from('sync_metadata').upsert({
      last_modified_at: sheetDate,
      modified_by: 'Google Sheets (Cell B1)',
    });

    if (error) {
      console.error('❌ Failed to update sync metadata:', error);
      throw error;
    }
  }

  // ---------- Order Confirmation Methods ----------

  /**
   * Get confirmation status for a given week
   * @param weekDate - Date string in ISO format (YYYY-MM-DD)
   * @returns Status with total items, confirmed items, and whether all confirmed
   */
  async getConfirmationStatus(weekDate: string): Promise<{
    totalItems: number;
    confirmedItems: number;
    allConfirmed: boolean;
  }> {
    const { data, error } = await this.client.rpc('get_confirmation_status', {
      p_week_date: weekDate,
    });

    if (error) {
      console.error('Error fetching confirmation status:', error);
      throw error;
    }

    const result = data?.[0];
    if (!result) {
      return { totalItems: 0, confirmedItems: 0, allConfirmed: false };
    }

    return {
      totalItems: Number(result.total_items || 0),
      confirmedItems: Number(result.confirmed_items || 0),
      allConfirmed: result.all_confirmed || false,
    };
  }

  /**
   * Confirm an item at its full expected quantity (no shortages)
   * @param orderId - UUID of the order
   * @param confirmedBy - Name of person confirming
   */
  async confirmItemAtExpected(orderId: string, confirmedBy?: string): Promise<void> {
    const { error } = await this.client.rpc('confirm_item_at_expected', {
      p_order_id: orderId,
      p_confirmed_by: confirmedBy,
    });

    if (error) {
      console.error('Error confirming item at expected quantity:', error);
      throw error;
    }
  }

  /**
   * Update allocations proportionally based on received quantity
   * @param orderId - UUID of the order
   * @param receivedQuantity - Actual quantity received
   * @param confirmedBy - Name of person confirming
   * @returns Array of allocation updates showing original and new quantities
   */
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
    const { data, error } = await this.client.rpc('update_allocations_proportionally', {
      p_order_id: orderId,
      p_received_quantity: receivedQuantity,
      p_confirmed_by: confirmedBy ?? undefined,
    });

    if (error) {
      console.error('Error updating allocations proportionally:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Mark an item as completely unavailable (ran out)
   * @param orderId - UUID of the order
   * @param confirmedBy - Name of person confirming
   */
  async markItemRanOut(orderId: string, confirmedBy?: string): Promise<void> {
    const { error } = await this.client.rpc('mark_item_ran_out', {
      p_order_id: orderId,
      p_confirmed_by: confirmedBy ?? undefined,
    });

    if (error) {
      console.error('Error marking item as ran out:', error);
      throw error;
    }
  }

  /**
   * Restore an item from the ran-out state back to pending so the volunteer
   * can confirm with the actual received quantity. Inverse of markItemRanOut.
   *
   * Use case: Food Bank told us "ran out" but at pickup we discovered we actually
   * got some/all of the order.
   *
   * Resets:
   *   - orders.ran_out -> false
   *   - allocations: received_quantity=NULL, is_confirmed=false, clears confirmed_at/by
   *   - allocated_quantity is preserved (volunteer adjusts via RanLowModal if partial)
   *   - inventory_items NOT restored (confirm flow rebuilds it)
   *
   * @param orderId - UUID of the order
   */
  async unmarkItemRanOut(orderId: string): Promise<void> {
    const { error } = await (this.client as any).rpc('unmark_item_ran_out', {
      p_order_id: orderId,
    });

    if (error) {
      console.error('Error unmarking item as ran out:', error);
      throw error;
    }
  }

  /**
   * Confirm all unconfirmed items for a week at their expected quantities
   * @param weekDate - Date string in ISO format (YYYY-MM-DD)
   * @param confirmedBy - Name of person confirming
   * @returns Number of items confirmed
   */
  async confirmAllItemsAtExpected(weekDate: string, confirmedBy?: string): Promise<number> {
    const { data, error } = await this.client.rpc('confirm_all_items_at_expected', {
      p_week_date: weekDate,
      p_confirmed_by: confirmedBy ?? undefined,
    });

    if (error) {
      console.error('Error confirming all items:', error);
      throw error;
    }

    return Number(data || 0);
  }

  /**
   * Reset all confirmations for a specific week
   * @param weekDate - Date string in ISO format (YYYY-MM-DD)
   * @returns Number of allocations reset
   */
  async resetConfirmations(weekDate: string, resetBy?: string): Promise<number> {
    const { data, error } = await (this.client as any).rpc('reset_confirmations', {
      p_week_date: weekDate,
      p_reset_by: resetBy ?? null,
    });

    if (error) {
      console.error('Error resetting confirmations:', error);
      throw error;
    }

    return Number(data || 0);
  }

  /**
   * Get all orders for order confirmation screen
   * Uses optimized database function to fetch all data in one query
   */
  async getOrderConfirmationItems(_weekDate?: string): Promise<Array<{
    orderId: string;
    itemName: string;
    expectedQuantity: number;
    receivedQuantity: number | null;
    isConfirmed: boolean;
    ranOut: boolean;
    unit: string | null;
    storageType: string | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
  }>> {
    const { data, error } = await this.client.rpc('get_order_confirmation_items');

    if (error) {
      console.error('Error fetching order confirmation items:', error);
      throw error;
    }

    const items = data ?? [];

    return items.map((item) => ({
      orderId: item.order_id,
      itemName: item.item_name,
      expectedQuantity: Number(item.expected_quantity),
      receivedQuantity: item.received_quantity ? Number(item.received_quantity) : null,
      isConfirmed: item.is_confirmed || false,
      ranOut: item.ran_out || false,
      unit: item.unit,
      storageType: item.storage_type,
      confirmedBy: item.confirmed_by,
      confirmedAt: item.confirmed_at,
    }));
  }

  async getOrderConfirmationResetEvents(
    weekDate: string,
    limit = 5
  ): Promise<Array<{
    week_date: string;
    reset_by: string | null;
    reset_at: string;
  }>> {
    const { data, error } = await this.client
      .from('order_confirmation_resets')
      .select('week_date, reset_by, reset_at')
      .eq('week_date', weekDate)
      .order('reset_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching reset history:', error);
      throw error;
    }

    return data ?? [];
  }

  async getLatestWeekDate(): Promise<string | null> {
    const { data, error } = await this.client
      .from('orders')
      .select('week_date')
      .order('week_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest week date:', error);
      throw error;
    }

    return data?.week_date ?? null;
  }

  async getSurplusClaims(weekDate: string): Promise<SurplusClaimRow[]> {
    const { data, error } = await this.client
      .from('surplus_claims')
      .select('*')
      .eq('week_date', weekDate)
      .order('claimed_at', { ascending: false });

    if (error) {
      console.error('Error fetching surplus claims:', error);
      throw error;
    }

    return data ?? [];
  }

  async addSurplusClaim(
    orderId: string,
    weekDate: string,
    groupName: string,
    quantity: number,
    claimedBy: string
  ): Promise<boolean> {
    const { error } = await this.client.from('surplus_claims').insert({
      order_id: orderId,
      week_date: weekDate,
      group_name: groupName,
      quantity_claimed: quantity,
      claimed_by: claimedBy,
    });

    if (error) {
      console.error('Error creating surplus claim:', error);
      throw error;
    }

    return true;
  }

  async deleteSurplusClaim(claimId: string): Promise<boolean> {
    const { error } = await this.client.from('surplus_claims').delete().eq('id', claimId);

    if (error) {
      console.error('Error deleting surplus claim:', error);
      throw error;
    }

    return true;
  }

  async setSurplusClaimsPicked(
    claimIds: string[],
    picked: boolean,
    pickedBy: string,
    _quantitiesById?: Record<string, number | null | undefined>
  ): Promise<boolean> {
    if (!claimIds || claimIds.length === 0) return true;

    const timestamp = picked ? new Date().toISOString() : null;

    const { error } = await this.client
      .from('surplus_claims')
      .update({
        picked_up: picked,
        picked_up_qty: picked ? null : 0,
        picked_up_by: picked ? pickedBy : null,
        picked_up_at: timestamp,
      })
      .in('id', claimIds);

    if (error) {
      console.error('Error updating surplus claim pickup state:', error);
      throw error;
    }

    return true;
  }

  async getSurplusGroups(): Promise<SurplusGroupRow[]> {
    const { data, error } = await this.client
      .from('surplus_groups')
      .select('*')
      .eq('is_active', true)
      .order('date_added', { ascending: true });

    if (error) {
      console.error('Error fetching surplus groups:', error);
      throw error;
    }

    return data ?? [];
  }

  async addSurplusGroup(groupName: string): Promise<boolean> {
    const trimmed = groupName.trim();
    if (!trimmed) return false;

    const { error } = await this.client.from('surplus_groups').upsert({
      group_name: trimmed,
      is_active: true,
    });

    if (error) {
      console.error('Error adding surplus group:', error);
      throw error;
    }

    return true;
  }

  async deactivateSurplusGroup(groupName: string): Promise<boolean> {
    const { error } = await this.client
      .from('surplus_groups')
      .update({ is_active: false })
      .eq('group_name', groupName);

    if (error) {
      console.error('Error deactivating surplus group:', error);
      throw error;
    }

    return true;
  }

  // ---------- Schedule Management ----------

  /**
   * Update a destination's timing and auto-archive the change
   * @param destinationId - UUID of the destination
   * @param newTiming - New timing string (e.g., "Saturday AM")
   * @param changedBy - Name of person making the change
   */
  async updateDestinationTiming(
    destinationId: string,
    newTiming: string,
    changedBy?: string
  ): Promise<void> {
    const { error } = await this.client.rpc('update_destination_timing', {
      p_destination_id: destinationId,
      p_new_timing: newTiming,
      p_changed_by: changedBy ?? undefined,
    });

    if (error) {
      console.error('Error updating destination timing:', error);
      throw error;
    }
  }

  /**
   * Reset all destination timings to their default values
   * Called during Clear & Import
   */
  async resetDestinationTimings(): Promise<void> {
    const { error } = await this.client.rpc('reset_destination_timings');

    if (error) {
      console.error('Error resetting destination timings:', error);
      throw error;
    }
  }

  // ---------- Item Redirection & Custom Destinations ----------

  /**
   * Redirect items from one destination to another
   * Deducts from source allocation, adds to target, and logs the redirection
   * @param allocationId - UUID of the source allocation
   * @param targetDestinationId - UUID of the target destination
   * @param quantity - Amount to redirect
   * @param redirectedBy - Name of person redirecting
   * @returns Object with source remaining qty, target new qty, and target allocation ID
   */
  async redirectItem(
    allocationId: string,
    targetDestinationId: string,
    quantity: number,
    redirectedBy?: string
  ): Promise<{
    sourceRemaining: number;
    targetNewQuantity: number;
    targetAllocationId: string;
  }> {
    const { data, error } = await this.client.rpc('redirect_item', {
      p_allocation_id: allocationId,
      p_target_destination_id: targetDestinationId,
      p_quantity: quantity,
      p_redirected_by: redirectedBy ?? undefined,
    });

    if (error) {
      console.error('Error redirecting item:', error);
      throw error;
    }

    const result = data?.[0];
    if (!result) {
      throw new Error('No result from redirect_item');
    }

    return {
      sourceRemaining: Number(result.source_remaining),
      targetNewQuantity: Number(result.target_new_quantity),
      targetAllocationId: result.target_allocation_id,
    };
  }

  /**
   * Create a new custom destination (ad-hoc, volunteer-created)
   * @param name - Display name for the destination
   * @param timing - Pickup timing (defaults to 'Unscheduled')
   * @param isDirect - Whether this is a direct pickup destination
   * @param createdBy - Name of volunteer creating it
   * @returns UUID of the new destination
   */
  async createCustomDestination(
    name: string,
    timing = 'Unscheduled',
    isDirect = false,
    createdBy?: string
  ): Promise<string> {
    const { data, error } = await this.client.rpc('create_custom_destination', {
      p_name: name,
      p_timing: timing,
      p_is_direct: isDirect,
      p_created_by: createdBy ?? undefined,
    });

    if (error) {
      console.error('Error creating custom destination:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No ID returned from create_custom_destination');
    }

    return data as string;
  }

  /**
   * Deactivate (soft delete) a custom destination
   * @param destinationId - UUID of the custom destination
   */
  async deactivateCustomDestination(destinationId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('deactivate_custom_destination', {
      p_destination_id: destinationId,
    });

    if (error) {
      console.error('Error deactivating custom destination:', error);
      throw error;
    }

    return data ?? false;
  }

  /**
   * Reactivate a previously deactivated custom destination
   * @param destinationId - UUID of the custom destination
   */
  async reactivateCustomDestination(destinationId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('reactivate_custom_destination', {
      p_destination_id: destinationId,
    });

    if (error) {
      console.error('Error reactivating custom destination:', error);
      throw error;
    }

    return data ?? false;
  }

  /**
   * Get only active destinations (excludes soft-deleted custom destinations)
   */
  async getActiveDestinations(): Promise<DestinationRow[]> {
    try {
      const { data, error } = await this.client
        .from('destinations')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      }

      return data ?? [];
    } catch (error) {
      console.warn('⚠️ getActiveDestinations failed, falling back to getDestinations:', error);
      // Fallback to all destinations if is_active column doesn't exist yet
      return this.getDestinations();
    }
  }

  /**
   * Get redirections for the current week
   * @param weekDate - Week date in ISO format
   */
  async getRedirections(weekDate: string): Promise<Array<{
    id: string;
    allocationId: string;
    sourceDestinationId: string;
    targetDestinationId: string;
    quantity: number;
    redirectedBy: string | null;
    redirectedAt: string | null;
    weekDate: string;
  }>> {
    const { data, error } = await this.client
      .from('redirections')
      .select('*')
      .eq('week_date', weekDate)
      .order('redirected_at', { ascending: false });

    if (error) {
      console.error('Error fetching redirections:', error);
      throw error;
    }

    return (data ?? []).map(row => ({
      id: row.id,
      allocationId: row.allocation_id,
      sourceDestinationId: row.source_destination_id,
      targetDestinationId: row.target_destination_id,
      quantity: Number(row.quantity),
      redirectedBy: row.redirected_by,
      redirectedAt: row.redirected_at,
      weekDate: row.week_date,
    }));
  }

  /**
   * Get enriched redirections with item and destination names for display
   * @param weekDate - Week date in ISO format
   */
  async getRedirectionsEnriched(weekDate: string): Promise<Array<{
    id: string;
    itemName: string;
    itemEmoji: string;
    sourceDestinationId: string;
    sourceDestinationName: string;
    targetDestinationId: string;
    targetDestinationName: string;
    quantity: number;
    redirectedBy: string | null;
    redirectedAt: string | null;
  }>> {
    // Step 1: Fetch redirections with allocation and destination data
    const { data: redirections, error: redirectError } = await this.client
      .from('redirections')
      .select(`
        id,
        quantity,
        redirected_by,
        redirected_at,
        source_destination_id,
        target_destination_id,
        allocations!inner(order_id),
        source:destinations!redirections_source_destination_id_fkey(name),
        target:destinations!redirections_target_destination_id_fkey(name)
      `)
      .eq('week_date', weekDate)
      .order('redirected_at', { ascending: false });

    if (redirectError) {
      console.error('Error fetching enriched redirections:', redirectError);
      throw redirectError;
    }

    if (!redirections || redirections.length === 0) {
      return [];
    }

    // Step 2: Get unique order IDs and fetch order details
    const orderIds = [...new Set(redirections.map((r: { allocations: { order_id: string } }) => r.allocations?.order_id).filter(Boolean))];

    const { data: orders, error: ordersError } = await this.client
      .from('orders')
      .select('id, item_name')
      .in('id', orderIds);

    if (ordersError) {
      console.error('Error fetching orders for redirections:', ordersError);
      // Continue without order data rather than failing completely
    }

    // Build order lookup map (emoji will be derived by caller using getEmojiForItem)
    const orderMap = new Map<string, { item_name: string }>();
    (orders ?? []).forEach((o: { id: string; item_name: string }) => {
      orderMap.set(o.id, { item_name: o.item_name });
    });

    return redirections.map((row: {
      id: string;
      quantity: number;
      redirected_by: string | null;
      redirected_at: string | null;
      source_destination_id: string;
      target_destination_id: string;
      allocations: { order_id: string };
      source: { name: string } | null;
      target: { name: string } | null;
    }) => {
      const order = orderMap.get(row.allocations?.order_id);
      const itemName = order?.item_name ?? 'Unknown Item';
      return {
        id: row.id,
        itemName,
        itemEmoji: getEmojiForItem(itemName),
        sourceDestinationId: row.source_destination_id,
        sourceDestinationName: row.source?.name ?? 'Unknown',
        targetDestinationId: row.target_destination_id,
        targetDestinationName: row.target?.name ?? 'Unknown',
        quantity: Number(row.quantity),
        redirectedBy: row.redirected_by,
        redirectedAt: row.redirected_at,
      };
    });
  }

  /**
   * Add a custom item to a destination (for ad-hoc supplies like forks, meal boxes)
   * @param destinationId - UUID of the destination
   * @param itemName - Name of the custom item
   * @param quantity - Amount
   * @param weekDate - Week date in ISO format
   * @param addedBy - Name of volunteer adding the item
   */
  async addCustomItemToDestination(
    destinationId: string,
    itemName: string,
    quantity: number,
    weekDate: string,
    addedBy?: string,
    inventoryItemId?: string
  ): Promise<string> {
    const { data, error } = await this.client
      .from('custom_items')
      .insert({
        destination_id: destinationId,
        item_name: itemName,
        quantity,
        week_date: weekDate,
        added_by: addedBy ?? 'system',
        is_packed: false,
        ...(inventoryItemId ? { inventory_item_id: inventoryItemId } : {}),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error adding custom item:', error);
      throw error;
    }

    return data.id;
  }

  /**
   * Toggle the packed status of a custom item
   * @param customItemId - The ID of the custom item
   * @param isPacked - New packed status (optional, toggles if not provided)
   * @returns The new packed status
   */
  async toggleCustomItem(customItemId: string, isPacked?: boolean): Promise<boolean> {
    // If isPacked not provided, fetch current state and toggle
    if (isPacked === undefined) {
      const { data: current, error: fetchError } = await this.client
        .from('custom_items')
        .select('is_packed')
        .eq('id', customItemId)
        .single();

      if (fetchError) {
        console.error('Error fetching custom item:', fetchError);
        throw fetchError;
      }

      isPacked = !current.is_packed;
    }

    const { error } = await this.client
      .from('custom_items')
      .update({ is_packed: isPacked })
      .eq('id', customItemId);

    if (error) {
      console.error('Error toggling custom item:', error);
      throw error;
    }

    return isPacked;
  }

  /**
   * Get schedule history with optional filters
   * @param filters - Optional filters for destination, date range
   * @returns Array of schedule history entries
   */
  async getScheduleHistory(filters?: {
    destinationId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ScheduleHistoryEntry[]> {
    let query = this.client
      .from('schedule_history')
      .select('*')
      .order('changed_at', { ascending: false });

    if (filters?.destinationId) {
      query = query.eq('destination_id', filters.destinationId);
    }
    if (filters?.startDate) {
      query = query.gte('changed_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('changed_at', filters.endDate);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    } else {
      query = query.limit(100); // Default limit
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching schedule history:', error);
      throw error;
    }

    return data ?? [];
  }

  // ---------- Banking Feature: Save items for next week ----------

  /**
   * Bank items from a destination's allocation for next week
   * Reduces current allocation and saves for future release
   * @param allocationId - UUID of the source allocation
   * @param quantity - Amount to bank
   * @param bankedBy - Name of person banking
   * @returns Banked item ID, remaining quantity, and destination name
   */
  async bankItem(
    allocationId: string,
    quantity: number,
    bankedBy?: string
  ): Promise<{
    bankedItemId: string;
    sourceRemaining: number;
    destinationName: string;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client.rpc as any)('bank_item', {
      p_allocation_id: allocationId,
      p_quantity: quantity,
      p_banked_by: bankedBy ?? undefined,
    });

    if (error) {
      console.error('Error banking item:', error);
      throw error;
    }

    const result = data?.[0];
    if (!result) {
      throw new Error('No result from bank_item');
    }

    return {
      bankedItemId: result.banked_item_id,
      sourceRemaining: Number(result.source_remaining),
      destinationName: result.destination_name,
    };
  }

  /**
   * Get all unreleased banked items
   * @returns Array of banked items with destination info
   */
  async getBankedItems(): Promise<Array<{
    id: string;
    destinationId: string;
    destinationName: string;
    itemName: string;
    quantity: number;
    bankedBy: string | null;
    bankedAt: string;
    weekDate: string;
  }>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client.rpc as any)('get_banked_items');

    if (error) {
      // Handle case where function doesn't exist yet
      const message = (error.message || '').toLowerCase();
      if (message.includes('not found') || message.includes('does not exist')) {
        console.warn('⚠️ get_banked_items RPC not available yet');
        return [];
      }
      console.error('Error fetching banked items:', error);
      throw error;
    }

    return (data ?? []).map((row: {
      id: string;
      destination_id: string;
      destination_name: string;
      item_name: string;
      quantity: number;
      banked_by: string | null;
      banked_at: string;
      week_date: string;
    }) => ({
      id: row.id,
      destinationId: row.destination_id,
      destinationName: row.destination_name,
      itemName: row.item_name,
      quantity: Number(row.quantity),
      bankedBy: row.banked_by,
      bankedAt: row.banked_at,
      weekDate: row.week_date,
    }));
  }

  /**
   * Delete/cancel a banked item (restores quantity to original allocation)
   * @param bankedItemId - UUID of the banked item
   * @returns True if deleted successfully
   */
  async deleteBankedItem(bankedItemId: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client.rpc as any)('delete_banked_item', {
      p_banked_item_id: bankedItemId,
    });

    if (error) {
      console.error('Error deleting banked item:', error);
      throw error;
    }

    return data ?? false;
  }

  /**
   * Release banked items into new week's allocations
   * Called during Clear & Import to merge banked items
   * @param weekDate - The new week date to release into
   * @returns Counts of items released, allocations created, and allocations augmented
   */
  async releaseBankedItems(weekDate: string): Promise<{
    itemsReleased: number;
    allocationsCreated: number;
    allocationsAugmented: number;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client.rpc as any)('release_banked_items', {
      p_new_week_date: weekDate,
    });

    if (error) {
      // Handle case where function doesn't exist yet
      const message = (error.message || '').toLowerCase();
      if (message.includes('not found') || message.includes('does not exist')) {
        console.warn('⚠️ release_banked_items RPC not available yet');
        return { itemsReleased: 0, allocationsCreated: 0, allocationsAugmented: 0 };
      }
      console.error('Error releasing banked items:', error);
      throw error;
    }

    const result = data?.[0];
    return {
      itemsReleased: result?.items_released ?? 0,
      allocationsCreated: result?.allocations_created ?? 0,
      allocationsAugmented: result?.allocations_augmented ?? 0,
    };
  }

  // ============================================
  // SHIFT TASKS (recurring time-specific reminders)
  // ============================================

  /**
   * Get all shift tasks with their completion status for a given week
   */
  async getShiftTasksWithStatus(weekDate: string): Promise<
    Array<{
      id: string;
      title: string;
      description: string | null;
      emoji: string;
      timing: string;
      displayOrder: number;
      isActive: boolean;
      isCompleted: boolean;
      completedBy: string | null;
      completedAt: string | null;
    }>
  > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client.rpc as any)('get_shift_tasks_with_status', {
      p_week_date: weekDate,
    });

    if (error) {
      // Handle case where function doesn't exist yet
      const message = (error.message || '').toLowerCase();
      if (message.includes('not found') || message.includes('does not exist')) {
        console.warn('⚠️ get_shift_tasks_with_status RPC not available yet');
        return [];
      }
      console.error('Error fetching shift tasks:', error);
      throw error;
    }

    return (data ?? []).map(
      (row: {
        task_id: string;
        title: string;
        description: string | null;
        emoji: string;
        timing: string;
        display_order: number;
        is_completed: boolean;
        completed_by: string | null;
        completed_at: string | null;
      }) => ({
        id: row.task_id,
        title: row.title,
        description: row.description,
        emoji: row.emoji,
        timing: row.timing,
        displayOrder: row.display_order,
        isActive: true,
        isCompleted: row.is_completed,
        completedBy: row.completed_by,
        completedAt: row.completed_at,
      })
    );
  }

  /**
   * Toggle a shift task's completion status for a given week
   */
  async toggleShiftTask(
    taskId: string,
    weekDate: string,
    completedBy?: string
  ): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client.rpc as any)('toggle_shift_task', {
      p_task_id: taskId,
      p_week_date: weekDate,
      p_completed_by: completedBy ?? null,
    });

    if (error) {
      console.error('Error toggling shift task:', error);
      throw error;
    }

    return data ?? false;
  }

  /**
   * Get all shift tasks (for admin management)
   */
  async getAllShiftTasks(): Promise<
    Array<{
      id: string;
      title: string;
      description: string | null;
      emoji: string;
      timing: string;
      displayOrder: number;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client as any)
      .from('shift_tasks')
      .select('*')
      .order('timing')
      .order('display_order');

    if (error) {
      console.error('Error fetching all shift tasks:', error);
      throw error;
    }

    return (data ?? []).map((row: {
      id: string;
      title: string;
      description: string | null;
      emoji: string;
      timing: string;
      display_order: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      emoji: row.emoji,
      timing: row.timing,
      displayOrder: row.display_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Create a new shift task (admin)
   */
  async createShiftTask(task: {
    title: string;
    description?: string | null;
    emoji?: string;
    timing: string;
    displayOrder?: number;
  }): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.client as any)
      .from('shift_tasks')
      .insert({
        title: task.title,
        description: task.description ?? null,
        emoji: task.emoji ?? '📋',
        timing: task.timing,
        display_order: task.displayOrder ?? 0,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating shift task:', error);
      throw error;
    }

    return data.id as string;
  }

  /**
   * Update a shift task (admin)
   */
  async updateShiftTask(
    taskId: string,
    updates: {
      title?: string;
      description?: string | null;
      emoji?: string;
      timing?: string;
      displayOrder?: number;
      isActive?: boolean;
    }
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.client as any)
      .from('shift_tasks')
      .update({
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.emoji !== undefined && { emoji: updates.emoji }),
        ...(updates.timing !== undefined && { timing: updates.timing }),
        ...(updates.displayOrder !== undefined && { display_order: updates.displayOrder }),
        ...(updates.isActive !== undefined && { is_active: updates.isActive }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating shift task:', error);
      throw error;
    }
  }

  /**
   * Delete a shift task (admin)
   */
  async deleteShiftTask(taskId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.client as any).from('shift_tasks').delete().eq('id', taskId);

    if (error) {
      console.error('Error deleting shift task:', error);
      throw error;
    }
  }
}

let supabaseServiceInstance: SupabaseService | null = null;

export function getSupabaseService(): SupabaseService {
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = new SupabaseService();
  }
  return supabaseServiceInstance;
}
