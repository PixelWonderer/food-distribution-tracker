import React, { useMemo } from 'react';
import { AlertCircle, AlertTriangle, ArrowRightLeft, CheckCircle2, Clock3, MapPin } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Chip, type ChipTone } from '@/app/components/ui/chip';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { QuantityBadge } from '@/app/components/ui/quantity-badge';
import { useAppStore } from '@/services/state';
import { COLUMN_MAP, GROUPS } from '@/utils/constants';
import { getEmojiForItem } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { toFraction } from '@/app/utils/fractions';
import type { ItemDetailRequest } from '@/app/providers/ModalProvider';

type RedirectParams = {
  allocationId: string;
  destinationId: string;
  destinationName: string;
  quantity: number;
  itemName: string;
  emoji: string;
  row: number;
  colIndex: number;
};

type ItemDetailDialogProps = {
  request: ItemDetailRequest | null;
  open: boolean;
  onClose: () => void;
  onRedirect?: (params: RedirectParams) => void;
};

type Mode = 'confirmation' | 'storage' | 'pickup';

// Allocation-based data model (aligned with Figma prototype)
type AllocationDetail = {
  id: string;
  destinationKey: string;
  destinationName: string;
  destinationId: string;
  timing: string;
  direct: boolean;
  storageEligible: boolean;
  allocatedQuantity: number;
  receivedQuantity: number;
  row: number;
  colIndex: number;
  allocationId: string | null;
  isStored: boolean;
  isDistributed: boolean;
  isConfirmed: boolean;
  ranOut: boolean;
  ranLow: boolean;
};

type ItemDetailData = {
  emoji: string;
  itemName: string;
  unit: string | null;
  mode: Mode;
  totalQuantity: number;
  expectedQuantity: number | null;
  receivedQuantity: number | null;
  distributedCount: number;
  storedCount: number;
  confirmedCount: number;
  storageType: string | null;
  storageEmoji: string;
  ranOut: boolean;
  ranLow: boolean;
  allocations: AllocationDetail[];
  orderId: string | null;
};

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

const STORAGE_EMOJI: Record<string, string> = {
  fridge: '🧊',
  refrigerator: '🧊',
  freezer: '❄️',
  pantry: '📦',
  shelf: '🗄️',
};

const determineStorageEmoji = (type: string | null | undefined): string => {
  if (!type) return '📦';
  const normalized = type.toLowerCase();
  return STORAGE_EMOJI[normalized] ?? '📦';
};

const normalizeStorageType = (storageType: string | null | undefined): string | null => {
  if (!storageType) return null;
  const normalized = storageType.toLowerCase();
  if (normalized.includes('fridge') || normalized.includes('refrig')) return 'Fridge';
  if (normalized.includes('pantry') || normalized.includes('shelf')) return 'Pantry';
  return storageType;
};

const TIMING_ORDER = ['friday am', 'friday noon', 'friday pm', 'saturday noon', 'saturday pm', 'sunday'];

