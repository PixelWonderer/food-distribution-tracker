import React, { useCallback, useMemo, useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Chip } from '@/app/components/ui/chip';
import { StorageItemRow } from '@/app/components/views/StorageItemRow';
import { ReserveSection, isReserveConfirmed } from '@/app/components/views/ReserveSection';
import { useAppStore } from '@/services/state';
import { useModalManager } from '@/app/providers/ModalProvider';
import { toast } from '@/lib/toast';
import { buildStorageGroups, buildInventoryStorageGroup } from '@/app/utils/groups';
import type { GroupData, ItemData } from '@/types';

type StorageFilter = 'all' | 'fridge' | 'table' | 'inventory';

const GROUP_ICONS: Record<string, string> = {
  fridge: '🧊',
  table: '🟫',
  inventory: '📦',
};

const GROUP_LABELS: Record<string, string> = {
  fridge: 'Fridge items',
  table: 'Table items',
  inventory: 'Reserve',
};

// Strip a leading emoji from a group name so we can render it with our own slot.
const stripLeadingEmoji = (name: string): string => {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length > 1 && tokens[0].length <= 3) {
    return tokens.slice(1).join(' ');
  }
  return name;
};

export const StorageView: React.FC = () => {
  const { sheetData, storageData, storageTypes, isSyncing, inventoryItems } = useAppStore((state) => ({
    sheetData: state.sheetData,
    storageData: state.storageData,
    storageTypes: state.storageTypes,
    isSyncing: state.isSyncing,
    inventoryItems: state.inventoryItems,
  }));

  const toggleItem = useAppStore((state) => state.toggleItem);
  const toggleInventoryPacked = useAppStore((state) => state.toggleInventoryPacked);
  const setAllInventoryPacked = useAppStore((state) => state.setAllInventoryPacked);
  const { openItemDetail } = useModalManager();

  const [activeFilter, setActiveFilter] = useState<StorageFilter>('all');

  const storageGroups = useMemo(
    () => buildStorageGroups(sheetData, storageData, storageTypes),
    [sheetData, storageData, storageTypes]
  );

  const inventoryGroup = useMemo(
    () => buildInventoryStorageGroup(inventoryItems),
    [inventoryItems]
  );

  const groups = useMemo(() => {
    const result = [...storageGroups];
    if (inventoryGroup) {
      result.push(inventoryGroup);
    }
    return result;
  }, [storageGroups, inventoryGroup]);

  // Regular (non-reserve) groups for the active filter. Reserve is rendered separately, first.
  const visibleGroups = useMemo(() => {
    const regular = groups.filter((group) => group.key !== 'inventory');
    if (activeFilter === 'all') return regular;
    return regular.filter((group) => group.key === activeFilter);
  }, [groups, activeFilter]);

  // Reserve stays first under EVERY filter until all its items are confirmed;
  // once confirmed it only shows under "All" and its own chip.
  const showReserve = useMemo(() => {
    if (!inventoryGroup) return false;
    if (activeFilter === 'all' || activeFilter === 'inventory') return true;
    return !isReserveConfirmed(inventoryGroup);
  }, [inventoryGroup, activeFilter]);

  const isItemPacked = useCallback(
    (item: ItemData) => {
      // Handle inventory items - use isPacked from the item directly
      if (item.isInventoryItem) {
        return item.isPacked ?? false;
      }

      if (!storageData) return false;

      if (item.destinations && item.destinations.length > 0) {
        return item.destinations.every((dest) => Boolean(storageData[dest.row]?.[dest.colIndex]));
      }

      if (typeof item.colIndex === 'number') {
        return Boolean(storageData[item.row]?.[item.colIndex]);
      }

      return false;
    },
    [storageData]
  );

  const setItemPacked = useCallback(
    async (item: ItemData, packed: boolean) => {
      const operations: Array<Promise<void>> = [];

      if (item.destinations && item.destinations.length > 0) {
        item.destinations.forEach((dest) => {
          const current = Boolean(storageData?.[dest.row]?.[dest.colIndex]);
          if (current !== packed) {
            operations.push(toggleItem(dest.row, dest.colIndex, 'storage'));
          }
        });
      } else if (typeof item.colIndex === 'number') {
        const current = Boolean(storageData?.[item.row]?.[item.colIndex]);
        if (current !== packed) {
          operations.push(toggleItem(item.row, item.colIndex, 'storage'));
        }
      }

      if (operations.length > 0) {
        const results = await Promise.allSettled(operations);
        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length > 0) {
          toast.error(`${failures.length} of ${operations.length} storage updates failed. Try again.`);
        }
      }
    },
    [storageData, toggleItem]
  );

  const handleToggle = useCallback(
    (item: ItemData) => {
      // Handle inventory items - use dedicated toggle function
      if (item.isInventoryItem && item.inventoryId) {
        void toggleInventoryPacked(item.inventoryId);
        return;
      }

      const next = !isItemPacked(item);
      void setItemPacked(item, next);
    },
    [isItemPacked, setItemPacked, toggleInventoryPacked]
  );

  const handlePackAll = useCallback(
    async (group: GroupData, packed: boolean) => {
      // Handle inventory group specially
      if (group.key === 'inventory') {
        await setAllInventoryPacked(packed);
        return;
      }

      const results = await Promise.allSettled(group.items.map((item) => setItemPacked(item, packed)));
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        toast.error(`${failures.length} item(s) failed to update. Try again.`);
      }
    },
    [setItemPacked, setAllInventoryPacked]
  );

  const handleShowDetails = useCallback(
    (item: ItemData) => {
      // Handle inventory items - they don't have sheet rows
      if (item.isInventoryItem) {
        openItemDetail({
          itemName: item.name,
          emoji: item.emoji,
          expectedQuantity: item.quantity,
          storageType: item.storageType,
          source: 'storage',
          mode: 'storage',
        });
        return;
      }

      const referenceRow = item.row >= 0 ? item.row : item.destinations?.[0]?.row ?? null;

      const unitValue =
        referenceRow !== null && referenceRow >= 0 && sheetData?.[referenceRow]
          ? (typeof sheetData[referenceRow][1] === 'string' ? sheetData[referenceRow][1] : null)
          : null;

      openItemDetail({
        itemName: item.name,
        sheetRow: referenceRow ?? undefined,
        emoji: item.emoji,
        expectedQuantity: item.quantity,
        storageType: item.storageType,
        unit: unitValue ?? undefined,
        source: 'storage',
        mode: 'storage',
      });
    },
    [openItemDetail, sheetData]
  );

  // Filter chip descriptors — only show chips for groups that actually exist.
  const filterChips = useMemo(() => {
    const chips: Array<{ key: StorageFilter; icon: string; label: string; count: number }> = [
      {
        key: 'all',
        icon: '▦',
        label: `All ${groups.length}`,
        count: groups.length,
      },
    ];
    // Reserve chip goes first, matching its position in the list.
    const chipOrder = [...groups].sort(
      (a, b) => Number(b.key === 'inventory') - Number(a.key === 'inventory')
    );
    chipOrder.forEach((group) => {
      if (group.key === 'fridge' || group.key === 'table' || group.key === 'inventory') {
        chips.push({
          key: group.key,
          icon: GROUP_ICONS[group.key],
          label: group.key === 'fridge' ? 'Fridge' : group.key === 'table' ? 'Table' : 'Reserve',
          count: group.totalCount,
        });
      }
    });
    return chips;
  }, [groups]);

  if (!sheetData) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-sm text-muted-foreground shadow-sm">
          Storage data is loading. Connect to Supabase to view the checklist.
        </Card>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-sm text-muted-foreground shadow-sm">No storage items available.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top filter chips — Chip primitive with indigo tone handles active state */}
      {filterChips.length > 1 && (
        <div className="flex w-full gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
          {filterChips.map((chip) => {
            const isActive = activeFilter === chip.key;
            return (
              <Chip
                key={chip.key}
                tone="indigo"
                density="compact"
                active={isActive}
                onClick={() => setActiveFilter(chip.key)}
                className="shrink-0"
              >
                <span aria-hidden className="text-sm leading-none">
                  {chip.icon}
                </span>
                <span>{chip.label}</span>
              </Chip>
            );
          })}
        </div>
      )}

      {showReserve && inventoryGroup ? (
        <ReserveSection group={inventoryGroup} dividerBelow={visibleGroups.length > 0} />
      ) : null}

      {visibleGroups.map((group, groupIndex) => {
        const pendingItems = group.items.filter((item) => !isItemPacked(item));
        const storedItems = group.items.filter((item) => isItemPacked(item));
        const label = GROUP_LABELS[group.key] ?? stripLeadingEmoji(group.name);
        const icon = GROUP_ICONS[group.key] ?? '📦';
        const allStored = group.totalCount > 0 && group.completedCount === group.totalCount;
        const storageTutorialId =
          group.key === 'table'
            ? 'storage-section-table'
            : group.key === 'fridge'
              ? 'storage-section-fridge'
              : undefined;
        const isFirstGroup = groupIndex === 0;

        return (
          <Card
            key={group.key}
            className="gap-0 overflow-hidden rounded-[20px] border-slate-200 p-0 shadow-[0_1px_2px_rgba(14,16,32,0.06),0_1px_1px_rgba(14,16,32,0.04)]"
            data-tutorial={storageTutorialId}
          >
            {/* Location header — slate-50 strip with icon + name + count */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="text-lg leading-none">
                  {icon}
                </span>
                <span className="truncate text-[14px] font-bold text-foreground">
                  {label}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {group.completedCount}/{group.totalCount}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSyncing || allStored}
                  onClick={() => void handlePackAll(group, true)}
                  className="h-7 px-2 text-[11px] font-medium text-slate-500 hover:text-[#0F7A4F]"
                  data-tutorial="storage-mark-all"
                >
                  ✓ All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSyncing || group.completedCount === 0}
                  onClick={() => void handlePackAll(group, false)}
                  className="h-7 px-2 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* Item rows */}
            {pendingItems.length === 0 && storedItems.length === 0 ? (
              <div className="border-t border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm text-muted-foreground">
                Nothing to store in this section.
              </div>
            ) : (
              <>
                {/* Pending items — expanded by default. Flat list with no extra chrome. */}
                {pendingItems.length > 0 ? (
                  <div>
                    {pendingItems.map((item, itemIndex) => (
                      <StorageItemRow
                        key={`${item.row}-${item.name}-${item.colIndex ?? 'col'}-pending`}
                        item={item}
                        packed={false}
                        onToggle={handleToggle}
                        onShowDetails={handleShowDetails}
                        isLast={itemIndex === pendingItems.length - 1 && storedItems.length === 0}
                        tutorialTarget={isFirstGroup && itemIndex === 0 ? 'storage-item' : undefined}
                        tutorialCheckboxTarget={
                          isFirstGroup && itemIndex === 0 ? 'storage-checkbox' : undefined
                        }
                      />
                    ))}
                  </div>
                ) : null}

                {/* Stored items — collapsible, quiet divider-style summary */}
                {storedItems.length > 0 ? (
                  <details className="group [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50/50">
                      <span>{storedItems.length} stored</span>
                      <span className="text-[10px] text-slate-400 group-open:hidden">Show</span>
                      <span className="hidden text-[10px] text-slate-400 group-open:block">Hide</span>
                    </summary>
                    <div>
                      {storedItems.map((item, itemIndex) => (
                        <StorageItemRow
                          key={`${item.row}-${item.name}-${item.colIndex ?? 'col'}-stored`}
                          item={item}
                          packed
                          onToggle={handleToggle}
                          onShowDetails={handleShowDetails}
                          isLast={itemIndex === storedItems.length - 1}
                        />
                      ))}
                    </div>
                  </details>
                ) : null}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
};
