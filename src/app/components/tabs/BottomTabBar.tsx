import React, { useMemo } from 'react';
import { Archive, CheckCircle, Package, Truck } from 'lucide-react';

import { buildPickupGroups, buildStorageGroups, buildInventoryStorageGroup } from '@/app/utils/groups';
import { useAppStore } from '@/services/state';
import { StorageService } from '@/services/storage';
import { cn } from '@/lib/utils';
import { getVisibleTabs } from '@/app/utils/roles';
import type { TabId } from '@/types';

const TAB_CONFIG: Record<TabId, { label: string; icon: React.ReactNode }> = {
  orderConfirmation: { label: 'Confirm', icon: <CheckCircle size={16} strokeWidth={2.5} /> },
  storage: { label: 'Storage', icon: <Package size={16} strokeWidth={2.5} /> },
  pickup: { label: 'Pickup', icon: <Truck size={16} strokeWidth={2.5} /> },
  inventory: { label: 'Inventory', icon: <Archive size={16} strokeWidth={2.5} /> },
};

export const BottomTabBar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    orderConfirmationStatus,
    sheetData,
    storageData,
    trackingData,
    storageTypes,
    destinations,
    customItems,
    customDestinationAllocations,
    daySplits,
    allocationLookup,
    inventoryItems,
    role,
  } = useAppStore((state) => ({
    currentTab: state.currentTab,
    setCurrentTab: state.setCurrentTab,
    orderConfirmationStatus: state.orderConfirmationStatus,
    sheetData: state.sheetData,
    storageData: state.storageData,
    trackingData: state.trackingData,
    storageTypes: state.storageTypes,
    destinations: state.destinations,
    customItems: state.customItems,
    customDestinationAllocations: state.customDestinationAllocations,
    daySplits: state.daySplits,
    allocationLookup: state.allocationLookup,
    inventoryItems: state.inventoryItems,
    role: state.preferences.role,
  }));

  // Get visible tabs based on user's role
  const visibleTabIds = useMemo(() => getVisibleTabs(role), [role]);

  const storageGroups = useMemo(
    () => buildStorageGroups(sheetData, storageData, storageTypes),
    [sheetData, storageData, storageTypes]
  );

  const pickupGroups = useMemo(
    () => buildPickupGroups(sheetData, trackingData, storageTypes, destinations, customItems, customDestinationAllocations, daySplits, allocationLookup),
    [sheetData, trackingData, storageTypes, destinations, customItems, customDestinationAllocations, daySplits, allocationLookup]
  );

  const inventoryStorageGroup = useMemo(
    () => buildInventoryStorageGroup(inventoryItems),
    [inventoryItems]
  );

  const storageTotals = useMemo(() => {
    const allGroups = [...storageGroups];
    if (inventoryStorageGroup) allGroups.push(inventoryStorageGroup);
    return allGroups.reduce(
      (acc, group) => {
        acc.total += group.totalCount;
        acc.completed += group.completedCount;
        return acc;
      },
      { total: 0, completed: 0 }
    );
  }, [storageGroups, inventoryStorageGroup]);

  const pickupTotals = useMemo(() => {
    const destinations = pickupGroups.length;
    const destinationsComplete = pickupGroups.filter(
      (group) => group.totalCount > 0 && group.completedCount === group.totalCount
    ).length;
    return {
      destinations,
      destinationsComplete,
    };
  }, [pickupGroups]);

  // Read counted items from localStorage, recomputing when inventoryItems changes
  const countedItemIds = useMemo(
    () => StorageService.getInstance().loadCountedItems(),
    [inventoryItems]
  );

  const inventoryTotals = useMemo(() => {
    const activeItems = inventoryItems.filter((item) => item.isActive);
    const totalItems = activeItems.length;
    const countedSet = new Set(countedItemIds);
    const countedItems = activeItems.filter((item) => countedSet.has(item.id)).length;
    return { totalItems, countedItems };
  }, [inventoryItems, countedItemIds]);

  const allTabs = useMemo(() => {
    const confirmationTotal = orderConfirmationStatus?.totalItems ?? 0;
    const confirmationConfirmed = orderConfirmationStatus?.confirmedItems ?? 0;

    return [
      {
        id: 'orderConfirmation' as const,
        count: `${confirmationConfirmed}/${confirmationTotal || 0}`,
        progress: confirmationTotal > 0 ? confirmationConfirmed / confirmationTotal : 0,
        hasData: confirmationTotal > 0,
      },
      {
        id: 'storage' as const,
        count: `${storageTotals.completed}/${storageTotals.total || 0}`,
        progress: storageTotals.total > 0 ? storageTotals.completed / storageTotals.total : 0,
        hasData: storageTotals.total > 0,
      },
      {
        id: 'pickup' as const,
        count: `${pickupTotals.destinationsComplete}/${pickupTotals.destinations || 0}`,
        progress:
          pickupTotals.destinations > 0
            ? pickupTotals.destinationsComplete / pickupTotals.destinations
            : 0,
        hasData: pickupTotals.destinations > 0,
      },
      {
        id: 'inventory' as const,
        // Show counted/total to match other tabs' completed/total pattern
        count: `${inventoryTotals.countedItems}/${inventoryTotals.totalItems}`,
        progress:
          inventoryTotals.totalItems > 0
            ? inventoryTotals.countedItems / inventoryTotals.totalItems
            : 0,
        hasData: inventoryTotals.totalItems > 0,
      },
    ];
  }, [orderConfirmationStatus, pickupTotals, storageTotals, inventoryTotals]);

  // Filter tabs based on user's role
  const tabs = useMemo(
    () => allTabs.filter((tab) => visibleTabIds.includes(tab.id)),
    [allTabs, visibleTabIds]
  );

  // Dynamic grid columns based on visible tabs
  const gridColsClass = useMemo(() => {
    switch (tabs.length) {
      case 1:
        return 'grid-cols-1 max-w-[120px]';
      case 2:
        return 'grid-cols-2 max-w-[260px]';
      case 3:
        return 'grid-cols-3 max-w-[360px]';
      default:
        return 'grid-cols-4 max-w-[440px]';
    }
  }, [tabs.length]);

  // Determine progress badge presence based on pending work — shown as a saffron pill
  // in the top-right of the tab glyph when there are outstanding items.
  const getPendingBadge = (tab: { count: string; progress: number; hasData: boolean }) => {
    if (!tab.hasData) return null;
    if (tab.progress >= 1) return null;
    // Extract "done/total" from the count string (e.g. "2/8")
    const match = tab.count.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) return null;
    const done = Number(match[1]);
    const total = Number(match[2]);
    const remaining = Math.max(total - done, 0);
    if (remaining === 0) return null;
    return remaining > 99 ? '99+' : String(remaining);
  };

  return (
    <nav
      className="sticky bottom-0 z-50 border-t border-[#E2E5EC] bg-[rgba(255,255,255,0.92)] [-webkit-backdrop-filter:blur(16px)_saturate(180%)] [backdrop-filter:blur(16px)_saturate(180%)]"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)', paddingTop: '6px' }}
      aria-label="Primary navigation"
      data-tutorial="tab-bar"
    >
      <div className={cn('mx-auto grid h-full gap-1 px-2', gridColsClass)}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const config = TAB_CONFIG[tab.id];
          const pendingBadge = getPendingBadge(tab);

          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'group relative flex min-h-[56px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-[10px] px-2.5 py-1.5 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46FF] focus-visible:ring-offset-2',
                isActive ? 'text-[#4F46FF]' : 'text-[#6B6F82] hover:text-[#373B4F]'
              )}
              onClick={() => setCurrentTab(tab.id)}
              aria-pressed={isActive}
              data-tutorial={
                tab.id === 'orderConfirmation'
                  ? 'tab-confirm'
                  : tab.id === 'storage'
                    ? 'tab-storage'
                    : tab.id === 'pickup'
                      ? 'tab-pickup'
                      : tab.id === 'inventory'
                        ? 'tab-inventory'
                        : 'tab-surplus'
              }
            >
              {/* Active glyph sits in a 30x30 indigoSoft rounded-9px square (design spec) */}
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-[30px] w-[30px] items-center justify-center rounded-[9px] transition-colors',
                  isActive ? 'bg-[#E8E6FF]' : 'bg-transparent'
                )}
              >
                {config.icon}
              </span>

              {/* Label — 10px 600 per design */}
              <span className="text-[10px] font-semibold leading-none tracking-[0.01em]">
                {config.label}
              </span>

              {/* Pending-count badge — saffron with dark ink, top-right of glyph */}
              {pendingBadge && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-1.5 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F5C422] px-1 text-[9px] font-bold leading-none text-[#1A1500]"
                >
                  {pendingBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
