import { StorageService, type InventoryQueueEntry } from './storage';
import {
  setInventoryCount as setInventoryCountService,
  addCustomInventoryItem as addCustomInventoryItemService,
  setLowStockThreshold as setLowStockThresholdService,
} from './inventoryService';
import type { PantrySubcategory } from '@/types';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

const storage = StorageService.getInstance();

// Distributive Omit so TypeScript preserves discriminated union narrowing
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/**
 * Enqueue an inventory mutation for later sync.
 * Mutations are idempotent (set_count sets absolute value, not delta).
 */
export function enqueueInventoryMutation(
  entry: DistributiveOmit<InventoryQueueEntry, 'id' | 'createdAt'>
): void {
  const queue = storage.loadInventoryQueue();
  const fullEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  } as InventoryQueueEntry;
  queue.push(fullEntry);
  storage.saveInventoryQueue(queue);
  logger.debug(`📝 Queued offline mutation: ${entry.type}`);
}

/**
 * Drain the offline queue by replaying mutations against Supabase.
 * Called when the device comes back online.
 * Returns the count of successfully replayed mutations.
 */
export async function drainInventoryQueue(): Promise<number> {
  const queue = storage.loadInventoryQueue();
  if (queue.length === 0) return 0;

  logger.debug(`📤 Draining ${queue.length} queued inventory mutations`);

  let successCount = 0;
  const failed: InventoryQueueEntry[] = [];

  for (const entry of queue) {
    try {
      switch (entry.type) {
        case 'set_count':
          await setInventoryCountService(entry.itemId, entry.quantity, 'Volunteer (offline)');
          break;
        case 'add_custom_item':
          await addCustomInventoryItemService(entry.name, entry.quantity, {
            ...entry.options,
            subcategory: entry.options?.subcategory as PantrySubcategory | undefined,
            addedBy: 'Volunteer (offline)',
          });
          break;
        case 'set_threshold':
          await setLowStockThresholdService(entry.itemId, entry.threshold);
          break;
      }
      successCount++;
    } catch (error) {
      logger.debug(`Failed to replay mutation ${entry.id}:`, error);
      failed.push(entry);
    }
  }

  // Keep only failed entries for retry
  storage.saveInventoryQueue(failed);

  if (successCount > 0) {
    toast.success(`Synced ${successCount} offline change${successCount > 1 ? 's' : ''}`);
  }
  if (failed.length > 0) {
    toast.warning(`${failed.length} change${failed.length > 1 ? 's' : ''} failed to sync`);
  }

  return successCount;
}

/**
 * Get the current queue length (for UI indicators).
 */
export function getQueueLength(): number {
  return storage.loadInventoryQueue().length;
}
