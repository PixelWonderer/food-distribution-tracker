import React, { useCallback } from 'react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { chipVariants } from '@/app/components/ui/chip';
import { StorageItemRow } from '@/app/components/views/StorageItemRow';
import { useAppStore } from '@/services/state';
import { useModalManager } from '@/app/providers/ModalProvider';
import { cn } from '@/lib/utils';
import type { GroupData, ItemData } from '@/types';

/**
 * The Reserve group is "confirmed" once every reserve item is packed
 * (the same isPacked state behind the card's N/N count and the "✓ All" button).
 */
export const isReserveConfirmed = (group: GroupData | null | undefined): boolean =>
  !group || (group.totalCount > 0 && group.completedCount === group.totalCount);

type ReserveSectionProps = {
  group: GroupData;
  /** Render a dashed divider below the card to separate it from the sections that follow. */
  dividerBelow?: boolean;
};

/**
 * Standalone Reserve section (non-allocated stock held for the partner kitchens).
 * Used at the top of the Storage tab and the Pickup tab. Reads/writes inventory
 * packed state straight from the store, so callers only supply the group.
 */
export const ReserveSection: React.FC<ReserveSectionProps> = ({ group, dividerBelow }) => {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const toggleInventoryPacked = useAppStore((state) => state.toggleInventoryPacked);
  const setAllInventoryPacked = useAppStore((state) => state.setAllInventoryPacked);
  const { openItemDetail } = useModalManager();

  const handleToggle = useCallback(
    (item: ItemData) => {
      if (item.inventoryId) {
        void toggleInventoryPacked(item.inventoryId);
      }
    },
    [toggleInventoryPacked]
  );

  const handleShowDetails = useCallback(
    (item: ItemData) => {
      openItemDetail({
        itemName: item.name,
        emoji: item.emoji,
        expectedQuantity: item.quantity,
        storageType: item.storageType,
        source: 'storage',
        mode: 'storage',
      });
    },
    [openItemDetail]
  );

  const pendingItems = group.items.filter((item) => !item.isPacked);
  const storedItems = group.items.filter((item) => item.isPacked);
  const allStored = group.totalCount > 0 && group.completedCount === group.totalCount;
  const hasFridge = group.items.some((item) => item.storageType === 'Fridge');
  const hasPantry = group.items.some((item) => item.storageType !== 'Fridge');
  // Reserve produce (col O, storage Fridge) stays in the Hub fridge; canned/dry goes to the walk-in pantry.
  const reminderText =
    hasFridge && hasPantry
      ? 'Walk-in pantry + Hub fridge · send photo'
      : hasFridge
        ? 'Leave in Hub fridge · send photo'
        : 'Move to walk-in pantry · send photo';

  return (
    <>
      <Card
        className="gap-0 overflow-hidden rounded-[20px] border-2 border-[#F8D979] p-0 shadow-[0_1px_2px_rgba(14,16,32,0.06),0_1px_1px_rgba(14,16,32,0.04)]"
        data-section="reserve"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F8D979] bg-[#FFF5D1] px-3.5 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span aria-hidden className="text-lg leading-none">
              📦
            </span>
            <h2 className="truncate text-[14px] font-bold text-foreground">Reserve</h2>
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {group.completedCount}/{group.totalCount}
            </span>
            <span
              className={cn(chipVariants({ tone: 'indigo', density: 'tag' }), 'shrink-0 gap-1')}
              data-testid="reserve-reminder"
            >
              {reminderText}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSyncing || allStored}
              onClick={() => void setAllInventoryPacked(true)}
              className="h-7 px-2 text-[11px] font-medium text-slate-500 hover:text-[#0F7A4F]"
            >
              ✓ All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSyncing || group.completedCount === 0}
              onClick={() => void setAllInventoryPacked(false)}
              className="h-7 px-2 text-[11px] font-medium text-slate-500 hover:text-slate-700"
            >
              Reset
            </Button>
          </div>
        </div>

        <p className="border-b border-[#F8D979]/60 bg-[#FFF5D1]/40 px-3.5 py-2 text-[11px] font-medium text-[#C99B00]">
          Held for the partner kitchens (beans, rice, produce, etc.). Other groups may not take these.
        </p>

        {pendingItems.map((item, index) => (
          <StorageItemRow
            key={`${item.inventoryId ?? item.name}-pending`}
            item={item}
            packed={false}
            onToggle={handleToggle}
            onShowDetails={handleShowDetails}
            isLast={index === pendingItems.length - 1 && storedItems.length === 0}
          />
        ))}

        {storedItems.length > 0 ? (
          <details className="group [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50/50">
              <span>{storedItems.length} stored</span>
              <span className="text-[10px] text-slate-400 group-open:hidden">Show</span>
              <span className="hidden text-[10px] text-slate-400 group-open:block">Hide</span>
            </summary>
            <div>
              {storedItems.map((item, index) => (
                <StorageItemRow
                  key={`${item.inventoryId ?? item.name}-stored`}
                  item={item}
                  packed
                  onToggle={handleToggle}
                  onShowDetails={handleShowDetails}
                  isLast={index === storedItems.length - 1}
                />
              ))}
            </div>
          </details>
        ) : null}
      </Card>
      {dividerBelow ? (
        <div role="separator" aria-hidden className="mx-2 border-t border-dashed border-[#F8D979]" />
      ) : null}
    </>
  );
};