export const ItemDetailDialog: React.FC<ItemDetailDialogProps> = ({ request, open, onClose, onRedirect }) => {
  const { sheetData, trackingData, storageData, orderConfirmationItems, allocationLookup, destinations, unmarkItemRanOut, isSyncing } = useAppStore();

  // Transform legacy sheet data to allocation-based model
  const detail = useMemo((): ItemDetailData | null => {
    if (!request || !sheetData) return null;

    const emoji = request.emoji ?? getEmojiForItem(request.itemName);
    const mode: Mode = request.mode ?? request.source ?? 'confirmation';

    // Get confirmation data ONCE for this item (not per-destination)
    const confirmationMatch = orderConfirmationItems.find(
      (entry) => entry.itemName.toLowerCase() === request.itemName.toLowerCase()
    );

    // Build allocations from sheet columns
    const allocations: AllocationDetail[] = [];

    Object.entries(COLUMN_MAP).forEach(([destKey, colIndex]) => {
      const group = GROUPS[destKey as keyof typeof GROUPS];
      if (!group) return;

      // Find the row for this item
      let rowIndex = -1;
      if (typeof request.sheetRow === 'number' && request.sheetRow >= 0) {
        rowIndex = request.sheetRow;
      } else {
        // Search by item name
        for (let i = 0; i < sheetData.length; i++) {
          const row = sheetData[i];
          if (row && row[0]) {
            const cellName = String(row[0]).toLowerCase().trim();
            const requestName = request.itemName.toLowerCase().trim();
            if (cellName === requestName || cellName.includes(requestName)) {
              rowIndex = i;
              break;
            }
          }
        }
      }

      if (rowIndex === -1) return;

      const row = sheetData[rowIndex];
      if (!row) return;

      // This is the PER-DESTINATION quantity from the sheet
      const allocatedQuantity = parseQuantity(row[colIndex]);
      if (allocatedQuantity <= 0) return; // Skip zero quantities

      const storageRow = storageData?.[rowIndex];
      const trackingRow = trackingData?.[rowIndex];
      const storageEligible = !group.direct;
      const isStored = storageEligible && storageRow ? Boolean(storageRow[colIndex]) : false;
      const isDistributed = trackingRow ? Boolean(trackingRow[colIndex]) : false;

      // Look up allocation metadata for redirect functionality
      const allocationKey = `${rowIndex}:${colIndex}`;
      const allocationMeta = allocationLookup[allocationKey];
      const destinationInfo = destinations.find(d => d.code === destKey);

      allocations.push({
        id: `${rowIndex}-${colIndex}`,
        destinationKey: destKey,
        destinationName: group.name,
        destinationId: destinationInfo?.id ?? '',
        timing: group.timing,
        direct: group.direct,
        storageEligible,
        allocatedQuantity,
        receivedQuantity: allocatedQuantity,
        row: rowIndex,
        colIndex,
        allocationId: allocationMeta?.allocationId ?? null,
        isStored,
        isDistributed,
        isConfirmed: Boolean(confirmationMatch?.isConfirmed),
        ranOut: false,
        ranLow: false,
      });
    });

    // Sort by timing
    allocations.sort((a, b) => {
      const aIndex = TIMING_ORDER.indexOf(a.timing.toLowerCase());
      const bIndex = TIMING_ORDER.indexOf(b.timing.toLowerCase());
      const safeA = aIndex === -1 ? TIMING_ORDER.length : aIndex;
      const safeB = bIndex === -1 ? TIMING_ORDER.length : bIndex;
      if (safeA !== safeB) return safeA - safeB;
      return a.destinationName.localeCompare(b.destinationName);
    });

    const distributedCount = allocations.filter(a => a.isDistributed).length;
    const storedCount = allocations.filter(a => a.isStored).length;
    const confirmedCount = allocations.filter(a => a.isConfirmed).length;

    const allocatedTotal = allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);

    const storageType = normalizeStorageType(request.storageType ?? confirmationMatch?.storageType);
    const storageEmoji = determineStorageEmoji(storageType);

    const ranOut = Boolean(confirmationMatch?.ranOut);
    const ranLow =
      typeof confirmationMatch?.expectedQuantity === 'number' &&
      typeof confirmationMatch?.receivedQuantity === 'number' &&
      confirmationMatch.receivedQuantity < confirmationMatch.expectedQuantity &&
      confirmationMatch.receivedQuantity > 0;

    const expectedTotal = confirmationMatch?.expectedQuantity ?? allocatedTotal;
    const actualTotal = confirmationMatch?.receivedQuantity ?? expectedTotal;

    let remainingShortage = Math.max(allocatedTotal - actualTotal, 0);
    if (remainingShortage > 0) {
      for (let i = allocations.length - 1; i >= 0 && remainingShortage > 0; i--) {
        const allocation = allocations[i];
        const reduction = Math.min(allocation.receivedQuantity, remainingShortage);
        if (reduction > 0) {
          allocation.receivedQuantity = Math.max(allocation.receivedQuantity - reduction, 0);
          remainingShortage -= reduction;
          allocation.ranOut = allocation.receivedQuantity === 0;
          allocation.ranLow = !allocation.ranOut;
        }
      }
    }

    // Use the TRUE total from confirmation data (from orders.quantity in DB)
    const trueTotalQuantity = actualTotal;

    return {
      emoji,
      itemName: request.itemName,
      unit: request.unit ?? confirmationMatch?.unit ?? null,
      mode,
      totalQuantity: trueTotalQuantity,
      expectedQuantity: expectedTotal,
      receivedQuantity: actualTotal,
      distributedCount,
      storedCount,
      confirmedCount,
      storageType,
      storageEmoji,
      ranOut,
      ranLow,
      allocations,
      orderId: confirmationMatch?.orderId ?? null,
    };
  }, [request, sheetData, storageData, trackingData, orderConfirmationItems, allocationLookup, destinations]);

  const quantityFormatOptions = useMemo(
    () => ({ unit: detail?.unit ?? 'case', hideCaseUnit: true }),
    [detail?.unit]
  );
  const headerQuantityOptions = useMemo(
    () => ({ unit: detail?.unit ?? 'case', hideCaseUnit: false }),
    [detail?.unit]
  );

  if (!detail) return null;

  const destinationCount = detail.allocations.length;
  const allConfirmed = destinationCount > 0 && detail.confirmedCount === destinationCount;
  const fullyDistributed = destinationCount > 0 && detail.distributedCount === destinationCount;
  const pendingConfirmations = Math.max(destinationCount - detail.confirmedCount, 0);
  const remainingPickups = Math.max(destinationCount - detail.distributedCount, 0);
  const summaryLine = `${destinationCount} ${destinationCount === 1 ? 'destination' : 'destinations'} • ${detail.storageEmoji} ${detail.storageType ?? 'Storage TBD'}`;
  const statusChip = (() => {
    if (!allConfirmed) {
      return {
        icon: Clock3,
        text: `${pendingConfirmations} confirmation${pendingConfirmations === 1 ? '' : 's'} pending`,
        tone: 'amber' as ChipTone,
      };
    }
    if (detail.ranOut) {
      return {
        icon: AlertCircle,
        text: 'Ran out completely',
        tone: 'rose' as ChipTone,
      };
    }
    const expectationText = detail.ranLow ? 'Ran low but' : 'Confirmed as expected &';
    const distributionText = fullyDistributed ? 'fully distributed' : 'ready for distro';
    return {
      icon: detail.ranLow ? AlertTriangle : CheckCircle2,
      text: `${expectationText} ${distributionText}`,
      tone: detail.ranLow ? ('peach' as ChipTone) : ('mint' as ChipTone),
    };
  })();
  const StatusIcon = statusChip.icon;
  const headerSubStatus = detail.mode === 'pickup'
    ? remainingPickups > 0
      ? `${remainingPickups} pickup${remainingPickups === 1 ? '' : 's'} remaining`
      : 'All pickups completed'
    : '';
  const hasShortage = (allocation: AllocationDetail) =>
    allocation.ranOut || allocation.ranLow || allocation.receivedQuantity < allocation.allocatedQuantity;
  const buildAllocationBadges = (allocation: AllocationDetail) => {
    const badges: { key: string; label: string; tone: ChipTone; icon?: string }[] = [];

    if (allocation.storageEligible && allocation.isStored) {
      badges.push({ key: 'stored', label: 'Stored', tone: 'lavender', icon: '📦' });
    }

    if (allocation.ranOut) {
      badges.push({ key: 'ranOut', label: 'Ran out', tone: 'rose' });
    } else if (allocation.ranLow) {
      badges.push({ key: 'ranLow', label: 'Ran low', tone: 'peach' });
    }

    return badges;
  };

  const awaitingAllocations = detail.allocations.filter(a => !a.isDistributed);
  const pickedAllocations = detail.allocations.filter(a => a.isDistributed);
  const totalQuantityTone = detail.ranOut || detail.ranLow ? 'peach' : 'mint';
  const totalQuantityValue = detail.receivedQuantity ?? detail.totalQuantity;
  const totalOriginalValue = detail.expectedQuantity ?? undefined;
  const renderAllocationCard = (allocation: AllocationDetail, variant: 'awaiting' | 'complete') => {
    const hasIssue = hasShortage(allocation);
    const badges = buildAllocationBadges(allocation);
    const quantityTone = hasIssue ? 'peach' : allocation.isDistributed ? 'mint' : 'lavender';

    return (
      <div
        key={allocation.id}
        className={cn(
          'rounded-[20px] border p-4 shadow-[0_1px_2px_rgba(14,16,32,0.06),0_1px_1px_rgba(14,16,32,0.04)] transition',
          variant === 'complete'
            ? 'border-[#A7F0CA] bg-[#E9FFF4]/70 opacity-85'
            : 'border-[#E2E5EC] bg-white',
          hasIssue && variant === 'awaiting' && 'border-[#FFCFAC] bg-[#FFF4ED]/70',
          allocation.storageEligible && allocation.isStored && variant === 'awaiting' && !hasIssue && 'border-[#D8CBFF] bg-[#E9DEFF]/50'
        )}
      >
        <div className="flex items-start gap-4">
          <QuantityBadge
            quantity={allocation.receivedQuantity}
            originalQuantity={hasIssue ? allocation.allocatedQuantity : undefined}
            options={quantityFormatOptions}
            tone={quantityTone}
            variant={allocation.isDistributed ? 'solid' : 'soft'}
            className="shrink-0"
          />
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <div
                  className={cn(
                    'text-base font-semibold text-[#0E1020]',
                    variant === 'complete' && 'text-[#6B6F82] line-through'
                  )}
                >
                  {allocation.destinationName}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-sm font-medium text-[#6B6F82]">
                  <MapPin className="h-3.5 w-3.5 text-[#9498A8]" aria-hidden />
                  <span>{allocation.timing}</span>
                  {allocation.direct && (
                    <>
                      <span className="text-[#9498A8]">•</span>
                      <span>Direct drop</span>
                    </>
                  )}
                </div>
              </div>
              {variant === 'complete' ? (
                <Chip tone="mint" density="tag" aria-disabled="true" tabIndex={-1}>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Picked up
                </Chip>
              ) : hasIssue ? (
                <Chip tone="peach" density="tag" aria-disabled="true" tabIndex={-1}>
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Needs attention
                </Chip>
              ) : null}
            </div>
            {hasIssue && (
              <div className="text-xs font-semibold text-[#6B6F82]">
                Requested{' '}
                <span className="text-[#9498A8] line-through">
                  {toFraction(allocation.allocatedQuantity)}
                </span>
              </div>
            )}
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((badge) => (
                  <Chip
                    key={badge.key}
                    tone={badge.tone}
                    density="tag"
                    aria-disabled="true"
                    tabIndex={-1}
                  >
                    {badge.icon && <span aria-hidden>{badge.icon}</span>}
                    {badge.label}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Redistribute button - only in pickup mode with quantity > 0 and valid allocation */}
        {detail.mode === 'pickup' &&
          allocation.receivedQuantity > 0 &&
          allocation.allocationId &&
          onRedirect && (
            <div className="mt-3 border-t border-dashed border-[#E2E5EC] pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={() =>
                  onRedirect({
                    allocationId: allocation.allocationId!,
                    destinationId: allocation.destinationId,
                    destinationName: allocation.destinationName,
                    quantity: allocation.receivedQuantity,
                    itemName: detail.itemName,
                    emoji: detail.emoji,
                    row: allocation.row,
                    colIndex: allocation.colIndex,
                  })
                }
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Redistribute from {allocation.destinationName}
              </Button>
            </div>
          )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        centreContent={false}
        className="bottom-0 left-1/2 max-h-[88vh] w-[min(100vw-2rem,640px)] max-w-2xl translate-x-[-50%] translate-y-0 gap-0 overflow-hidden border-[#E2E5EC] bg-[#FBFAF6] p-0 shadow-[0_30px_120px_rgba(14,16,32,0.18)]"
        aria-labelledby="item-detail-title"
      >
        <div className="flex max-h-[88vh] flex-col gap-3 overflow-y-auto px-6 pb-6 pt-7">
          {/* HEADER — emoji hero, name, status chip */}
          <DialogHeader className="gap-4 rounded-[20px] border border-[#E2E5EC] bg-white p-5 text-left shadow-[0_1px_2px_rgba(14,16,32,0.06)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex size-[72px] items-center justify-center rounded-[20px] bg-[#F6F7FA] text-[56px] leading-none shadow-[0_1px_2px_rgba(14,16,32,0.06)]"
                  aria-hidden
                >
                  {detail.emoji}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <DialogTitle
                    id="item-detail-title"
                    className="text-[22px] font-bold leading-tight tracking-[-0.3px] text-[#0E1020]"
                  >
                    {detail.itemName}
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <QuantityBadge
                      quantity={totalQuantityValue}
                      originalQuantity={totalOriginalValue}
                      options={headerQuantityOptions}
                      tone={totalQuantityTone}
                      variant="solid"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={statusChip.tone} density="tag" aria-disabled="true" tabIndex={-1}>
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden />
                  {statusChip.text}
                </Chip>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-[#6B6F82]">{summaryLine}</p>
                {headerSubStatus && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-[#6B6F82]">
                    {detail.mode === 'pickup' ? (
                      <Clock3 className="h-4 w-4 text-[#D97706]" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-[#0F7A4F]" aria-hidden />
                    )}
                    {headerSubStatus}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* STATUS ALERTS */}
          {detail.ranOut && (
            <div className="rounded-[14px] border border-[#F8B8C5] bg-[#FFE4E9]/70 p-4 shadow-[0_1px_2px_rgba(14,16,32,0.06)]">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-[#E11D48]" aria-hidden />
                <div className="flex flex-1 flex-col gap-3">
                  <div className="text-sm font-semibold text-[#9F0F34]">Ran out completely</div>
                  {detail.orderId && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-[#9F0F34]/80">
                        Got some after all? Restore the item to confirm the actual quantity.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start border-[#E11D48] text-[#9F0F34] hover:bg-[#FFE4E9]"
                        disabled={isSyncing}
                        onClick={() => {
                          if (!detail.orderId) return;
                          void unmarkItemRanOut(detail.orderId);
                        }}
                      >
                        Mark as available
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {!detail.ranOut && detail.ranLow && (
            <div className="rounded-[14px] border border-[#FFCFAC] bg-[#FFF4ED]/70 p-4 shadow-[0_1px_2px_rgba(14,16,32,0.06)]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[#B75A28]" aria-hidden />
                <div>
                  <div className="text-sm font-semibold text-[#8A4520]">
                    Ran low
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Destination breakdown */}
          <div className="space-y-6">
            {awaitingAllocations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[1.2px] text-[#6B6F82]">
                  Awaiting pickup
                  <span className="text-[11px] font-semibold text-[#9498A8]">
                    ({awaitingAllocations.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {awaitingAllocations.map((allocation) => renderAllocationCard(allocation, 'awaiting'))}
                </div>
              </div>
            )}
            {pickedAllocations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[1.2px] text-[#9498A8]">
                  Picked up
                  <span className="text-[11px] font-semibold text-[#9498A8]">
                    ({pickedAllocations.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {pickedAllocations.map((allocation) => renderAllocationCard(allocation, 'complete'))}
                </div>
              </div>
            )}
            {awaitingAllocations.length === 0 && pickedAllocations.length === 0 && (
              <div className="rounded-[14px] border border-dashed border-[#E2E5EC] bg-[#F6F7FA] p-6 text-center text-sm text-[#9498A8]">
                No allocations found for this item.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
