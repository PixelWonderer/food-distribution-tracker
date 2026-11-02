import { SyncChange, UserPreferences, InventoryItem } from '@/types';
import type { TutorialProgress } from '@/types/tutorial';
import { logger } from '@/lib/logger';

// Storage version for detecting when to clear corrupted/outdated data
// 2.4.0: Role rename (weekendDistro→coopDelivery, foodBankCoordinator→foodBank) + selectedTiming multi-select
const STORAGE_VERSION = '2.4.0';
const VERSION_KEY = 'tracker_storage_version';

const STORAGE_KEYS = {
  PENDING_CHANGES: 'tracker_pending_changes',
  FAILED_CHANGES: 'tracker_failed_changes',
  CUSTOM_ITEMS: 'tracker_custom_items',
  LAST_SYNC: 'tracker_last_sync',
  PREFERENCES: 'tracker_user_preferences',
  TUTORIAL_COMPLETED: 'tracker_tutorial_completed',
  TUTORIAL_PROGRESS: 'tracker_tutorial_progress',
  INVENTORY_COUNTED: 'tracker_inventory_counted',
  INVENTORY_CACHE: 'tracker_inventory_cache',
  INVENTORY_CACHE_TIME: 'tracker_inventory_cache_time',
  INVENTORY_QUEUE: 'tracker_inventory_queue',
  // Legacy key for backward compatibility
  VOLUNTEER_NAME: 'orderConfirmationVolunteerName',
} as const;

const DEFAULT_PREFERENCES: UserPreferences = {
  volunteerName: '',
  // defaultTab is deprecated - no longer used
  activeTab: undefined, // Will be set based on role on first load
  autoScroll: true,
  compactMode: false,
  // Role-based focus mode defaults
  role: undefined,
  pickupFilterMode: undefined,
  selectedGroups: undefined,
  selectedTiming: undefined,
  hasCompletedRoleSetup: false,
  showShiftTasks: false,
  hasSeenShiftTasksIntro: false,
};

