import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { QuantityBadge } from '@/app/components/ui/quantity-badge';
import { TimingBadge } from '@/app/components/ui/timing-badge';
import { formatQuantity } from '@/app/utils/quantity';
import { useAppStore } from '@/services/state';
import { COLUMN_MAP, GROUPS } from '@/utils/constants';
import type { OrderConfirmationItem } from '@/types';

type RanLowRequest = {
  item: OrderConfirmationItem;
  onSubmit: (quantity: number) => Promise<void> | void;
};

type RanLowModalProps = {
  request: RanLowRequest | null;
  open: boolean;
  onClose: () => void;
};

type AllocationPreview = {
  destinationKey: string;
  destinationName: string;
  timing: string;
  original: number;
  projected: number;
};

const TIMING_ORDER = ['friday am', 'friday noon', 'friday pm', 'saturday am', 'saturday noon', 'saturday pm', 'sunday'];

const parseQuantity = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const RanLowModal: React.FC<RanLowModalProps> = ({ request, open, onClose }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const sheetData = useAppStore((s) => s.sheetData);

  const item = request?.item;

  useEffect(() => {
    if (!request) {
      setQuantity(0);
      setError(null);
      return;
    }

    // If item was marked as "ran out" (receivedQuantity = 0), suggest half the expected
    // so user can easily change to "ran low" with a non-zero starting point
    const wasRanOut = request.item.ranOut || request.item.receivedQuantity === 0;
    const base = wasRanOut
      ? Math.ceil((request.item.expectedQuantity ?? 0) * 0.5)
      : (request.item.receivedQuantity ?? request.item.expectedQuantity ?? 0);
    setQuantity(Number.isFinite(base) ? base : 0);
    setError(null);
  }, [request]);

  const expectedQuantity = useMemo(() => {
    if (!item) return null;
    return formatQuantity(item.expectedQuantity, {
      unit: item.unit,
      hideCaseUnit: true,
    });
  }, [item]);

  // Calculate impact
  const impact = useMemo(() => {
    if (!item) return null;
    const expected = item.expectedQuantity ?? 0;
    const reduction = expected - quantity;
    const reductionPercent = expected > 0 ? Math.round((reduction / expected) * 100) : 0;
    const receivedPercent = expected > 0 ? Math.round((quantity / expected) * 100) : 0;
    return { reduction, reductionPercent, receivedPercent };
  }, [item, quantity]);

  // Build per-destination allocation preview — proportional scaling based on
  // the entered quantity vs. the expected total. Matches the server-side
  // proportional RPC used when saving.
  const allocationPreview = useMemo<AllocationPreview[]>(() => {
    if (!item || !sheetData) return [];

    const expected = item.expectedQuantity ?? 0;
    if (expected <= 0) return [];

    // Locate the item row — prefer sheetRow when available.
    let rowIndex = -1;
    if (typeof item.sheetRow === 'number' && item.sheetRow >= 0) {
      rowIndex = item.sheetRow;
    } else {
      const needle = item.itemName.toLowerCase().trim();
      for (let i = 0; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (row && row[0]) {
          const cellName = String(row[0]).toLowerCase().trim();
          if (cellName === needle || cellName.includes(needle)) {
            rowIndex = i;
            break;
          }
        }
      }
    }
    if (rowIndex === -1) return [];

    const row = sheetData[rowIndex];
    if (!row) return [];

    const ratio = Math.max(0, quantity) / expected;
    const allocations: AllocationPreview[] = [];

    Object.entries(COLUMN_MAP).forEach(([destKey, colIndex]) => {
      const group = GROUPS[destKey as keyof typeof GROUPS];
      if (!group) return;
      const original = parseQuantity(row[colIndex]);
      if (original <= 0) return;

      // Proportional scaling — rounded to whole units for preview display.
      const projected = Math.round(original * ratio);
      allocations.push({
        destinationKey: destKey,
        destinationName: group.name,
        timing: group.timing,
        original,
        projected,
      });
    });

    allocations.sort((a, b) => {
      const ai = TIMING_ORDER.indexOf(a.timing.toLowerCase());
      const bi = TIMING_ORDER.indexOf(b.timing.toLowerCase());
      const safeA = ai === -1 ? TIMING_ORDER.length : ai;
      const safeB = bi === -1 ? TIMING_ORDER.length : bi;
      if (safeA !== safeB) return safeA - safeB;
      return a.destinationName.localeCompare(b.destinationName);
    });

    return allocations;
  }, [item, sheetData, quantity]);

  // Warn when quantity exceeds expected (possible typo)
  const overReceiveWarning = useMemo(() => {
    if (!item) return null;
    const expected = item.expectedQuantity ?? 0;
    if (expected > 0 && quantity > expected) {
      return `This is more than the ${expected} expected. Is that correct?`;
    }
    return null;
  }, [item, quantity]);

  if (!item || !request) {
    return null;
  }

  const handleIncrement = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQuantity((prev) => Math.max(0, prev - 1));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!Number.isFinite(quantity)) {
      setError('Enter a valid number of cases.');
      return;
    }

    setError(null);
    await request.onSubmit(quantity);
    onClose();
  };

  const unitLabel = expectedQuantity?.unit || 'cases';

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => (!next ? onClose() : undefined)}>
      <DialogContent
        centreContent={false}
        className="fixed bottom-0 left-1/2 w-full max-w-lg translate-x-[-50%] translate-y-0 gap-0 overflow-hidden rounded-t-[24px] border-border/70 bg-white p-0 shadow-[0_-28px_90px_rgba(15,23,42,0.18)]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Sheet handle */}
          <div className="flex justify-center pt-2" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-slate-200" />
          </div>

          {/* Title block */}
          <div className="px-5 pb-2 pt-4">
            <h2 className="text-[20px] font-bold leading-tight tracking-[-0.3px] text-foreground">
              {item.itemName} — Ran low
            </h2>
            {expectedQuantity ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                Expected {expectedQuantity.display}
                {expectedQuantity.unit ? ` ${expectedQuantity.unit}` : ''}. How much arrived?
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 px-5 pb-6 pt-2">
            {/* Hero — emoji + quantity badge with strikethrough */}
            <div className="flex items-center justify-center gap-3 py-3">
              <span className="text-[68px] leading-none" aria-hidden>
                {item.emoji}
              </span>
              <QuantityBadge
                quantity={quantity}
                originalQuantity={item.expectedQuantity ?? undefined}
                options={{ unit: item.unit, hideCaseUnit: true, fallbackUnit: 'cases' }}
                tone="peach"
                className="px-4 py-2.5 text-[28px]"
              />
            </div>

            {/* Stepper — the "how many actually arrived" input */}
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                How many {unitLabel.toLowerCase() || 'cases'} arrived?
              </div>
              <div
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"
                style={{ boxShadow: 'var(--shadow-s1)' }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDecrement}
                  className="h-12 w-12 rounded-xl p-0 text-xl font-bold"
                  aria-label="Decrease quantity"
                >
                  −
                </Button>

                <div className="flex flex-1 flex-col items-center px-2">
                  <Input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(Number.parseFloat(event.target.value) || 0)
                    }
                    className="h-12 border-0 bg-transparent text-center text-[30px] font-bold text-foreground shadow-none focus-visible:ring-0 tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}
                    aria-label="Quantity received"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Use 0.5 increments for half {unitLabel.toLowerCase() || 'cases'}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleIncrement}
                  className="h-12 w-12 rounded-xl p-0 text-xl font-bold"
                  aria-label="Increase quantity"
                >
                  +
                </Button>
              </div>
              {error ? (
                <p className="mt-2 text-[13px] font-semibold text-destructive">{error}</p>
              ) : null}
              {overReceiveWarning ? (
                <p className="mt-2 text-[12px] font-medium text-[#B75A28]">{overReceiveWarning}</p>
              ) : null}
            </div>

            {/* Suggested split hint card — saffron */}
            {impact && impact.reduction > 0 ? (
              <div
                className="flex gap-3 rounded-2xl border p-3.5"
                style={{
                  background: 'var(--saffron-soft)',
                  borderColor: '#F8D979',
                }}
              >
                <span className="text-[18px]" aria-hidden>
                  💡
                </span>
                <div className="flex-1">
                  <div
                    className="text-[13px] font-semibold"
                    style={{ color: 'var(--saffron-deep)' }}
                  >
                    Suggested split
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-slate-700">
                    Proportional across {allocationPreview.length || 'all'} destinations — scaled to{' '}
                    {impact.receivedPercent}% of expected.
                  </div>
                </div>
              </div>
            ) : null}

            {/* Neutral "same as expected" card when no reduction */}
            {impact && impact.reduction === 0 ? (
              <div className="rounded-2xl border border-[#A7F0CA] bg-[#E9FFF4] p-3.5">
                <div className="text-[13px] font-semibold text-[#0F7A4F]">
                  Matches what was expected
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-slate-700">
                  No change to downstream allocations.
                </div>
              </div>
            ) : null}

            {/* NEW ALLOCATIONS preview — per-destination projected quantities */}
            {allocationPreview.length > 0 ? (
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  New Allocations
                </div>
                <div>
                  {allocationPreview.map((row, idx) => {
                    const matches = row.projected === row.original;
                    const isLast = idx === allocationPreview.length - 1;
                    return (
                      <div
                        key={row.destinationKey}
                        className={
                          'flex items-center py-2.5' + (isLast ? '' : ' border-b border-slate-100')
                        }
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-semibold text-foreground truncate">
                            {row.destinationName}
                          </div>
                          <div className="mt-0.5">
                            <TimingBadge timing={row.timing} />
                          </div>
                        </div>
                        <QuantityBadge
                          quantity={row.projected}
                          originalQuantity={matches ? undefined : row.original}
                          options={{ unit: item.unit, hideCaseUnit: true, fallbackUnit: '' }}
                          tone={matches ? 'mint' : 'peach'}
                          className="px-2.5 py-1 text-[14px]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 border-t border-slate-100 bg-white px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
            >
              Adjust split
            </Button>
            <Button
              type="submit"
              variant="default"
              className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
            >
              {impact && impact.reduction > 0 && quantity > 0
                ? `Apply ${quantity}${unitLabel ? ' ' + unitLabel.toLowerCase() : ''}`
                : 'Update quantity'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
