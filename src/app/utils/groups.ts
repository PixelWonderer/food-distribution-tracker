import type { GroupData, ItemData, SheetData, StorageTypes, DestinationInfo, CustomItem, InventoryItem, DaySplit } from '@/types';
import { GROUPS, COLUMN_MAP, RAN_OUT_COLUMN_INDEX } from '@/utils/constants';
import { getEmojiForItem } from '@/utils/helpers';

/**
 * Get timing for a destination.
 * Supabase data takes priority (allows schedule changes to take effect).
 * Falls back to static GROUPS config for destinations not yet in Supabase.
 */
const getDestinationTiming = (
  groupKey: string,
  dynamicDestinations?: DestinationInfo[]
): string => {
  // First check dynamic Supabase data (allows schedule changes to take effect)
  if (dynamicDestinations && dynamicDestinations.length > 0) {
    const match = dynamicDestinations.find((dest) => {
      const lowerKey = groupKey.toLowerCase();
      return (
        dest.code?.toLowerCase() === lowerKey ||
        dest.shortName?.toLowerCase() === lowerKey ||
        dest.name?.toLowerCase().replace(/\s+/g, '').includes(lowerKey)
      );
    });

    if (match?.timing) {
      return match.timing;
    }
  }

  // Fall back to static GROUPS config (for destinations not yet in Supabase)
  if (GROUPS[groupKey]?.timing) {
    return GROUPS[groupKey].timing;
  }

  return '';
};

const SUPPLY_KEYWORDS = [
  'tables',
  'meal box',
  '200 box',
  'fork',
  'hub supply',
  '(hub',
  'produce market',
  'grocery store',
];

const parseQuantity = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const normalizeStorageType = (name: string, storageTypes: StorageTypes): string => {
  const fallback = 'Pantry';
  try {
    const candidate = storageTypes[name];
    if (candidate && typeof candidate === 'string') {
      return candidate;
    }
  } catch (error) {
    console.warn('Storage type lookup failed', { name, error });
  }
  return fallback;
};