export class StorageService {
  private static instance: StorageService;

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Validates localStorage integrity and clears corrupted data
   * Should be called early in app initialization to prevent corruption-related failures
   * @returns Object with validation results
   */
  static validateAndClearCorruptedStorage(): {
    wasCorrupted: boolean;
    clearedKeys: string[];
    versionMismatch: boolean;
  } {
    const result = {
      wasCorrupted: false,
      clearedKeys: [] as string[],
      versionMismatch: false,
    };

    try {
      // Check if localStorage is accessible at all
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch (error) {
      console.error('❌ localStorage not accessible:', error);
      return result;
    }

    try {
      // Check storage version
      const storedVersion = localStorage.getItem(VERSION_KEY);
      if (storedVersion !== STORAGE_VERSION) {
        console.warn(`⚠️ Storage version mismatch: ${storedVersion} → ${STORAGE_VERSION}`);
        result.versionMismatch = true;
        result.wasCorrupted = true;

        // Preserve role setup completion so returning users don't see the dialog again
        let preservedRoleSetup = false;
        try {
          const prefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
          if (prefs) {
            const parsed = JSON.parse(prefs);
            preservedRoleSetup = parsed?.hasCompletedRoleSetup === true;
          }
        } catch { /* ignore */ }

        // Clear all Food Bank-related keys on version mismatch
        Object.values(STORAGE_KEYS).forEach(key => {
          try {
            localStorage.removeItem(key);
            result.clearedKeys.push(key);
          } catch (e) {
            console.warn(`Failed to clear key ${key}:`, e);
          }
        });

        // Restore role setup flag so users don't see the role selection dialog again
        if (preservedRoleSetup) {
          try {
            localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({
              ...DEFAULT_PREFERENCES,
              hasCompletedRoleSetup: true,
            }));
          } catch { /* ignore */ }
        }

        // Update version
        localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
        logger.debug(`✅ Storage cleared and version updated to ${STORAGE_VERSION}`);
        return result;
      }

      // Validate each storage key individually
      const keysToValidate = [
        { key: STORAGE_KEYS.PENDING_CHANGES, validator: (data: string) => Array.isArray(JSON.parse(data)) },
        { key: STORAGE_KEYS.FAILED_CHANGES, validator: (data: string) => Array.isArray(JSON.parse(data)) },
        { key: STORAGE_KEYS.CUSTOM_ITEMS, validator: (data: string) => Array.isArray(JSON.parse(data)) },
        { key: STORAGE_KEYS.LAST_SYNC, validator: (data: string) => !isNaN(parseInt(data, 10)) },
        { key: STORAGE_KEYS.PREFERENCES, validator: (data: string) => typeof JSON.parse(data) === 'object' },
        { key: STORAGE_KEYS.TUTORIAL_COMPLETED, validator: (data: string) => ['true', 'false'].includes(data) },
        {
          key: STORAGE_KEYS.TUTORIAL_PROGRESS,
          validator: (data: string) => {
            const parsed = JSON.parse(data);
            return parsed === null || typeof parsed === 'object';
          },
        },
        { key: STORAGE_KEYS.INVENTORY_COUNTED, validator: (data: string) => Array.isArray(JSON.parse(data)) },
        { key: STORAGE_KEYS.INVENTORY_CACHE, validator: (data: string) => Array.isArray(JSON.parse(data)) },
        { key: STORAGE_KEYS.INVENTORY_CACHE_TIME, validator: (data: string) => !isNaN(parseInt(data, 10)) },
        { key: STORAGE_KEYS.INVENTORY_QUEUE, validator: (data: string) => Array.isArray(JSON.parse(data)) },
      ];

      keysToValidate.forEach(({ key, validator }) => {
        try {
          const stored = localStorage.getItem(key);
          if (stored !== null) {
            // Try to validate the data
            if (!validator(stored)) {
              console.warn(`⚠️ Invalid data format in ${key}, clearing...`);
              localStorage.removeItem(key);
              result.wasCorrupted = true;
              result.clearedKeys.push(key);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Corrupted data in ${key}:`, error);
          localStorage.removeItem(key);
          result.wasCorrupted = true;
          result.clearedKeys.push(key);
        }
      });

      if (result.wasCorrupted) {
        logger.debug(`✅ Cleared ${result.clearedKeys.length} corrupted storage keys:`, result.clearedKeys);
      } else {
        logger.debug('✅ localStorage validation passed - no corruption detected');
      }

    } catch (error) {
      console.error('❌ Storage validation failed:', error);
      // On total failure, clear everything and reset
      try {
        Object.values(STORAGE_KEYS).forEach(key => {
          localStorage.removeItem(key);
        });
        localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
        result.wasCorrupted = true;
        result.clearedKeys = Object.values(STORAGE_KEYS);
      } catch (e) {
        console.error('❌ Failed to clear storage:', e);
      }
    }

    return result;
  }

  savePendingChanges(changes: Map<string, SyncChange>): void {
    try {
      const serialized = JSON.stringify(Array.from(changes.entries()));
      localStorage.setItem(STORAGE_KEYS.PENDING_CHANGES, serialized);
    } catch (error) {
      console.warn('Failed to save pending changes:', error);
    }
  }

  loadPendingChanges(): Map<string, SyncChange> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PENDING_CHANGES);
      if (stored) {
        const entries = JSON.parse(stored);
        return new Map(entries);
      }
    } catch (error) {
      console.warn('Failed to load pending changes:', error);
    }
    return new Map();
  }

  saveFailedChanges(changes: Map<string, SyncChange>): void {
    try {
      const serialized = JSON.stringify(Array.from(changes.entries()));
      localStorage.setItem(STORAGE_KEYS.FAILED_CHANGES, serialized);
    } catch (error) {
      console.warn('Failed to save failed changes:', error);
    }
  }

  loadFailedChanges(): Map<string, SyncChange> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FAILED_CHANGES);
      if (stored) {
        const entries = JSON.parse(stored);
        return new Map(entries);
      }
    } catch (error) {
      console.warn('Failed to load failed changes:', error);
    }
    return new Map();
  }

  saveLastSyncTime(timestamp: number): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
    } catch (error) {
      console.warn('Failed to save sync time:', error);
    }
  }

  loadLastSyncTime(): number | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return stored ? parseInt(stored, 10) : null;
    } catch (error) {
      console.warn('Failed to load sync time:', error);
      return null;
    }
  }

  clearPendingChanges(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.PENDING_CHANGES);
    } catch (error) {
      console.warn('Failed to clear pending changes:', error);
    }
  }

  clearFailedChanges(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.FAILED_CHANGES);
    } catch (error) {
      console.warn('Failed to clear failed changes:', error);
    }
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  savePreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
      // Also save volunteer name to legacy key for backward compatibility
      if (preferences.volunteerName) {
        localStorage.setItem(STORAGE_KEYS.VOLUNTEER_NAME, preferences.volunteerName);
        localStorage.setItem('volunteerName', preferences.volunteerName);
      } else {
        localStorage.removeItem('volunteerName');
      }
    } catch (error) {
      console.warn('Failed to save preferences:', error);
    }
  }

  loadPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged: UserPreferences = { ...DEFAULT_PREFERENCES, ...parsed };

        // Validate activeTab if present (supports legacy defaultTab migration)
        const validTabs = ['orderConfirmation', 'storage', 'pickup', 'inventory'];
        if (merged.activeTab && !validTabs.includes(merged.activeTab)) {
          merged.activeTab = undefined;
        }
        // Clean up deprecated defaultTab field
        delete merged.defaultTab;

        // Migrate old role names to new ones (v2.4.0)
        const roleMigration: Record<string, string> = {
          weekendDistro: 'coopDelivery',
          foodBankCoordinator: 'foodBank',
        };
        if (merged.role && roleMigration[merged.role]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          merged.role = roleMigration[merged.role] as any;
        }

        // Validate role field
        const validRoles = ['foodBank', 'pickupOnly', 'coopDelivery', 'fullAccess'];
        if (merged.role && !validRoles.includes(merged.role)) {
          merged.role = undefined;
        }

        // Validate pickupFilterMode
        if (merged.pickupFilterMode && !['groups', 'timing'].includes(merged.pickupFilterMode)) {
          merged.pickupFilterMode = undefined;
        }

        // Ensure selectedGroups is an array if present
        if (merged.selectedGroups && !Array.isArray(merged.selectedGroups)) {
          merged.selectedGroups = undefined;
        }

        // Migrate selectedTiming from string to string[] (v2.4.0)
        if (merged.selectedTiming && typeof merged.selectedTiming === 'string') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          merged.selectedTiming = [merged.selectedTiming] as any;
        }
        // Ensure selectedTiming is an array if present
        if (merged.selectedTiming && !Array.isArray(merged.selectedTiming)) {
          merged.selectedTiming = undefined;
        }

        return merged;
      }

      // Migrate legacy volunteer name if it exists
      const legacyName = localStorage.getItem(STORAGE_KEYS.VOLUNTEER_NAME) || localStorage.getItem('volunteerName');
      if (legacyName) {
        return { ...DEFAULT_PREFERENCES, volunteerName: legacyName };
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    const current = this.loadPreferences();
    this.savePreferences({ ...current, [key]: value });
  }

  saveTutorialCompletion(completed: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TUTORIAL_COMPLETED, completed ? 'true' : 'false');
    } catch (error) {
      console.warn('Failed to save tutorial completion', error);
    }
  }

  loadTutorialCompletion(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TUTORIAL_COMPLETED);
      return stored === 'true';
    } catch (error) {
      console.warn('Failed to load tutorial completion', error);
      return false;
    }
  }

  saveTutorialProgress(progress: TutorialProgress): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TUTORIAL_PROGRESS, JSON.stringify(progress));
    } catch (error) {
      console.warn('Failed to save tutorial progress', error);
    }
  }

  loadTutorialProgress(): TutorialProgress | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TUTORIAL_PROGRESS);
      if (!stored) return null;
      return JSON.parse(stored) as TutorialProgress;
    } catch (error) {
      console.warn('Failed to load tutorial progress', error);
      return null;
    }
  }

  saveCountedItems(itemIds: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY_COUNTED, JSON.stringify(itemIds));
    } catch (error) {
      console.warn('Failed to save counted items', error);
    }
  }

  loadCountedItems(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.INVENTORY_COUNTED);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.warn('Failed to load counted items', error);
    }
    return [];
  }

  clearCountedItems(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.INVENTORY_COUNTED);
    } catch (error) {
      console.warn('Failed to clear counted items', error);
    }
  }

  // --- Inventory data cache (offline-first) ---

  saveInventoryCache(items: InventoryItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY_CACHE, JSON.stringify(items));
      localStorage.setItem(STORAGE_KEYS.INVENTORY_CACHE_TIME, Date.now().toString());
    } catch (error) {
      console.warn('Failed to save inventory cache', error);
    }
  }

  loadInventoryCache(): { items: InventoryItem[]; cachedAt: number } | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.INVENTORY_CACHE);
      const timeStr = localStorage.getItem(STORAGE_KEYS.INVENTORY_CACHE_TIME);
      if (stored && timeStr) {
        const items = JSON.parse(stored);
        if (Array.isArray(items)) {
          return { items, cachedAt: parseInt(timeStr, 10) };
        }
      }
    } catch (error) {
      console.warn('Failed to load inventory cache', error);
    }
    return null;
  }

  clearInventoryCache(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.INVENTORY_CACHE);
      localStorage.removeItem(STORAGE_KEYS.INVENTORY_CACHE_TIME);
    } catch (error) {
      console.warn('Failed to clear inventory cache', error);
    }
  }

  // --- Offline inventory mutation queue ---

  saveInventoryQueue(queue: InventoryQueueEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.warn('Failed to save inventory queue', error);
    }
  }

  loadInventoryQueue(): InventoryQueueEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.INVENTORY_QUEUE);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.warn('Failed to load inventory queue', error);
    }
    return [];
  }

  clearInventoryQueue(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.INVENTORY_QUEUE);
    } catch (error) {
      console.warn('Failed to clear inventory queue', error);
    }
  }
}

// Typed queue entry for offline inventory mutations
export type InventoryQueueEntry = {
  id: string;
  createdAt: number;
} & (
  | { type: 'set_count'; itemId: string; quantity: number }
  | {
      type: 'add_custom_item';
      name: string;
      quantity: number;
      options?: {
        unit?: string;
        category?: string;
        subcategory?: string;
        storageLocation?: string;
        lowStockThreshold?: number;
        emoji?: string;
      };
    }
  | { type: 'set_threshold'; itemId: string; threshold: number }
);
