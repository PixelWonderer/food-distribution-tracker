import type { InventoryItem, InventoryHistoryEntry, OrderSuggestion, PantrySubcategory } from '@/types';
import { SupabaseService } from './supabaseService';
import { getEmojiForItem, getSubcategoryForItem } from '@/utils/helpers';
import { logger } from '@/lib/logger';

const supabase = SupabaseService.getInstance();

// Note: New tables (inventory_items, inventory_history, order_suggestions) are not
// yet in the generated Supabase types. We use type assertions until types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ============================================
// Inventory Items
// ============================================

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const client = supabase.getClient() as AnyClient;

  // Use the view which includes computed fields
  const { data, error } = await client
    .from('inventory_items_view')
    .select('*')
    .order('item_name', { ascending: true });

  if (error) {
    console.error('Error fetching inventory items:', error);
    throw error;
  }

  const items = (data ?? []).map(mapToInventoryItem);

  // Deduplicate by item name — keep the entry with higher quantity (or first seen)
  const seen = new Map<string, InventoryItem>();
  for (const item of items) {
    const key = item.itemName.toLowerCase();
    const existing = seen.get(key);
    if (!existing || item.currentQuantity > existing.currentQuantity) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

export async function fetchInventoryItemById(itemId: string): Promise<InventoryItem | null> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client
    .from('inventory_items_view')
    .select('*')
    .eq('id', itemId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching inventory item:', error);
    throw error;
  }

  return data ? mapToInventoryItem(data) : null;
}

export async function setInventoryCount(
  itemId: string,
  quantity: number,
  updatedBy: string
): Promise<InventoryItem> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client.rpc('set_inventory_count', {
    p_item_id: itemId,
    p_new_quantity: quantity,
    p_updated_by: updatedBy,
  });

  if (error) {
    console.error('Error setting inventory count:', error);
    throw error;
  }

  const row = data;
  return {
    ...mapToInventoryItem(row),
    isLowStock: Number(row.current_quantity ?? 0) <= Number(row.low_stock_threshold ?? 1),
  };
}

export async function addCustomInventoryItem(
  name: string,
  quantity: number,
  options: {
    unit?: string;
    category?: string;
    subcategory?: PantrySubcategory;
    storageLocation?: string;
    lowStockThreshold?: number;
    emoji?: string;
    addedBy?: string;
  } = {}
): Promise<InventoryItem> {
  const client = supabase.getClient() as AnyClient;

  // Use direct INSERT to support subcategory (RPC may not have this param)
  const { data, error } = await client
    .from('inventory_items')
    .insert({
      custom_name: name.trim(),
      current_quantity: quantity,
      unit_of_measure: options.unit ?? 'Case',
      category: options.category ?? 'Pantry',
      subcategory: options.subcategory ?? 'Snacks & Other',
      storage_location: options.storageLocation ?? 'Pantry',
      low_stock_threshold: options.lowStockThreshold ?? 2,
      emoji: options.emoji ?? '📦',
      is_active: true,
      is_packed: false,
      last_updated_by: options.addedBy ?? 'Volunteer',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error adding custom inventory item:', error);
    throw error;
  }

  const row = data;
  return {
    ...mapToInventoryItem(row),
    itemName: name.trim(), // Custom items use custom_name as item_name
    isLowStock: Number(row.current_quantity ?? 0) <= Number(row.low_stock_threshold ?? 2),
  };
}

export async function setLowStockThreshold(
  itemId: string,
  threshold: number
): Promise<InventoryItem> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client.rpc('set_low_stock_threshold', {
    p_item_id: itemId,
    p_threshold: threshold,
  });

  if (error) {
    console.error('Error setting low stock threshold:', error);
    throw error;
  }

  const row = data;
  return {
    ...mapToInventoryItem(row),
    isLowStock: Number(row.current_quantity ?? 0) <= Number(row.low_stock_threshold ?? 1),
  };
}

export async function addInventoryFromOrder(
  orderId: string,
  quantity: number,
  updatedBy: string = 'system'
): Promise<InventoryItem> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client.rpc('add_inventory_from_order', {
    p_order_id: orderId,
    p_quantity: quantity,
    p_updated_by: updatedBy,
  });

  if (error) {
    console.error('Error adding inventory from order:', error);
    throw error;
  }

  const row = data;
  return {
    ...mapToInventoryItem(row),
    isLowStock: Number(row.current_quantity ?? 0) <= Number(row.low_stock_threshold ?? 1),
  };
}

