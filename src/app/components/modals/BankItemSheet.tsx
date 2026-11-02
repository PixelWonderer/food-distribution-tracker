import React, { useState, useEffect, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import type { BankItemRequest } from '@/types';

type BankItemSheetProps = {
  open: boolean;
  onClose: () => void;
  request: BankItemRequest | null;
};

type QuickPercent = { label: string; ratio: number | 'all' };

const QUICK_PERCENTS: QuickPercent[] = [
  { label: '25%', ratio: 0.25 },
  { label: '50%', ratio: 0.5 },
  { label: '75%', ratio: 0.75 },
  { label: 'All', ratio: 'all' },
];

export const BankItemSheet: React.FC<BankItemSheetProps> = ({
  open,
  onClose,
  request,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [banking, setBanking] = useState(false);

  const bankItem = useAppStore((s) => s.bankItem);

  const maxQuantity = request?.availableQuantity ?? 1;
  const step = maxQuantity >= 10 ? 1 : 0.5;

  useEffect(() => {
    if (open && request) {
      setQuantity(
        Math.min(
          Math.max(1, Math.floor(request.availableQuantity / 2)),
          request.availableQuantity
        )
      );
    }
  }, [open, request]);

  const handleBank = async () => {
    if (!request || quantity <= 0) return;

    setBanking(true);
    try {
      const success = await bankItem(request.allocationId, quantity);
      if (success) {
        onClose();
      }
    } finally {
      setBanking(false);
    }
  };

  const roundToStep = (value: number) => {
    const rounded = Math.round(value / step) * step;
    return Math.min(Math.max(step, rounded), maxQuantity);
  };

  const activeRatio = useMemo<QuickPercent['ratio'] | null>(() => {
    if (quantity === maxQuantity) return 'all';
    for (const p of QUICK_PERCENTS) {
      if (p.ratio === 'all') continue;
      if (Math.abs(quantity - roundToStep(maxQuantity * p.ratio)) < 0.001) {
        return p.ratio;
      }
    }
    return null;
  }, [quantity, maxQuantity, step]);

  if (!request) return null;

  const displayQty = Number.isInteger(quantity) ? quantity : quantity.toFixed(1);
  const remaining = maxQuantity - quantity;
  const remainingDisplay = Number.isInteger(remaining) ? remaining : remaining.toFixed(1);
  const percentOfAvailable = Math.round((quantity / maxQuantity) * 100);

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-0 overflow-hidden rounded-t-[24px] border-border/70 bg-white p-0 shadow-[0_-28px_90px_rgba(15,23,42,0.18)]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-2" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <SheetHeader className="gap-1 px-5 pb-2 pt-3">
          <SheetTitle className="text-[20px] font-bold leading-tight tracking-[-0.3px] text-foreground">
            Bank for next week
          </SheetTitle>
          <SheetDescription className="text-[13px] text-muted-foreground">
            Reserve now — appears in next week's import
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-4 pt-3">
          {/* Saffron-soft hero card */}
          <div
            className="flex items-center gap-3 rounded-[14px] border p-4"
            style={{
              background: 'var(--saffron-soft)',
              borderColor: '#F8D979',
            }}
          >
            <span className="text-[42px] leading-none" aria-hidden>
              {request.emoji}
            </span>
            <div className="flex-1">
              <div className="text-[17px] font-bold leading-tight text-foreground">
                {request.itemName}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-700">
                {maxQuantity} available · {request.destinationName}
              </div>
            </div>
            <span className="text-[28px]" aria-hidden>
              🏦
            </span>
          </div>

          {/* Eyebrow */}
          <div className="mb-0 mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            How much to bank
          </div>

          {/* Quantity stepper */}
          <div
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
            style={{ boxShadow: 'var(--shadow-s1)' }}
          >
            <button
              type="button"
              onClick={() => setQuantity(Math.max(step, quantity - step))}
              disabled={quantity <= step}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <div
                className="font-bold text-foreground tabular-nums"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 38,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {displayQty}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {percentOfAvailable}% of available
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(maxQuantity, quantity + step))}
              disabled={quantity >= maxQuantity}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Quick percent chips */}
          <div className="flex gap-1.5">
            {QUICK_PERCENTS.map((p) => {
              const active = activeRatio === p.ratio;
              const next = p.ratio === 'all' ? maxQuantity : roundToStep(maxQuantity * p.ratio);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setQuantity(next)}
                  className={cn(
                    'flex-1 rounded-[10px] border px-0 py-2 text-[12px] font-semibold transition-colors',
                    active
                      ? 'border-[#C7C1FF] text-[#3B33D4]'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  )}
                  style={active ? { background: 'var(--indigo-soft)' } : undefined}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Hint box */}
          <div className="rounded-[12px] bg-slate-50 p-3 text-[12px] leading-[1.5] text-slate-700">
            Banked items appear at the top of next Friday's Confirm screen. Coordinators review and delete
            before the import. <span className="font-semibold">{remainingDisplay}</span> will remain this
            week for {request.destinationName}.
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-slate-100 bg-white px-5 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleBank}
            disabled={banking || quantity <= 0}
            variant="secondary"
            className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
          >
            {banking ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1A1500] border-t-transparent" />
                Banking…
              </>
            ) : (
              <>
                <span aria-hidden>🏦</span>
                Bank {displayQty}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
