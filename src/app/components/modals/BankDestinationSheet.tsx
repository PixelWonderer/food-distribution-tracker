import React, { useMemo } from 'react';
import { ChevronRight, Package } from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { useAppStore } from '@/services/state';
import { useModalManager } from '@/app/providers/ModalProvider';
import { COLUMN_MAP } from '@/utils/constants';
import { getEmojiForItem } from '@/utils/helpers';
import type { BankItemRequest } from '@/types';

type DestinationWithItems = {
  destinationId: string;
  destinationCode: string;
  destinationName: string;
  timing: string | null;
  items: Array<{
    allocationId: string;
    itemName: string;
    emoji: string;
    quantity: number;
  }>;
};

type BankDestinationSheetProps = {
  open: boolean;
  onClose: () => void;
};

export const BankDestinationSheet: React.FC<BankDestinationSheetProps> = ({
  open,
  onClose,
}) => {
  const sheetData = useAppStore((s) => s.sheetData);
  const allocationLookup = useAppStore((s) => s.allocationLookup);
  const destinations = useAppStore((s) => s.destinations);
  const { openBankItem } = useModalManager();

  // Build list of destinations with their items available for banking
  const destinationsWithItems = useMemo(() => {
    if (!sheetData || !allocationLookup) return [];

    const result: DestinationWithItems[] = [];

    // Get destination info from the destinations array
    const destMap = new Map(destinations.map((d) => [d.code, d]));

    // Iterate through each destination column
    Object.entries(COLUMN_MAP).forEach(([destKey, colIndex]) => {
      const destInfo = destMap.get(destKey.toUpperCase()) ||
        destinations.find((d) => d.code.toLowerCase() === destKey.toLowerCase());

      if (!destInfo) return;

      const items: DestinationWithItems['items'] = [];

      // Iterate through rows to find items with allocations
      for (let row = 2; row < sheetData.length && row < 30; row++) {
        const quantity = Number(sheetData[row]?.[colIndex]) || 0;
        if (quantity <= 0) continue;

        const itemName = String(sheetData[row]?.[0] || '');
        if (!itemName) continue;

        // Skip supply items (not bankable)
        const supplyKeywords = ['Tables', 'Meal box', '200 box', 'fork', 'Fork', 'Hub supply', 'Produce Market', 'Grocery Store'];
        if (supplyKeywords.some((kw) => itemName.includes(kw))) continue;

        // Find allocation ID
        const lookupKey = `${row}:${colIndex}`;
        const allocation = allocationLookup[lookupKey];
        if (!allocation?.allocationId) continue;

        items.push({
          allocationId: allocation.allocationId,
          itemName,
          emoji: getEmojiForItem(itemName),
          quantity,
        });
      }

      if (items.length > 0) {
        result.push({
          destinationId: destInfo.id,
          destinationCode: destInfo.code,
          destinationName: destInfo.name,
          timing: destInfo.timing,
          items,
        });
      }
    });

    return result;
  }, [sheetData, allocationLookup, destinations]);

  const handleSelectItem = (dest: DestinationWithItems, item: DestinationWithItems['items'][0]) => {
    const request: BankItemRequest = {
      allocationId: item.allocationId,
      destinationId: dest.destinationId,
      destinationName: dest.destinationName,
      itemName: item.itemName,
      emoji: item.emoji,
      availableQuantity: item.quantity,
    };
    openBankItem(request);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-3 overflow-hidden rounded-t-[32px] border-border/70 bg-card p-4 shadow-[0_-28px_90px_rgba(15,23,42,0.16)]"
      >
        <SheetHeader className="gap-1">
          <div className="mx-auto h-1 w-12 rounded-full bg-muted" aria-hidden />
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="text-xl">🏦</span> Bank Items for Next Week
          </SheetTitle>
          <SheetDescription className="text-xs">
            Select a destination and item to save for next week
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3">
          {destinationsWithItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">No items available to bank</p>
              <p className="text-xs mt-1">Items need to be allocated first</p>
            </div>
          ) : (
            destinationsWithItems.map((dest) => (
              <div
                key={dest.destinationId}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                {/* Destination Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{dest.destinationName}</span>
                    {dest.timing && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 text-slate-600">
                        {dest.timing}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{dest.items.length} items</span>
                </div>

                {/* Items List */}
                <div className="divide-y divide-slate-100">
                  {dest.items.map((item) => (
                    <button
                      key={item.allocationId}
                      type="button"
                      onClick={() => handleSelectItem(dest, item)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className="text-2xl">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-800 truncate">{item.itemName}</div>
                        <div className="text-xs text-slate-500">{item.quantity} available</div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <strong>Tip:</strong> Banked items will be added to the same destination when you import next week's data.
        </div>
      </SheetContent>
    </Sheet>
  );
};