export async function deactivateInventoryItem(itemId: string): Promise<boolean> {
  const client = supabase.getClient() as AnyClient;

  const { error } = await client
    .from('inventory_items')
    .update({ is_active: false })
    .eq('id', itemId);

  if (error) {
    console.error('Error deactivating inventory item:', error);
    throw error;
  }

  return true;
}

/**
 * Toggle the packed status of an inventory item.
 * Used in StorageView to mark items as packed/unpacked.
 */
export async function toggleInventoryPacked(itemId: string): Promise<InventoryItem> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client.rpc('toggle_inventory_packed', {
    p_item_id: itemId,
  });

  if (error) {
    console.error('Error toggling inventory packed:', error);
    throw error;
  }

  return mapToInventoryItem(data);
}

/**
 * Set all active inventory items with positive quantity to packed/unpacked status.
 * Used in StorageView for "Mark all stored" / "Reset" buttons.
 */
export async function setAllInventoryPacked(packed: boolean): Promise<number> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client.rpc('set_all_inventory_packed', {
    p_packed: packed,
  });

  if (error) {
    console.error('Error setting all inventory packed:', error);
    throw error;
  }

  return data as number;
}

/**
 * Auto-import non-allocated quantity from an order to inventory.
 * Called when an order is confirmed and has non_allocated > 0.
 * Creates or updates the inventory item linked to that order.
 */
export async function autoImportNonAllocatedToInventory(
  orderId: string,
  updatedBy: string = 'system'
): Promise<InventoryItem | null> {
  const client = supabase.getClient() as AnyClient;

  // First check if the order has non_allocated quantity
  const { data: order, error: orderError } = await client
    .from('orders')
    .select('id, non_allocated')
    .eq('id', orderId)
    .single();

  if (orderError) {
    console.error('Error fetching order for auto-import:', orderError);
    return null;
  }

  // Skip if no non_allocated quantity
  if (!order?.non_allocated || Number(order.non_allocated) <= 0) {
    logger.debug(`No non-allocated quantity for order ${orderId}, skipping auto-import`);
    return null;
  }

  // Call the RPC function to auto-import
  const { data, error } = await client.rpc('auto_import_non_allocated_to_inventory', {
    p_order_id: orderId,
    p_updated_by: updatedBy,
  });

  if (error) {
    console.error('Error auto-importing non-allocated to inventory:', error);
    return null;
  }

  const row = data;
  return {
    ...mapToInventoryItem(row),
    isLowStock: Number(row.current_quantity ?? 0) <= Number(row.low_stock_threshold ?? 1),
  };
}

// ============================================
// Take Inventory Item (with attribution)
// ============================================

/**
 * Take items from inventory with attribution tracking.
 * Logs who/which destination took the items.
 */
export async function takeInventoryItem(
  itemId: string,
  quantity: number,
  options: {
    destinationId?: string;
    destinationName?: string;
    takenBy?: string;
  } = {}
): Promise<InventoryItem> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client.rpc('take_inventory_item', {
    p_item_id: itemId,
    p_quantity: quantity,
    p_destination_id: options.destinationId ?? null,
    p_destination_name: options.destinationName ?? null,
    p_taken_by: options.takenBy ?? 'Volunteer',
  });

  if (error) {
    console.error('Error taking inventory item:', error);
    throw error;
  }

  const row = data;
  return {
    ...mapToInventoryItem(row),
    isLowStock: Number(row.current_quantity ?? 0) <= Number(row.low_stock_threshold ?? 1),
  };
}

// ============================================
// Undo Take (restore quantity)
// ============================================

/**
 * Undo a take action by adding back the taken quantity (relative delta).
 * Uses an atomic SQL increment to avoid overwriting concurrent changes.
 * Optionally deletes the history entry if provided.
 */
export async function undoTakeInventoryItem(
  itemId: string,
  quantityToRestore: number,
  historyEntryId?: string
): Promise<InventoryItem> {
  const client = supabase.getClient() as AnyClient;

  // Add back the taken quantity using atomic increment RPC
  const { error: rpcError } = await client.rpc('increment_inventory_quantity', {
    p_item_id: itemId,
    p_amount: quantityToRestore,
  });

  if (rpcError) {
    console.error('Error restoring inventory quantity:', rpcError);
    throw rpcError;
  }

  // Fetch the updated item
  const { data: itemData, error: fetchError } = await client
    .from('inventory_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError) {
    console.error('Error fetching updated inventory item:', fetchError);
    throw fetchError;
  }

  // Delete the history entry if provided
  if (historyEntryId) {
    const { error: historyError } = await client
      .from('inventory_history')
      .delete()
      .eq('id', historyEntryId);

    if (historyError) {
      console.warn('Could not delete history entry:', historyError);
      // Non-fatal, continue
    }
  }

  return mapToInventoryItem(itemData);
}

