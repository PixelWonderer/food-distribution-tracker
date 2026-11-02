import React from 'react';

import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';

type AdminToolsSheetProps = {
  open: boolean;
  onClose: () => void;
};

export const AdminToolsSheet: React.FC<AdminToolsSheetProps> = ({ open, onClose }) => {
  const { inventoryItems, deactivateInventoryItem } = useAppStore((state) => ({
    inventoryItems: state.inventoryItems,
    deactivateInventoryItem: state.deactivateInventoryItem,
  }));

  // Only show active items that can be removed
  const activeItems = inventoryItems.filter(item => item.isActive);

  const handleRemove = async (itemId: string, itemName: string) => {
    const confirmed = window.confirm(
      `Remove "${itemName}" from inventory tracking? This will deactivate the item.`
    );
    if (!confirmed) return;
    await deactivateInventoryItem(itemId);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] gap-4 overflow-y-auto rounded-t-[32px] border-border/70 bg-card p-4 shadow-[0_-28px_90px_rgba(15,23,42,0.16)]"
      >
        <SheetHeader className="gap-1">
          <div className="mx-auto h-1 w-12 rounded-full bg-muted" aria-hidden />
          <SheetTitle className="text-base font-semibold text-muted-foreground">Inventory Management</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-2">
              <span className="text-xl" aria-hidden>
                📋
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-amber-800">Remove inventory items</h3>
                <p className="text-xs text-amber-700">
                  Deactivates an item from tracking. Use when items should no longer appear in the Inventory tab.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activeItems.length === 0 ? (
                <p className="rounded-xl bg-white px-3 py-2 text-xs text-amber-700">
                  No active inventory items found.
                </p>
              ) : (
                activeItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm',
                      'shadow-[0_6px_16px_rgba(217,119,6,0.08)]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.emoji}</span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{item.itemName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.currentQuantity} {item.unit} • {item.category || 'Pantry'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => handleRemove(item.id, item.itemName)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <Button variant="outline" onClick={onClose} className="h-11 rounded-xl text-sm font-semibold">
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