const isSupplyItem = (name: string): boolean => {
  const normalized = name.toLowerCase();
  return SUPPLY_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const buildStorageGroups = (
  sheetData: SheetData | null,
  storageData: SheetData | null,
  storageTypes: StorageTypes
): GroupData[] => {
  if (!sheetData || sheetData.length === 0) {
    return [];
  }

  const aggregated = new Map<
    string,
    {
      name: string;
      totalQuantity: number;
      storageType: string;
      emoji: string;
      ranOut: boolean;
      destinations: Array<{ groupKey: string; row: number; colIndex: number; quantity: number }>;
    }
  >();

  Object.entries(GROUPS).forEach(([groupKey, groupInfo]) => {
    const colIndex = COLUMN_MAP[groupKey];
    if (colIndex === undefined || !groupInfo) return;
    if (groupInfo.direct) return;

    for (let row = 2; row < sheetData.length && row < 60; row += 1) {
      const rawRow = sheetData[row];
      if (!rawRow) continue;

      const quantity = parseQuantity(rawRow[colIndex]);
      if (quantity <= 0) continue;

      const rawName = rawRow[0];
      const itemName = typeof rawName === 'string' ? rawName : String(rawName ?? '');
      if (!itemName || isSupplyItem(itemName)) {
        continue;
      }

      const storageType = normalizeStorageType(itemName, storageTypes);
      const key = `${itemName}-${storageType}`;

      if (!aggregated.has(key)) {
        aggregated.set(key, {
          name: itemName,
          totalQuantity: quantity,
          storageType,
          emoji: getEmojiForItem(itemName),
          ranOut: rawRow[RAN_OUT_COLUMN_INDEX] === true,
          destinations: [{ groupKey, row, colIndex, quantity }],
        });
      } else {
        const entry = aggregated.get(key)!;
        entry.totalQuantity += quantity;
        entry.destinations.push({ groupKey, row, colIndex, quantity });
      }
    }
  });

  const fridgeItems: ItemData[] = [];
  const pantryItems: ItemData[] = [];

  aggregated.forEach((entry) => {
    if (entry.ranOut) return;

    const firstDestination = entry.destinations[0];
    const item: ItemData = {
      row: firstDestination?.row ?? -1,
      name: entry.name,
      quantity: entry.totalQuantity,
      emoji: entry.emoji,
      storageType: entry.storageType,
      ranOut: entry.ranOut,
      isCustom: false,
      groupKey: 'aggregated',
      colIndex: firstDestination?.colIndex,
      destinations: entry.destinations,
    };

    if (entry.storageType === 'Fridge') {
      fridgeItems.push(item);
    } else {
      pantryItems.push(item);
    }
  });

  const isItemComplete = (item: ItemData): boolean => {
    if (!storageData) return false;

    if (item.destinations && item.destinations.length > 0) {
      return item.destinations.every((dest) => Boolean(storageData[dest.row]?.[dest.colIndex]));
    }

    if (typeof item.colIndex === 'number' && item.row >= 0) {
      return Boolean(storageData[item.row]?.[item.colIndex]);
    }

    return false;
  };

  const sortByWeight = (a: ItemData, b: ItemData) => {
    const isEggs = (item: ItemData) => item.name.toLowerCase().includes('egg');
    if (isEggs(a) && !isEggs(b)) return 1;
    if (!isEggs(a) && isEggs(b)) return -1;

    const estimateWeight = (item: ItemData) => {
      const name = item.name.toLowerCase();
      const qty = item.quantity;
      if (name.includes('cucumber')) return qty * 0.5;
      if (name.includes('watermelon')) return qty * 10;
      if (name.includes('milk') && name.includes('gallon')) return qty * 8;
      if (name.includes('apple')) return qty * 0.3;
      if (name.includes('onion')) return qty * 0.25;
      if (name.includes('potato')) return qty * 0.33;
      if (name.includes('plum')) return qty * 0.15;
      if (name.includes('nectarine')) return qty * 0.2;
      if (name.includes('peach')) return qty * 0.2;
      if (name.includes('orange')) return qty * 0.3;
      if (name.includes('banana')) return qty * 0.25;
      if (name.includes('bread')) return qty * 1.5;
      if (name.includes('yogurt')) return qty * 0.5;
      return qty;
    };

    return estimateWeight(b) - estimateWeight(a);
  };

  fridgeItems.sort(sortByWeight);
  pantryItems.sort(sortByWeight);

  const buildGroup = (key: 'fridge' | 'table', name: string, items: ItemData[]): GroupData | null => {
    if (items.length === 0) {
      return null;
    }

    const completed = items.filter((item) => isItemComplete(item)).length;
    return {
      key,
      name,
      timing: 'Storage',
      direct: false,
      items,
      completedCount: completed,
      totalCount: items.length,
    };
  };

  return [
    buildGroup('fridge', '🧊 Fridge items', fridgeItems),
    buildGroup('table', '🪑 Table items', pantryItems),
  ].filter(Boolean) as GroupData[];
};

/**
 * Convert a CustomItem to an ItemData for display in pickup groups.
 */
const customItemToItemData = (customItem: CustomItem): ItemData => ({
  row: -1, // Custom items don't have sheet rows
  name: customItem.itemName,
  quantity: customItem.quantity,
  emoji: getEmojiForItem(customItem.itemName),
  storageType: 'Pantry', // Default for supplies
  ranOut: false,
  isCustom: true,
  customId: customItem.id,
  isPacked: customItem.isPacked,
  inventoryItemId: customItem.inventoryItemId ?? undefined,
});

// Type for redirected item allocations to custom destinations
type CustomDestinationAllocation = {
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

// Allocation metadata for looking up allocation IDs from row:col keys
type AllocationMeta = {
  allocationId: string;
  destinationCode: string;
  row: number;
  col: number;
  isStored: boolean;
  isDistributed: boolean;
};

// Map day split recipients to timing slots for the Pickup view
const DAY_TO_TIMING: Record<string, string> = {
  Saturday: 'Saturday noon',
  Sunday: 'Sunday',
};

export const buildPickupGroups = (
  sheetData: SheetData | null,
  trackingData: SheetData | null,
  storageTypes: StorageTypes,
  dynamicDestinations?: DestinationInfo[],
  customItems?: CustomItem[],
  customDestinationAllocations?: CustomDestinationAllocation[],
  daySplits?: DaySplit[],
  allocationLookup?: Record<string, AllocationMeta>
): GroupData[] => {
  const groupsData: GroupData[] = [];
  const timingOrder = [
    'friday am',
    'friday noon',
    'friday pm',
    'saturday am',
    'saturday noon',
    'saturday pm',
    'sunday',
    'monday am',
    'unscheduled',
  ];

  // Group custom items by destination code for easy lookup
  const customItemsByDestination = new Map<string, CustomItem[]>();
  if (customItems && customItems.length > 0) {
    customItems.forEach((item) => {
      const existing = customItemsByDestination.get(item.destinationCode) || [];
      existing.push(item);
      customItemsByDestination.set(item.destinationCode, existing);
    });
  }

  // Process standard destinations (those in GROUPS config)
  if (sheetData && sheetData.length > 0) {
    // Sort groups by their current timing (dynamic or static)
    const sortedGroups = Object.entries(GROUPS).sort(([keyA], [keyB]) => {
      const timingA = getDestinationTiming(keyA, dynamicDestinations);
      const timingB = getDestinationTiming(keyB, dynamicDestinations);
      const aIndex = timingOrder.indexOf(timingA.toLowerCase());
      const bIndex = timingOrder.indexOf(timingB.toLowerCase());
      const safeA = aIndex === -1 ? timingOrder.length : aIndex;
      const safeB = bIndex === -1 ? timingOrder.length : bIndex;
      return safeA - safeB;
    });

    sortedGroups.forEach(([groupKey, groupInfo]) => {
      const colIndex = COLUMN_MAP[groupKey];
      // Allow destinations without COLUMN_MAP (e.g., Partner Group 8, Partner Group 9) - they can still have custom items
      if (!groupInfo) return;

      const fridgeItems: ItemData[] = [];
      const pantryItems: ItemData[] = [];

      // Only process sheet data if we have a column index for this destination
      if (colIndex !== undefined) {
        for (let row = 2; row < sheetData.length && row < 80; row += 1) {
          const rawRow = sheetData[row];
          if (!rawRow) continue;

          const quantity = parseQuantity(rawRow[colIndex]);
          if (quantity <= 0) continue;

          if (rawRow[RAN_OUT_COLUMN_INDEX] === true) continue;

          const rawName = rawRow[0];
          const itemName = typeof rawName === 'string' ? rawName : String(rawName ?? '');
          if (!itemName) continue;

          const storageType = normalizeStorageType(itemName, storageTypes);
          const item: ItemData = {
            row,
            name: itemName,
            quantity,
            emoji: getEmojiForItem(itemName),
            storageType,
            ranOut: rawRow[RAN_OUT_COLUMN_INDEX] === true,
            isCustom: false,
            colIndex,
          };

          if (storageType === 'Fridge') {
            fridgeItems.push(item);
          } else {
            pantryItems.push(item);
          }
        }
      }

      // Get custom items for this destination (match by destination code)
      const destInfo = dynamicDestinations?.find(
        (d) =>
          d.code?.toLowerCase() === groupKey.toLowerCase() ||
          d.shortName?.toLowerCase() === groupKey.toLowerCase()
      );
      const destCode = destInfo?.code || groupKey;
      const customForDest = customItemsByDestination.get(destCode) || [];
      const customItemData = customForDest.map(customItemToItemData);

      const items = [
        ...fridgeItems.sort((a, b) => a.name.localeCompare(b.name)),
        ...pantryItems.sort((a, b) => a.name.localeCompare(b.name)),
        ...customItemData.sort((a, b) => a.name.localeCompare(b.name)),
      ];

      // Count completed items
      const standardCompleted = colIndex !== undefined
        ? items
            .filter((item) => !item.isCustom)
            .filter((item) => Boolean(trackingData?.[item.row]?.[colIndex])).length
        : 0;
      const customCompleted = items
        .filter((item) => item.isCustom)
        .filter((item) => item.isPacked === true).length;
      const completed = standardCompleted + customCompleted;

      // Use dynamic timing from Supabase if available, otherwise fallback to static GROUPS
      const currentTiming = getDestinationTiming(groupKey, dynamicDestinations);

      // Partner Group 6 day splits: distribute items across per-day groups
      // Only split by day when Partner Group 6 is on its default "Saturday noon" schedule;
      // if admin moved it to another timing, show all items under that timing instead.
      const isDefaultSplitSchedule = currentTiming.toLowerCase() === 'saturday noon';
      if (groupKey === 'partner_6' && isDefaultSplitSchedule && daySplits && daySplits.length > 0 && allocationLookup && colIndex !== undefined) {
        // Build lookup: allocationId → [{day, quantity}]
        const splitsByAlloc = new Map<string, Array<{ day: string; quantity: number }>>();
        daySplits.forEach((split) => {
          const arr = splitsByAlloc.get(split.allocationId) || [];
          arr.push({ day: split.day, quantity: split.quantity });
          splitsByAlloc.set(split.allocationId, arr);
        });

        // Distribute items to day groups
        const dayItemsMap: Record<string, ItemData[]> = {};

        items.forEach((item) => {
          const allocKey = `${item.row}:${colIndex}`;
          const allocMeta = allocationLookup[allocKey];
          const splits = allocMeta ? splitsByAlloc.get(allocMeta.allocationId) : undefined;

          if (splits && splits.length > 0) {
            // Item has day splits — create a copy per day with split quantity
            splits.forEach((split) => {
              if (split.quantity <= 0) return;
              if (!dayItemsMap[split.day]) dayItemsMap[split.day] = [];
              dayItemsMap[split.day].push({ ...item, quantity: split.quantity });
            });
          } else {
            // No splits — default to Saturday (matches Partner Distribution default)
            if (!dayItemsMap['Saturday']) dayItemsMap['Saturday'] = [];
            dayItemsMap['Saturday'].push(item);
          }
        });

        // Create a group per day that has items
        Object.entries(dayItemsMap).forEach(([day, dayItems]) => {
          if (dayItems.length === 0) return;
          // Friday uses Partner Group 6's current timing; Saturday/Sunday have fixed mappings
          const dayTiming = DAY_TO_TIMING[day] || currentTiming;
          const dayCompleted = dayItems.filter((di) => Boolean(trackingData?.[di.row]?.[colIndex])).length;

          groupsData.push({
            key: `partner_6-${day.toLowerCase()}`,
            name: groupInfo.name,
            timing: dayTiming,
            direct: groupInfo.direct,
            items: dayItems,
            completedCount: dayCompleted,
            totalCount: dayItems.length,
          });
        });
      } else {
        // Standard destination: single group
        groupsData.push({
          key: groupKey,
          name: groupInfo.name,
          timing: currentTiming,
          direct: groupInfo.direct,
          items,
          completedCount: completed,
          totalCount: items.length,
        });
      }

      // Remove processed custom items from map
      if (items.length > 0) {
        customItemsByDestination.delete(destCode);
      }
    });
  }

  // Process custom destinations (those not in standard GROUPS)
  // These are destinations created dynamically via "Manage Destinations"
  // Exclude "surplus" - it's a special destination for storage, not a pickup destination
  if (dynamicDestinations && dynamicDestinations.length > 0) {
    const customDestinations = dynamicDestinations.filter(
      (dest) =>
        dest.isCustom === true &&
        dest.isActive !== false &&
        dest.code !== 'surplus'
    );

    // Group redirected allocations by destination ID
    const redirectedByDestination = new Map<string, CustomDestinationAllocation[]>();
    if (customDestinationAllocations && customDestinationAllocations.length > 0) {
      customDestinationAllocations.forEach((alloc) => {
        // Skip surplus allocations - they don't show in pickup
        if (alloc.destinationCode === 'surplus') return;
        const existing = redirectedByDestination.get(alloc.destinationId) || [];
        existing.push(alloc);
        redirectedByDestination.set(alloc.destinationId, existing);
      });
    }

    customDestinations.forEach((dest) => {
      // Get manually added custom items
      const customForDest = customItemsByDestination.get(dest.code) || [];
      const customItemsConverted = customForDest.map(customItemToItemData);

      // Get redirected items (from standard destinations)
      const redirectedAllocations = redirectedByDestination.get(dest.id) || [];
      const redirectedItems: ItemData[] = redirectedAllocations.map((alloc) => ({
        row: -1, // Redirected items don't have sheet rows in the traditional sense
        name: alloc.itemName,
        quantity: alloc.quantity,
        emoji: alloc.emoji,
        storageType: alloc.storageType || 'Pantry',
        ranOut: false,
        isCustom: false, // These are standard items that were redirected
        isRedirected: true, // Mark as redirected for tracking
        allocationId: alloc.allocationId, // Keep allocation ID for toggle functionality
        isPacked: alloc.isDistributed, // Use distribution status for "picked up"
      }));

      const items = [
        ...customItemsConverted.sort((a, b) => a.name.localeCompare(b.name)),
        ...redirectedItems.sort((a, b) => a.name.localeCompare(b.name)),
      ];

      if (items.length > 0) {
        // Count completed: custom items use isPacked, redirected use isDistributed (stored in isPacked)
        const completed = items.filter((item) => item.isPacked === true).length;
        const timing = dest.timing || 'Unscheduled';

        groupsData.push({
          key: `custom-${dest.id}`,
          name: dest.name,
          timing,
          direct: dest.isDirect,
          items,
          completedCount: completed,
          totalCount: items.length,
        });
      }
    });
  }

  // Sort all groups by timing
  groupsData.sort((a, b) => {
    const aIndex = timingOrder.indexOf(a.timing.toLowerCase());
    const bIndex = timingOrder.indexOf(b.timing.toLowerCase());
    const safeA = aIndex === -1 ? timingOrder.length : aIndex;
    const safeB = bIndex === -1 ? timingOrder.length : bIndex;
    return safeA - safeB;
  });

  return groupsData;
};

/**
 * Build the Reserve group (non-allocated inventory) for display in StorageView.
 * Only includes active items with quantity > 0.
 */
export const buildInventoryStorageGroup = (
  inventoryItems: InventoryItem[]
): GroupData | null => {
  // Filter to active items with positive quantity AND linked to current week's orders.
  // After Clear & Import, old items have order_id = NULL (ON DELETE SET NULL),
  // so only this week's non-allocated (Reserve) imports appear on the Storage tab.
  const activeItems = inventoryItems.filter(
    (item) => item.isActive && item.currentQuantity > 0 && item.orderId !== null
  );

  if (activeItems.length === 0) {
    return null;
  }

  // Convert inventory items to ItemData format
  const items: ItemData[] = activeItems.map((inv) => ({
    row: -1, // Inventory items don't have sheet rows
    name: inv.itemName,
    quantity: inv.currentQuantity,
    emoji: inv.emoji,
    storageType: inv.storageLocation === 'Fridge' ? 'Fridge' : 'Pantry',
    ranOut: false,
    isCustom: false,
    isPacked: inv.isPacked,
    inventoryId: inv.id,
    isInventoryItem: true,
  }));

  // Sort by storage type (Fridge first) then by name
  items.sort((a, b) => {
    if (a.storageType !== b.storageType) {
      return a.storageType === 'Fridge' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const completedCount = items.filter((item) => item.isPacked).length;

  return {
    key: 'inventory',
    name: '📦 Reserve',
    timing: 'Storage',
    direct: false,
    items,
    completedCount,
    totalCount: items.length,
  };
};
