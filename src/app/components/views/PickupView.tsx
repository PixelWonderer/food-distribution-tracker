import React, { useCallback, useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Check, ChevronDown, ChevronUp, RefreshCcw, Undo2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { QuantityBadge } from '@/app/components/ui/quantity-badge';
import { Chip } from '@/app/components/ui/chip';
import { TimingBadge } from '@/app/components/ui/timing-badge';
import { RouteTag, RouteGutter } from '@/app/components/ui/route-tag';
import { useAppStore } from '@/services/state';
import { useModalManager } from '@/app/providers/ModalProvider';
import { getSupabaseService } from '@/services/supabaseService';
import { cn } from '@/lib/utils';
import { buildPickupGroups, buildInventoryStorageGroup } from '@/app/utils/groups';
import { ReserveSection, isReserveConfirmed } from '@/app/components/views/ReserveSection';
import type { GroupData, ItemData, ShiftTaskWithStatus } from '@/types';
import { IconButton } from '@/app/components/ui/icon-button';
import { usePickupTabsController } from '@/app/providers/PickupTabsAnchorProvider';
import { ROLE_CONFIG, isTabVisibleForRole } from '@/app/utils/roles';
import {
  getCurrentTimingSlot,
  normalizeTimingString,
  abbreviateTiming,
  getTimingTone,
} from '@/app/utils/timing';
import { GROUPS } from '@/utils/constants';

const TIMING_ORDER = ['friday am', 'friday noon', 'friday pm', 'saturday am', 'saturday noon', 'saturday pm', 'sunday', 'monday am', 'unscheduled'];

type PickupStatus = 'ready' | 'picked';

const PICKUP_ITEM_STYLES: Record<
  PickupStatus,
  {
    container: string;
    checkbox: string;
    quantityTone: 'lavender' | 'mint';
  }
> = {
  ready: {
    container: 'border-slate-200 bg-white shadow-sm',
    checkbox:
      'border-slate-300 group-hover:border-indigo-400 group-hover:bg-indigo-50 text-transparent group-data-[state=checked]:bg-emerald-500 group-data-[state=checked]:text-white group-data-[state=checked]:border-emerald-500',
    quantityTone: 'lavender',
  },
  picked: {
    container: 'border-green-200 bg-white shadow-sm',
    checkbox: 'border-emerald-500 bg-emerald-500 text-white',
    quantityTone: 'mint',
  },
};

const STORAGE_ICONS: Record<string, string> = {
  fridge: '🧊',
  freezer: '❄️',
  pantry: '📦',
};

const getStorageIcon = (type?: string | null) => {
  if (!type) return '📦';
  const key = type.toLowerCase();
  if (key.includes('fridge') || key.includes('refriger')) return STORAGE_ICONS.fridge;
  if (key.includes('freezer')) return STORAGE_ICONS.freezer;
  return STORAGE_ICONS.pantry;
};

const summarizeDestinationName = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('partner group 7')) {
    return 'Partner Group 7';
  }
  if (lower.includes('partner group 6')) {
    return 'Partner Group 6';
  }
  if (lower.includes('sun')) {
    return 'Sun.';
  }
  return name;
};

const SECTION_STYLES: Record<
  PickupStatus,
  {
    container: string;
    accent: string;
  }
> = {
  ready: {
    container: 'rounded-xl border border-dashed border-amber-200/60 bg-amber-50/60 p-4',
    accent: 'text-amber-700',
  },
  picked: {
    container: 'rounded-xl border border-dashed border-green-200/60 bg-green-50/70 p-4',
    accent: 'text-green-700',
  },
};

const getItemKey = (item: ItemData) => {
  // Custom items use their customId for uniqueness
  if (item.isCustom && item.customId) {
    return `custom-${item.customId}`;
  }
  return `${item.row}-${item.colIndex ?? 'col'}-${item.name}`;
};

const PickupItemCard: React.FC<{
  item: ItemData;
  status: PickupStatus;
  onToggle: (item: ItemData) => void;
  onShowDetails: (item: ItemData) => void;
  onReturnToInventory?: (item: ItemData) => void;
  isMoving: boolean;
  tutorialTarget?: string;
}> = ({ item, status, onToggle, onShowDetails, onReturnToInventory, isMoving, tutorialTarget }) => {
  const pickedUp = status === 'picked';
  const storageIcon = getStorageIcon(item.storageType);
  const canReturn = item.isCustom && item.inventoryItemId && item.customId;

  return (
    <label
      className={cn(
        'group relative flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 focus-within:ring-offset-background',
        PICKUP_ITEM_STYLES[status].container
      )}
      data-moving={isMoving ? 'true' : 'false'}
      data-tutorial={tutorialTarget}
    >
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border border-slate-300 accent-indigo-500"
        checked={pickedUp || isMoving}
        onChange={() => onToggle(item)}
        aria-label={pickedUp ? 'Mark as not picked up' : 'Mark as picked up'}
      />
      <div className="flex w-full items-start gap-3">
        <QuantityBadge
          quantity={item.quantity}
          options={{ hideCaseUnit: true }}
          tone={PICKUP_ITEM_STYLES[status].quantityTone}
          variant="solid"
          className="shrink-0"
        />
        <div className="flex flex-1 gap-3">
          <span aria-hidden className="text-3xl leading-none">
            {item.emoji}
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
              <span className="min-w-0 flex-1 break-words leading-tight">{item.name}</span>
              {item.isCustom && (
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  Custom
                </span>
              )}
              <span aria-label={item.storageType ?? 'Storage type'} className="shrink-0 text-lg leading-none">
                {storageIcon}
              </span>
            </div>
          </div>
        </div>
        {canReturn && onReturnToInventory ? (
          <IconButton
            variant="ghost"
            size="sm"
            bordered
            aria-label="Return to inventory"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onReturnToInventory(item);
            }}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          >
            <Undo2 className="h-4 w-4" />
          </IconButton>
        ) : (
          <IconButton
            variant="ghost"
            size="sm"
            bordered
            aria-label="View item details"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onShowDetails(item);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            ℹ️
          </IconButton>
        )}
      </div>
    </label>
  );
};