// ============================================
// Order Suggestions
// ============================================

/**
 * Fetch pending order suggestions (low-stock items).
 */
export async function fetchOrderSuggestions(): Promise<OrderSuggestion[]> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client
    .from('order_suggestions')
    .select(`
      *,
      inventory_items (
        id, custom_name, unit_of_measure, category, subcategory, emoji,
        current_quantity, low_stock_threshold, is_active, is_packed,
        order_id, storage_location, last_updated_at, last_updated_by
      )
    `)
    .eq('is_fulfilled', false)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Error fetching order suggestions:', error);
    throw error;
  }

  return (data ?? []).map(mapToOrderSuggestion);
}

/**
 * Mark an order suggestion as fulfilled.
 */
export async function fulfillOrderSuggestion(
  suggestionId: string,
  fulfilledBy: string = 'Volunteer'
): Promise<void> {
  const client = supabase.getClient() as AnyClient;

  const { error } = await client.rpc('fulfill_suggestion', {
    p_suggestion_id: suggestionId,
    p_fulfilled_by: fulfilledBy,
  });

  if (error) {
    console.error('Error fulfilling order suggestion:', error);
    throw error;
  }
}

// ============================================
// Inventory History
// ============================================

export async function fetchInventoryHistory(
  itemId: string,
  limit: number = 50
): Promise<InventoryHistoryEntry[]> {
  const client = supabase.getClient() as AnyClient;

  const { data, error } = await client
    .from('inventory_history')
    .select('*')
    .eq('inventory_item_id', itemId)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching inventory history:', error);
    throw error;
  }

  return (data ?? []).map(mapToHistoryEntry);
}

// ============================================
// Mappers
// ============================================

function mapToInventoryItem(row: any): InventoryItem {
  const itemName = row.item_name || row.custom_name || 'Unknown Item';
  return {
    id: row.id,
    orderId: row.order_id,
    customName: row.custom_name,
    itemName,
    // Use smart emoji lookup if stored emoji is default box or missing
    emoji: row.emoji && row.emoji !== '📦' ? row.emoji : getEmojiForItem(itemName),
    unit: row.unit_of_measure || 'Case',
    category: row.category,
    // Compute subcategory from item name if not set in database
    subcategory: (row.subcategory as PantrySubcategory) || getSubcategoryForItem(itemName),
    storageLocation: row.storage_location,
    currentQuantity: Number(row.current_quantity ?? 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 1),
    isLowStock: row.is_low_stock ?? (Number(row.current_quantity ?? 0) <= Number(row.low_stock_threshold ?? 1)),
    lastUpdatedAt: row.last_updated_at,
    lastUpdatedBy: row.last_updated_by,
    isActive: row.is_active ?? true,
    isPacked: row.is_packed ?? false,
  };
}

function mapToHistoryEntry(row: any): InventoryHistoryEntry {
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    previousQuantity: row.previous_quantity,
    newQuantity: Number(row.new_quantity),
    changeType: row.change_type as InventoryHistoryEntry['changeType'],
    changeReason: row.change_reason,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    sourceOrderId: row.source_order_id,
    weekDate: row.week_date,
    destinationId: row.destination_id,
    destinationName: row.destination_name,
  };
}

function mapToOrderSuggestion(row: any): OrderSuggestion {
  const inventoryRow = row.inventory_items;
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    inventoryItem: inventoryRow ? mapToInventoryItem(inventoryRow) : {
      id: row.inventory_item_id,
      orderId: null,
      customName: null,
      itemName: 'Unknown Item',
      emoji: '📦',
      unit: 'Case',
      category: 'Pantry',
      subcategory: null,
      storageLocation: null,
      currentQuantity: 0,
      lowStockThreshold: 2,
      isLowStock: true,
      lastUpdatedAt: '',
      lastUpdatedBy: null,
      isActive: true,
      isPacked: false,
    },
    suggestedQuantity: row.suggested_quantity ? Number(row.suggested_quantity) : null,
    reason: row.reason as OrderSuggestion['reason'],
    addedAt: row.added_at,
    addedBy: row.added_by,
    isFulfilled: row.is_fulfilled ?? false,
    fulfilledAt: row.fulfilled_at,
    fulfilledBy: row.fulfilled_by,
  };
}
