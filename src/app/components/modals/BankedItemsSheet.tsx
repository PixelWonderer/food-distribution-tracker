import React, { useState } from 'react';
import { Trash2, Package, Calendar } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { useAppStore } from '@/services/state';
import { getEmojiForItem } from '@/utils/helpers';

type BankedItemsSheetProps = {
  open: boolean;
  onClose: () => void;
};

export const BankedItemsSheet: React.FC<BankedItemsSheetProps> = ({
  open,
  onClose,
}) => {
  const bankedItems = useAppStore((s) => s.bankedItems);
  const deleteBankedItem = useAppStore((s) => s.deleteBankedItem);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Group by destination
  const groupedItems = bankedItems.reduce((acc, item) => {
    const key = item.destinationName;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof bankedItems>);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteBankedItem(id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
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
            <span className="text-xl">📋</span> Banked Items
          </SheetTitle>
          <SheetDescription className="text-xs">
            Items saved for next week's distribution
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {bankedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-16 w-16 mb-3 opacity-40" />
              <p className="text-base font-medium">No banked items</p>
              <p className="text-sm mt-1 text-center max-w-xs">
                Use "Bank Items for Next Week" to save items from current allocations
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([destinationName, items]) => (
                <div
                  key={destinationName}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  {/* Destination Header */}
                  <div className="px-4 py-3 bg-[#F0F2F6] border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0E1020]">{destinationName}</span>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E8E6FF] text-[#3B33D4] border border-[#CFC9FF]">
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="text-2xl">{getEmojiForItem(item.itemName)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate">{item.itemName}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-[#3B33D4]" style={{ fontFamily: 'var(--font-mono)' }}>{item.quantity}x</span>
                            <span>•</span>
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(item.bankedAt)}</span>
                            {item.bankedBy && (
                              <>
                                <span>•</span>
                                <span>by {item.bankedBy}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-[#E11D48] hover:bg-[#FFE4E9]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Info Banner */}
              <div className="rounded-xl border border-[#A7F0CA] bg-[#E9FFF4] px-3 py-2 text-sm text-[#0F7A4F]">
                <strong>On next import:</strong> These items will automatically be added to their destinations' allocations.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 pt-4 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full rounded-xl"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