// Shift Task Card - recurring time-specific task reminders
// Compact single-line layout: tap row to reveal full title + description; tap checkbox to toggle done.
const ShiftTaskCard: React.FC<{
  task: ShiftTaskWithStatus;
  onToggle: (taskId: string) => void;
}> = ({ task, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDescription = Boolean(task.description);
  const showFooter = (expanded && hasDescription) || (task.isCompleted && task.completedBy);

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-colors',
        task.isCompleted
          ? 'border-[#A7F0CA] bg-[#E9FFF4]'
          : 'border-[#FFCFAC] border-dashed bg-[#FFF4ED]'
      )}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        <input
          type="checkbox"
          className={cn(
            'h-4 w-4 shrink-0 cursor-pointer rounded border',
            task.isCompleted
              ? 'border-[#0F7A4F] accent-[#0F7A4F]'
              : 'border-[#FFAD7A] accent-[#0F7A4F]'
          )}
          checked={task.isCompleted}
          onChange={() => onToggle(task.id)}
          aria-label={task.isCompleted ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        />
        <div
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 leading-tight rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          onClick={toggleExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleExpanded();
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.title}`}
        >
          <span aria-hidden className="text-lg leading-none">
            {task.emoji}
          </span>
          <span className={cn(
            'min-w-0 flex-1 text-sm font-semibold',
            !expanded && 'truncate',
            task.isCompleted ? 'text-[#0F7A4F] line-through' : 'text-[#B75A28]'
          )}>
            {task.title}
          </span>
          <Chip tone={task.isCompleted ? 'mint' : 'peach'} density="tag" aria-disabled="true" tabIndex={-1}>
            Task
          </Chip>
          <span aria-hidden className="text-amber-600">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        </div>
      </div>
      {showFooter && (
        <div className="flex flex-col gap-0.5 px-3 pb-2 pl-9">
          {expanded && hasDescription && (
            <p className="text-xs italic text-[#6B6F82]">{task.description}</p>
          )}
          {task.isCompleted && task.completedBy && (
            <p className="text-xs text-[#0F7A4F]">✓ {task.completedBy}</p>
          )}
        </div>
      )}
    </div>
  );
};

export const PickupView: React.FC = () => {
  const {
    sheetData,
    trackingData,
    storageTypes,
    destinations,
    customItems,
    customDestinationAllocations,
    daySplits,
    allocationLookup,
    redirectedAwayBySource,
    inventoryItems,
    isSyncing,
    role,
    selectedGroups,
    selectedTiming,
    shiftTasks,
    showShiftTasks,
  } = useAppStore((state) => ({
    sheetData: state.sheetData,
    trackingData: state.trackingData,
    storageTypes: state.storageTypes,
    destinations: state.destinations,
    customItems: state.customItems,
    customDestinationAllocations: state.customDestinationAllocations,
    daySplits: state.daySplits,
    allocationLookup: state.allocationLookup,
    redirectedAwayBySource: state.redirectedAwayBySource,
    inventoryItems: state.inventoryItems,
    isSyncing: state.isSyncing,
    role: state.preferences.role,
    selectedGroups: state.preferences.selectedGroups,
    selectedTiming: state.preferences.selectedTiming,
    shiftTasks: state.shiftTasks,
    showShiftTasks: state.preferences.showShiftTasks,
  }));

  const toggleShiftTask = useAppStore((state) => state.toggleShiftTask);

  const toggleItem = useAppStore((state) => state.toggleItem);
  const returnCustomItemToInventory = useAppStore((state) => state.returnCustomItemToInventory);
  const { openItemDetail } = useModalManager();

  // Check if role-based group hiding is active (foodBank, coopDelivery — NOT pickupOnly, which uses focus mode)
  const isRoleGroupRestrictionActive = role && role !== 'fullAccess' && role !== 'pickupOnly';
  // Session-only flag to show all groups temporarily (for foodBank/coopDelivery)
  const [showAllOverride, setShowAllOverride] = useState(false);

  // Get description for roles with fixed groups (foodBank, coopDelivery)
  const roleFilterDescription = useMemo(() => {
    if (!role || role === 'fullAccess' || role === 'pickupOnly') return '';
    const config = ROLE_CONFIG[role];
    if (config.shortName) return config.shortName;
    return config.name;
  }, [role]);

  // Handler for Show All toggle (session-only, for foodBank/coopDelivery roles)
  const handleShowAllToggle = useCallback(() => {
    setShowAllOverride((prev) => !prev);
  }, []);

  // Pass dynamic destinations and custom items for on-the-fly changes
  const allGroups = useMemo(
    () => buildPickupGroups(sheetData, trackingData, storageTypes, destinations, customItems, customDestinationAllocations, daySplits, allocationLookup),
    [sheetData, trackingData, storageTypes, destinations, customItems, customDestinationAllocations, daySplits, allocationLookup]
  );

  // Filter groups based on user's role
  // pickupOnly uses focus mode (all groups visible, selected group auto-focused via nav)
  // Other restricted roles (foodBank, coopDelivery) still hide non-allowed groups
  const groups = useMemo(() => {
    // Show All override bypasses role filtering (session-only)
    if (showAllOverride) return allGroups;

    if (!role) return allGroups; // No role = show all (fullAccess)

    const config = ROLE_CONFIG[role];

    // Full access shows everything
    if (config.groups === 'all') return allGroups;

    // pickupOnly: focus mode — show all groups, navigation handles focus
    if (config.groups === 'userSelected') return allGroups;

    // Role-specific groups (coopDelivery, foodBank)
    // Use pickupGroups if available (for Food Bank role's limited pickup view)
    // Match per-day groups (e.g., partner_6-friday) against base key (partner_6)
    const allowedGroups = (config.pickupGroups ?? config.groups) as string[];
    return allGroups.filter((group) =>
      allowedGroups.some((allowed) => group.key === allowed || group.key.startsWith(allowed + '-'))
    );
  }, [allGroups, role, showAllOverride]);

  const nonEmptyGroups = useMemo(
    () => groups.filter((group) => group.totalCount > 0),
    [groups]
  );

  // Auto-detect current timing slot on initial render, with auto-focus for pickupOnly
  const [activeDestination, setActiveDestination] = useState<string | null>(() => {
    // For pickupOnly with selectedGroups, auto-select the timing of their first group
    if (role === 'pickupOnly' && selectedGroups && selectedGroups.length > 0) {
      const firstGroupKey = selectedGroups[0];
      // Static groups (e.g., "partner_1", "partner_8")
      const groupConfig = GROUPS[firstGroupKey as keyof typeof GROUPS];
      if (groupConfig) {
        return normalizeTimingString(groupConfig.timing);
      }
      // Custom destinations (key format: "custom-{id}")
      if (firstGroupKey.startsWith('custom-')) {
        const destId = firstGroupKey.replace('custom-', '');
        const dest = destinations.find((d) => d.id === destId);
        if (dest?.timing) {
          return normalizeTimingString(dest.timing);
        }
      }
    }
    // For pickupOnly with selectedTiming, auto-select their first timing
    if (role === 'pickupOnly' && selectedTiming && selectedTiming.length > 0) {
      return selectedTiming[0];
    }
    const currentSlot = getCurrentTimingSlot();
    return currentSlot; // null if not a distribution day, otherwise the timing slot
  });

  // Group sub-filter within the selected timing bucket
  const [activeGroup, setActiveGroup] = useState<string | null>(() => {
    // For pickupOnly with exactly one selected group, auto-focus it
    if (role === 'pickupOnly' && selectedGroups && selectedGroups.length === 1) {
      return selectedGroups[0];
    }
    return null;
  });
  const [readySectionState, setReadySectionState] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('tracker_pickup_section_ready');
      return stored ? JSON.parse(stored) : {};
    } catch { /* localStorage unavailable */ return {}; }
  });
  const [pickedSectionState, setPickedSectionState] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('tracker_pickup_section_picked');
      return stored ? JSON.parse(stored) : {};
    } catch { /* localStorage unavailable */ return {}; }
  });
  const [pendingMoves, setPendingMoves] = useState<Record<string, boolean>>({});
  const { setRenderer: setPickupTabsRenderer } = usePickupTabsController();
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingMoveTimers = useRef<Record<string, number>>({});

  // Separate completed and active groups
  const { activeGroups, completedGroups } = useMemo(() => {
    const active: GroupData[] = [];
    const completed: GroupData[] = [];

    nonEmptyGroups.forEach((group) => {
      const isComplete = group.totalCount > 0 && group.completedCount === group.totalCount;
      if (isComplete) {
        completed.push(group);
      } else {
        active.push(group);
      }
    });

    return { activeGroups: active, completedGroups: completed };
  }, [nonEmptyGroups]);

  const destinationSummary = useMemo(() => {
    const total = nonEmptyGroups.length;
    const completed = nonEmptyGroups.filter(
      (group) => group.totalCount > 0 && group.completedCount === group.totalCount
    ).length;
    return { total, completed };
  }, [nonEmptyGroups]);

  const bucketData = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        groups: GroupData[];
        total: number;
        completed: number;
      }
    >();

    activeGroups.forEach((group) => {
      const timingKey = (group.timing ?? 'Unscheduled').toLowerCase();
      if (!map.has(timingKey)) {
        map.set(timingKey, {
          key: timingKey,
          label: group.timing ?? 'Unscheduled',
          groups: [],
          total: 0,
          completed: 0,
        });
      }

      const bucket = map.get(timingKey)!;
      bucket.groups.push(group);
      bucket.total += group.totalCount;
      bucket.completed += group.completedCount;
    });

    const orderedBuckets = Array.from(map.values()).sort((a, b) => {
      const aIndex = TIMING_ORDER.indexOf(a.key);
      const bIndex = TIMING_ORDER.indexOf(b.key);
      const safeA = aIndex === -1 ? TIMING_ORDER.length : aIndex;
      const safeB = bIndex === -1 ? TIMING_ORDER.length : bIndex;
      return safeA - safeB;
    });

    return {
      orderedBuckets,
      bucketMap: map,
    };
  }, [activeGroups]);

  useEffect(() => {
    if (!activeDestination) {
      return;
    }

    if (!bucketData.bucketMap.has(activeDestination)) {
      setActiveDestination(null);
    }
  }, [activeDestination, bucketData]);

  const filteredGroups = useMemo(() => {
    if (!activeDestination) {
      return activeGroups;
    }
    const bucketGroups = bucketData.bucketMap.get(activeDestination)?.groups ?? [];
    if (!activeGroup) return bucketGroups;
    return bucketGroups.filter((g) => g.key === activeGroup);
  }, [activeGroups, activeDestination, activeGroup, bucketData.bucketMap]);

  // Reserve (non-allocated stock held for the cookhouses) is pinned FIRST on every timing
  // filter (Friday AM, Friday PM, ...) until all of it is confirmed; once confirmed it only
  // shows under the "All" filter. Only for roles that can see the Storage tab.
  const reserveGroup = useMemo(
    () => (isTabVisibleForRole('storage', role) ? buildInventoryStorageGroup(inventoryItems) : null),
    [inventoryItems, role]
  );
  const showReserve =
    reserveGroup !== null && (!activeDestination || !isReserveConfirmed(reserveGroup));

  // All shift tasks to render at top of Pickup view (gated by preference)
  const allShiftTasks = useMemo(() => {
    if (!showShiftTasks || !shiftTasks || shiftTasks.length === 0) return [];
    return shiftTasks;
  }, [shiftTasks, showShiftTasks]);

  // Collapse/expand state for shift tasks card
  const [shiftTasksExpanded, setShiftTasksExpanded] = useState(true);
  // "+ N more" overflow state for the pending list (top 2 shown by default)
  const [showAllPending, setShowAllPending] = useState(false);

  // Split shift tasks into pending and completed
  const pendingShiftTasks = useMemo(() => allShiftTasks.filter((t) => !t.isCompleted), [allShiftTasks]);
  const completedShiftTasks = useMemo(() => allShiftTasks.filter((t) => t.isCompleted), [allShiftTasks]);
  const visiblePendingShiftTasks = useMemo(
    () => (showAllPending ? pendingShiftTasks : pendingShiftTasks.slice(0, 2)),
    [pendingShiftTasks, showAllPending]
  );
  const hiddenPendingCount = pendingShiftTasks.length - visiblePendingShiftTasks.length;

  // Auto-collapse card when all tasks are done, auto-expand when any become pending
  useEffect(() => {
    if (allShiftTasks.length === 0) return;
    setShiftTasksExpanded(pendingShiftTasks.length > 0);
  }, [allShiftTasks.length, pendingShiftTasks.length]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true; // Reset on remount (React StrictMode runs cleanup then re-mounts)
    return () => {
      isMountedRef.current = false;
      Object.values(pendingMoveTimers.current).forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, []);

  // Persist section expand/collapse preferences
  useEffect(() => {
    try { localStorage.setItem('tracker_pickup_section_ready', JSON.stringify(readySectionState)); } catch { /* ignore */ }
  }, [readySectionState]);
  useEffect(() => {
    try { localStorage.setItem('tracker_pickup_section_picked', JSON.stringify(pickedSectionState)); } catch { /* ignore */ }
  }, [pickedSectionState]);

  const fetchData = useAppStore((state) => state.fetchData);

  const isItemPicked = useCallback(
    (item: ItemData) => {
      const key = getItemKey(item);
      if (pendingMoves[key]) {
        return false;
      }

      // Custom items use isPacked field
      if (item.isCustom) {
        return item.isPacked === true;
      }

      // Redirected items use isPacked (from isDistributed status)
      if (item.isRedirected) {
        return item.isPacked === true;
      }

      // Standard items use trackingData
      if (!trackingData) return false;
      if (typeof item.colIndex === 'number') {
        return Boolean(trackingData[item.row]?.[item.colIndex]);
      }
      return false;
    },
    [trackingData, pendingMoves]
  );

  const setItemPicked = useCallback(
    async (item: ItemData, picked: boolean) => {
      // Custom items - toggle via Supabase
      if (item.isCustom && item.customId) {
        const supabase = getSupabaseService();
        await supabase.toggleCustomItem(item.customId, picked);
        // Refresh data to update UI
        await fetchData();
        return;
      }

      // Redirected items - toggle distribution via Supabase
      if (item.isRedirected && item.allocationId) {
        const supabase = getSupabaseService();
        await supabase.toggleDistribution(item.allocationId);
        // Refresh data to update UI
        await fetchData();
        return;
      }

      // Standard items - toggle via trackingData
      if (!trackingData || typeof item.colIndex !== 'number') {
        return;
      }

      const current = Boolean(trackingData[item.row]?.[item.colIndex]);
      if (current === picked) {
        return;
      }

      await toggleItem(item.row, item.colIndex, 'tracking');
    },
    [toggleItem, trackingData, fetchData]
  );

  // Keep a ref to the latest setItemPicked so the 900ms animation timer
  // always calls the current version, not a stale closure capture.
  const setItemPickedRef = useRef(setItemPicked);
  useEffect(() => { setItemPickedRef.current = setItemPicked; }, [setItemPicked]);

  const handleToggle = useCallback(
    (item: ItemData) => {
      const next = !isItemPicked(item);
      const key = getItemKey(item);

      if (next) {
        if (pendingMoveTimers.current[key]) {
          clearTimeout(pendingMoveTimers.current[key]!);
        }
        setPendingMoves((prev) => ({ ...prev, [key]: true }));
        pendingMoveTimers.current[key] = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          setPendingMoves((prev) => {
            const { [key]: _omit, ...rest } = prev;
            return rest;
          });
          void setItemPickedRef.current(item, true);
          delete pendingMoveTimers.current[key];
        }, 900);
      } else {
        if (pendingMoveTimers.current[key]) {
          clearTimeout(pendingMoveTimers.current[key]!);
          delete pendingMoveTimers.current[key];
        }
        setPendingMoves((prev) => {
          const { [key]: _omit, ...rest } = prev;
          return rest;
        });
        void setItemPickedRef.current(item, false);
      }
    },
    [isItemPicked]
  );

  const handleMarkDestination = useCallback(
    async (group: GroupData, picked: boolean) => {
      for (const item of group.items) {
        await setItemPicked(item, picked);
      }
    },
    [setItemPicked]
  );

  const handleShowDetails = useCallback(
    (item: ItemData) => {
      const unit =
        item.row >= 0 && sheetData?.[item.row]
          ? (typeof sheetData[item.row][1] === 'string' ? sheetData[item.row][1] : null)
          : null;

      openItemDetail({
        itemName: item.name,
        sheetRow: item.row >= 0 ? item.row : undefined,
        emoji: item.emoji,
        expectedQuantity: item.quantity,
        storageType: item.storageType,
        unit: unit ?? undefined,
        source: 'pickup',
        mode: 'pickup',
      });
    },
    [openItemDetail, sheetData]
  );

  const handleReturnToInventory = useCallback(
    (item: ItemData) => {
      if (!item.customId || !item.inventoryItemId) return;
      returnCustomItemToInventory(item.customId, item.inventoryItemId, item.quantity, item.name);
    },
    [returnCustomItemToInventory]
  );

  // Tab descriptors for the pickup timing chips
  type PickupTab = {
    key: string | null;
    label: string;
    completed: number;
    total: number;
  };

  const tabDescriptors = useMemo<PickupTab[]>(() => {
    // Return empty array when no data - hooks must run consistently
    if (!sheetData) {
      return [];
    }

    const tabs: PickupTab[] = [
      {
        key: null,
        label: 'All',
        completed: destinationSummary.completed,
        total: destinationSummary.total,
      },
    ];

    bucketData.orderedBuckets.forEach((bucket) => {
      tabs.push({
        key: bucket.key,
        label: bucket.label,
        completed: bucket.completed,
        total: bucket.total,
      });
    });

    return tabs;
  }, [sheetData, activeGroups, bucketData, destinationSummary]);

  // Group sub-tab descriptors for Row 2 (within selected timing bucket)
  type GroupTab = {
    key: string | null; // group key, null = "All in this timing"
    label: string;
    completed: number;
    total: number;
  };

  const groupTabDescriptors = useMemo<GroupTab[]>(() => {
    if (!activeDestination) return [];
    const bucket = bucketData.bucketMap.get(activeDestination);
    if (!bucket || bucket.groups.length <= 1) return []; // No sub-tabs for single-group timings
    const tabs: GroupTab[] = [
      {
        key: null,
        label: 'All',
        completed: bucket.completed,
        total: bucket.total,
      },
    ];
    bucket.groups.forEach((group) => {
      tabs.push({
        key: group.key,
        label: summarizeDestinationName(group.name),
        completed: group.completedCount,
        total: group.totalCount,
      });
    });
    return tabs;
  }, [activeDestination, bucketData.bucketMap]);

  // Refs for group sub-tab chips (Row 2)
  const groupChipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Auto-scroll timing chip into view
  useEffect(() => {
    const key = activeDestination ?? 'all';
    const node = chipRefs.current[key];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeDestination]);

  // Auto-scroll group chip into view
  useEffect(() => {
    const key = activeGroup ?? 'all-groups';
    const node = groupChipRefs.current[key];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeGroup]);

  // Reset activeGroup when timing changes
  useEffect(() => {
    setActiveGroup(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDestination]);

  // Cleanup: reset activeGroup if it becomes invalid (group removed from bucket)
  useEffect(() => {
    if (!activeGroup || !activeDestination) return;
    const bucket = bucketData.bucketMap.get(activeDestination);
    if (!bucket || !bucket.groups.some((g) => g.key === activeGroup)) {
      setActiveGroup(null);
    }
  }, [activeGroup, activeDestination, bucketData.bucketMap]);

  // Get current timing slot for visual indicator
  const currentTimingSlot = useMemo(() => getCurrentTimingSlot(), []);

  const renderTabsContent = useCallback(
    () => (
      <div className="flex flex-col gap-1.5" data-tutorial="pickup-chips">
        {/* Row 1: Timing tabs */}
        <div className="flex w-full gap-2 overflow-x-auto px-1 scrollbar-thin">
          {tabDescriptors.map((tab) => {
            const isActive = (tab.key ?? null) === activeDestination;
            const refKey = tab.key ?? 'all';
            const isSundayChip = tab.key?.toLowerCase() === 'sunday';
            const isCurrentSlot = tab.key && currentTimingSlot && tab.key === currentTimingSlot;

            return (
              <Chip
                ref={(node) => {
                  chipRefs.current[refKey] = node;
                }}
                key={tab.key ?? 'all-destinations'}
                tone={tab.key ? 'indigo' : 'neutral'}
                density="compact"
                active={isActive}
                onClick={() => setActiveDestination((tab.key as string | null) ?? null)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-left shadow-sm',
                  tab.key
                    ? 'border-slate-200 data-[state=active]:border-indigo-500 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700'
                    : 'border-slate-200 text-slate-600 data-[state=active]:border-indigo-500 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700'
                )}
                data-tutorial={isSundayChip ? 'pickup-chip-sunday' : undefined}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {tab.key ? abbreviateTiming(tab.label) : 'All'}
                  {isCurrentSlot && (
                    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" title="Current time slot" />
                  )}
                </span>
              </Chip>
            );
          })}
        </div>

        {/* Row 2: Group sub-tabs (visible when a timing is selected and has 2+ groups) */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-200 ease-out',
            groupTabDescriptors.length > 0
              ? 'max-h-16 opacity-100'
              : 'max-h-0 opacity-0'
          )}
        >
          <div className="flex w-full gap-1.5 overflow-x-auto px-1 scrollbar-thin">
            {groupTabDescriptors.map((tab) => {
              const isActive = (tab.key ?? null) === activeGroup;
              const refKey = tab.key ?? 'all-groups';

              return (
                <Chip
                  ref={(node) => {
                    groupChipRefs.current[refKey] = node;
                  }}
                  key={tab.key ?? 'all-groups'}
                  tone={tab.key ? 'purple' : 'neutral'}
                  density="compact"
                  active={isActive}
                  onClick={() => setActiveGroup(tab.key)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left shadow-sm',
                    tab.key
                      ? 'border-purple-200/60 bg-white data-[state=active]:border-purple-500 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700'
                      : 'border-slate-200 bg-white text-slate-600 data-[state=active]:border-slate-400 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-800'
                  )}
                >
                  <span className="text-xs font-semibold">{tab.label}</span>
                </Chip>
              );
            })}
          </div>
        </div>
      </div>
    ),
    [tabDescriptors, activeDestination, setActiveDestination, currentTimingSlot, groupTabDescriptors, activeGroup, setActiveGroup]
  );

  useLayoutEffect(() => {
    if (tabDescriptors.length === 0) {
      setPickupTabsRenderer(null);
      return () => setPickupTabsRenderer(null);
    }

    setPickupTabsRenderer(renderTabsContent);

    return () => {
      setPickupTabsRenderer(null);
    };
  }, [renderTabsContent, setPickupTabsRenderer, tabDescriptors.length]);

  // Early return AFTER all hooks to comply with Rules of Hooks
  if (!sheetData) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-sm text-muted-foreground shadow-sm">
          Pickup routes load after confirmations and storage are complete.
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filter banner for roles with fixed group restrictions (Food Bank, Co-op Delivery) */}
        {isRoleGroupRestrictionActive && roleFilterDescription && !showAllOverride && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-600">
              👤 {roleFilterDescription} view
            </span>
            <button
              type="button"
              onClick={handleShowAllToggle}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              Show All
            </button>
          </div>
        )}

        {/* Show All active indicator - allows returning to filtered view */}
        {showAllOverride && isRoleGroupRestrictionActive && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
            <span className="text-sm font-medium text-emerald-700">
              ✓ Showing all destinations
            </span>
            <button
              type="button"
              onClick={handleShowAllToggle}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-600 shadow-sm transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Back to {roleFilterDescription || 'filtered'} view
            </button>
          </div>
        )}

        {/* Reserve - always first, above shift tasks and destination groups */}
        {showReserve && reserveGroup ? (
          <ReserveSection
            group={reserveGroup}
            dividerBelow={filteredGroups.length > 0 || allShiftTasks.length > 0}
          />
        ) : null}

        {/* Shift Tasks - single card at top, all tasks regardless of timing */}
        {allShiftTasks.length > 0 && (
          <Card className="gap-0 scroll-mt-6 border-amber-200/60 bg-amber-50/20 pt-2 shadow-sm">
            <CardHeader
              className="cursor-pointer gap-2 pb-2"
              onClick={() => setShiftTasksExpanded((prev) => !prev)}
            >
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-amber-800">
                  📋 Shift Tasks
                </CardTitle>
                <Badge className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {completedShiftTasks.length}/{allShiftTasks.length}
                </Badge>
                <button
                  type="button"
                  className="ml-auto rounded-full p-1 text-amber-600 hover:bg-amber-100"
                  aria-label={shiftTasksExpanded ? 'Collapse shift tasks' : 'Expand shift tasks'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShiftTasksExpanded((prev) => !prev);
                  }}
                >
                  {shiftTasksExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
              </div>
            </CardHeader>
            {shiftTasksExpanded && (
              <CardContent className="flex flex-col gap-2 border-t border-dashed border-amber-200/60 py-2">
                {/* Pending tasks — show first 2, with "+ N more" overflow */}
                {pendingShiftTasks.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {visiblePendingShiftTasks.map((task) => (
                      <ShiftTaskCard
                        key={task.id}
                        task={task}
                        onToggle={toggleShiftTask}
                      />
                    ))}
                    {pendingShiftTasks.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setShowAllPending((prev) => !prev)}
                        className="self-start rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        aria-expanded={showAllPending}
                      >
                        {showAllPending ? 'Show fewer' : `+ ${hiddenPendingCount} more`}
                      </button>
                    )}
                  </div>
                )}

                {/* Completed tasks — collapsed by default */}
                {completedShiftTasks.length > 0 && (
                  <details className="group rounded-xl border border-dashed border-green-200/60 bg-green-50/70 px-3 py-2 transition-colors [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                      <span className="flex items-center gap-2">
                        Completed
                        <span className="text-green-700">({completedShiftTasks.length})</span>
                      </span>
                      <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-open:hidden">
                        Show
                      </span>
                      <span className="hidden text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-open:block">
                        Hide
                      </span>
                    </summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {completedShiftTasks.map((task) => (
                        <ShiftTaskCard
                          key={task.id}
                          task={task}
                          onToggle={toggleShiftTask}
                        />
                      ))}
                    </div>
                  </details>
                )}

                {/* All done message when no pending tasks */}
                {pendingShiftTasks.length === 0 && (
                  <p className="text-center text-sm text-green-700">All tasks completed!</p>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {filteredGroups.map((group, groupIndex) => {
        const readyItems = group.items.filter((item) => !isItemPicked(item));
        const pickedItems = group.items.filter((item) => isItemPicked(item));
        const allPicked = group.totalCount > 0 && group.completedCount === group.totalCount;
        const isFirstGroup = groupIndex === 0;

        const displayName = summarizeDestinationName(group.name);
        const progressPct = group.totalCount > 0 ? Math.round((group.completedCount / group.totalCount) * 100) : 0;
        const timingTone = getTimingTone(group.timing);
        const progressFill = allPicked ? '#0F7A4F' : timingTone.dot;

        return (
          <React.Fragment key={group.key}>
          <Card className="relative gap-0 overflow-hidden shadow-sm" data-tutorial={isFirstGroup ? 'pickup-destination' : undefined}>
            <RouteGutter direct={group.direct} />
            <CardHeader className={cn('gap-4', group.direct && 'pl-[calc(1rem+4px)]')}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg font-semibold text-foreground">{displayName}</CardTitle>
                      {group.timing ? <TimingBadge timing={group.timing} /> : null}
                      <RouteTag direct={group.direct} />
                    </div>
                    {/* Contact/items meta row — 12px slate-500 with interpunct separators */}
                    <div className="flex items-center gap-1.5 text-[12px] text-[#6B6F82]">
                      <span>
                        {group.totalCount} item{group.totalCount === 1 ? '' : 's'}
                      </span>
                      {allPicked && (
                        <>
                          <span
                            aria-hidden
                            className="inline-block rounded-full bg-[#C8CCD8]"
                            style={{ width: 2, height: 2 }}
                          />
                          <span className="font-semibold text-[#0F7A4F]">✓ Picked up</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="confirm"
                    disabled={isSyncing || allPicked}
                    onClick={() => void handleMarkDestination(group, true)}
                    data-tutorial={isFirstGroup ? 'pickup-mark-all' : undefined}
                  >
                    <Check className="size-4" />
                    Mark all picked up
                  </Button>
                </div>
                {/* Timing-colored progress bar + N/M count — design's primary progress cue */}
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex-1 overflow-hidden rounded-full bg-[#F0F2F6]"
                    style={{ height: 6 }}
                    role="progressbar"
                    aria-valuenow={group.completedCount}
                    aria-valuemin={0}
                    aria-valuemax={group.totalCount}
                    aria-label={`${group.completedCount} of ${group.totalCount} items picked up`}
                  >
                    <div
                      className="h-full transition-[width] duration-300"
                      style={{ width: `${progressPct}%`, background: progressFill }}
                    />
                  </div>
                  <span className="min-w-[30px] text-right text-[11px] font-semibold text-[#6B6F82]">
                    {group.completedCount}/{group.totalCount}
                  </span>
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSyncing || group.completedCount === 0}
                    onClick={() => void handleMarkDestination(group, false)}
                    className="w-full max-w-[160px] justify-center"
                  >
                    <RefreshCcw className="size-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 border-t border-dashed border-border/60 py-6">
              {readyItems.length === 0 && pickedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
                  This destination has no items assigned after confirmation.
                </div>
              ) : (
                <>
                  {readyItems.length > 0 ? (
                    <details
                      className={cn(
                        'group transition-colors [&_summary::-webkit-details-marker]:hidden',
                        SECTION_STYLES.ready.container
                      )}
                      open={readySectionState[group.key] ?? true}
                      onToggle={(event) => {
                        const next = event.currentTarget ? event.currentTarget.open : true;
                        setReadySectionState((prev) => ({
                          ...prev,
                          [group.key]: next,
                        }));
                      }}
                    >
                      <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                        <span className="flex items-center gap-2">
                          Ready for pickup
                          <span className={SECTION_STYLES.ready.accent}>({readyItems.length})</span>
                        </span>
                        <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-open:hidden">
                          Show
                        </span>
                        <span className="hidden text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-open:block">
                          Hide
                        </span>
                      </summary>
                      <div className="mt-4 flex flex-col gap-3">
                        {readyItems.map((item, itemIndex) => {
                          const itemKey = getItemKey(item);
                          return (
                            <PickupItemCard
                              key={`${item.row}-${item.name}-${group.key}`}
                              item={item}
                              status="ready"
                              isMoving={Boolean(pendingMoves[itemKey])}
                              onToggle={handleToggle}
                              onShowDetails={handleShowDetails}
                              onReturnToInventory={handleReturnToInventory}
                              tutorialTarget={isFirstGroup && itemIndex === 0 ? 'pickup-item' : undefined}
                            />
                          );
                        })}
                      </div>
                    </details>
                  ) : null}

                  {pickedItems.length > 0 ? (
                    <details
                      className={cn(
                        'group transition-colors [&_summary::-webkit-details-marker]:hidden',
                        SECTION_STYLES.picked.container
                      )}
                      open={pickedSectionState[group.key] ?? false}
                      onToggle={(event) => {
                        const next = event.currentTarget ? event.currentTarget.open : true;
                        setPickedSectionState((prev) => ({
                          ...prev,
                          [group.key]: next,
                        }));
                      }}
                    >
                      <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                        <span className="flex items-center gap-2">
                          Picked up
                          <span className={SECTION_STYLES.picked.accent}>({pickedItems.length})</span>
                        </span>
                        <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-open:hidden">
                          Show
                        </span>
                        <span className="hidden text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-open:block">
                          Hide
                        </span>
                      </summary>
                      <div className="mt-4 flex flex-col gap-3">
                        {pickedItems.map((item) => {
                          const itemKey = getItemKey(item);
                          return (
                            <PickupItemCard
                              key={`${item.row}-${item.name}-${group.key}`}
                              item={item}
                              status="picked"
                              isMoving={Boolean(pendingMoves[itemKey])}
                              onToggle={handleToggle}
                              onShowDetails={handleShowDetails}
                              onReturnToInventory={handleReturnToInventory}
                            />
                          );
                        })}
                      </div>
                    </details>
                  ) : null}

                  {/* Redirected Away Section */}
                  {(() => {
                    const dest = destinations.find((d) => d.code === group.key);
                    const redirectedAway = dest ? redirectedAwayBySource[dest.id] ?? [] : [];

                    if (redirectedAway.length === 0) return null;

                    return (
                      <details
                        className={cn(
                          'group transition-colors [&_summary::-webkit-details-marker]:hidden',
                          'rounded-xl border border-dashed border-violet-200/60 bg-violet-50/30 p-4'
                        )}
                      >
                        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                          <span className="flex items-center gap-2">
                            <span className="text-violet-600">🔀</span>
                            Redirected away
                            <span className="text-violet-600">({redirectedAway.length})</span>
                          </span>
                          <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-open:hidden">
                            Show
                          </span>
                          <span className="hidden text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-open:block">
                            Hide
                          </span>
                        </summary>
                        <div className="mt-3 space-y-2">
                          {redirectedAway.map((item) => (
                            <div
                              key={item.redirectionId}
                              className="flex items-center gap-3 rounded-lg border border-violet-200 bg-white/80 px-3 py-2"
                            >
                              <span className="text-xl">{item.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-foreground truncate">
                                    {item.itemName}
                                  </span>
                                  <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                    {item.quantity}x
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <span>→ {item.targetDestinationName}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
          </React.Fragment>
        );
      })}

        {completedGroups.length > 0 && (
        <Card className="gap-0 border border-green-100 bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={16} strokeWidth={3} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">Completed destinations</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {completedGroups.length} finished
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 border-t border-dashed border-green-100 py-4">
            {completedGroups.map((group) => {
              const displayName = summarizeDestinationName(group.name);
              return (
                <details
                  key={group.key}
                  className="group rounded-xl border border-green-100 bg-green-50 px-4 py-3"
                >
                  <summary className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-foreground">
                    <span className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-600" />
                      {displayName}
                    </span>
                    <div className="flex items-center gap-3">
                      {group.timing ? <TimingBadge timing={group.timing} /> : null}
                      <RouteTag direct={group.direct} />
                      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        <span className="group-open:hidden">Show</span>
                        <span className="hidden group-open:inline">Hide</span>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4 rounded-xl border border-green-200 bg-white p-4 opacity-[0.7]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardDescription className="text-sm text-muted-foreground">
                        {group.completedCount}/{group.totalCount} items picked up
                      </CardDescription>
                      {/* Read-only mint "✓ Picked up" label — Reset lives in Quick Actions for coordinators */}
                      <Chip tone="mint" density="tag" aria-disabled="true" tabIndex={-1}>
                        ✓ Picked up
                      </Chip>
                    </div>
                    <div className="mt-4 flex flex-col gap-3">
                      {group.items.map((item) => {
                        const itemKey = getItemKey(item);
                        const picked = isItemPicked(item);
                        return (
                          <PickupItemCard
                            key={`${item.row}-${item.name}-${group.key}-completed`}
                            item={item}
                            status={picked ? 'picked' : 'ready'}
                            isMoving={Boolean(pendingMoves[itemKey])}
                            onToggle={handleToggle}
                            onShowDetails={handleShowDetails}
                            onReturnToInventory={handleReturnToInventory}
                          />
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
          </CardContent>
        </Card>
        )}
      </div>
    </>
  );
};
