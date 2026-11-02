import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { QuantityBadge } from '@/app/components/ui/quantity-badge';
import { TimingBadge } from '@/app/components/ui/timing-badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { getSupabaseService } from '@/services/supabaseService';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { normalizeTimingString } from '@/app/utils/timing';
import type { DestinationInfo, ItemData } from '@/types';

export type RedirectItemRequest = {
  item: ItemData;
  sourceDestinationName: string;
  sourceDestinationId: string;
  allocationId: string;
};

type RedirectItemSheetProps = {
  open: boolean;
  onClose: () => void;
  request: RedirectItemRequest | null;
};

// Canonical order for timing groupings — same as PickupView
const TIMING_ORDER = [
  'friday am',
  'friday noon',
  'friday pm',
  'saturday am',
  'saturday noon',
  'saturday pm',
  'sunday',
  'monday am',
  'unscheduled',
];

type TimingGroup = {
  key: string; // normalized timing slot or 'custom' or 'surplus'
  label: string | null; // null for surplus/custom meta rows
  destinations: DestinationInfo[];
};

export const RedirectItemSheet: React.FC<RedirectItemSheetProps> = ({
  open,
  onClose,
  request,
}) => {
  const [destinations, setDestinations] = useState<DestinationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [redirecting, setRedirecting] = useState(false);

  const volunteerName = useAppStore((s) => s.preferences.volunteerName);
  const fetchData = useAppStore((s) => s.fetchData);

  const maxQuantity = request?.item.quantity ?? 1;
  const step = maxQuantity >= 10 ? 1 : 0.5;

  const fetchDestinations = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseService();
      const data = await supabase.getActiveDestinations();
      const mapped: DestinationInfo[] = data
        .filter((d) => d.id !== request?.sourceDestinationId)
        .map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          shortName: d.short_name,
          timing: d.timing,
          defaultTiming: d.default_timing,
          isDirect: d.is_direct ?? false,
          displayOrder: d.display_order ?? 999,
          isCustom: d.is_custom ?? false,
          isActive: d.is_active ?? true,
          createdBy: d.created_by,
        }));
      setDestinations(mapped);
    } catch (error) {
      console.error('Error fetching destinations:', error);
      toast.error('Failed to load destinations');
    } finally {
      setLoading(false);
    }
  }, [request?.sourceDestinationId]);

  useEffect(() => {
    if (open && request) {
      fetchDestinations();
      setSelectedDestinationId(null);
      setQuantity(Math.min(request.item.quantity, 1));
    }
  }, [open, request, fetchDestinations]);

  const handleRedirect = async () => {
    if (!selectedDestinationId || !request) {
      toast.error('Please select a destination');
      return;
    }

    if (quantity <= 0 || quantity > maxQuantity) {
      toast.error('Invalid quantity');
      return;
    }

    try {
      setRedirecting(true);
      const supabase = getSupabaseService();
      await supabase.redirectItem(
        request.allocationId,
        selectedDestinationId,
        quantity,
        volunteerName || undefined
      );

      const targetDest = destinations.find((d) => d.id === selectedDestinationId);
      toast.success(
        `Redirected ${quantity}x ${request.item.name} to ${targetDest?.name || 'destination'}`
      );

      await fetchData();
      onClose();
    } catch (error) {
      console.error('Error redirecting item:', error);
      toast.error('Failed to redirect item');
    } finally {
      setRedirecting(false);
    }
  };

  // Group destinations by timing — surplus first, custom second, then timing slots
  const grouped: TimingGroup[] = useMemo(() => {
    const surplus = destinations.find((d) => d.code === 'surplus');
    const customs = destinations.filter((d) => d.isCustom && d.code !== 'surplus');
    const regulars = destinations.filter((d) => !d.isCustom && d.code !== 'surplus');

    const byTiming = new Map<string, DestinationInfo[]>();
    regulars.forEach((d) => {
      const key = d.timing ? normalizeTimingString(d.timing) : 'unscheduled';
      const bucket = byTiming.get(key) ?? [];
      bucket.push(d);
      byTiming.set(key, bucket);
    });

    const orderedTimingKeys = Array.from(byTiming.keys()).sort(
      (a, b) => {
        const ai = TIMING_ORDER.indexOf(a);
        const bi = TIMING_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
    );

    const groups: TimingGroup[] = [];
    if (surplus) {
      groups.push({ key: 'surplus', label: null, destinations: [surplus] });
    }
    if (customs.length > 0) {
      groups.push({ key: 'custom', label: null, destinations: customs });
    }
    orderedTimingKeys.forEach((k) => {
      const list = byTiming.get(k) ?? [];
      list.sort((a, b) => a.displayOrder - b.displayOrder);
      groups.push({ key: k, label: k, destinations: list });
    });
    return groups;
  }, [destinations]);

  if (!request) {
    return null;
  }

  const displayQty = Number.isInteger(quantity) ? quantity : quantity.toFixed(1);
  const selectedCount = selectedDestinationId ? 1 : 0;

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] gap-0 overflow-hidden rounded-t-[24px] border-border/70 bg-white p-0 shadow-[0_-28px_90px_rgba(15,23,42,0.18)]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-2" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <SheetHeader className="gap-1 px-5 pb-2 pt-3">
          <SheetTitle className="text-[20px] font-bold leading-tight tracking-[-0.3px] text-foreground">
            Redirect excess
          </SheetTitle>
          <SheetDescription className="text-[13px] text-muted-foreground">
            {request.sourceDestinationName} left {maxQuantity} behind. Where to?
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2" style={{ maxHeight: '60vh' }}>
          {/* Source chip card */}
          <div className="mb-3 flex items-center gap-3 rounded-[14px] bg-slate-50 p-3">
            <span className="text-[32px] leading-none" aria-hidden>
              {request.item.emoji}
            </span>
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-foreground">
                {request.item.name}
              </div>
              <div className="text-[11px] text-muted-foreground">
                From {request.sourceDestinationName}
              </div>
            </div>
            <QuantityBadge
              quantity={quantity}
              tone="peach"
              className="px-2.5 py-1 text-[16px]"
            />
          </div>

          {/* Destination picker grouped by timing — primary interaction */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : destinations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
              No other destinations available
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.key}>
                <TimingSeparator group={group} />
                {group.destinations.map((dest) => (
                  <DestinationRow
                    key={dest.id}
                    destination={dest}
                    selected={selectedDestinationId === dest.id}
                    quantity={quantity}
                    onSelect={() => setSelectedDestinationId(dest.id)}
                  />
                ))}
              </div>
            ))
          )}

          {/* Quantity stepper — de-emphasized detail below the destination picker */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Quantity · {maxQuantity} available
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(step, quantity - step))}
                disabled={quantity <= step}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <div
                className="min-w-[2.5rem] text-center font-bold text-slate-700 tabular-nums"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 18,
                  letterSpacing: '-0.02em',
                }}
              >
                {displayQty}
              </div>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(maxQuantity, quantity + step))}
                disabled={quantity >= maxQuantity}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <div className="ml-auto flex gap-1">
                <QuickPickChip
                  label="Min"
                  active={quantity === step}
                  onClick={() => setQuantity(step)}
                />
                <QuickPickChip
                  label="Half"
                  active={Math.abs(quantity - Math.round((maxQuantity / 2) / step) * step) < 0.001}
                  onClick={() => setQuantity(Math.max(step, Math.round((maxQuantity / 2) / step) * step))}
                />
                <QuickPickChip
                  label="All"
                  active={quantity === maxQuantity}
                  onClick={() => setQuantity(maxQuantity)}
                />
              </div>
            </div>
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
            onClick={handleRedirect}
            disabled={redirecting || !selectedDestinationId || quantity <= 0}
            variant="default"
            className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
          >
            {redirecting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Redirecting…
              </>
            ) : selectedCount > 0 ? (
              `Redirect ${displayQty} to ${selectedCount} destination${selectedCount === 1 ? '' : 's'}`
            ) : (
              `Redirect ${displayQty}`
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

type QuickPickChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

const QuickPickChip: React.FC<QuickPickChipProps> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors',
      active ? 'text-[#3B33D4]' : 'text-slate-400 hover:text-slate-600'
    )}
    style={active ? { background: 'var(--indigo-soft)' } : undefined}
  >
    {label}
  </button>
);

type TimingSeparatorProps = {
  group: TimingGroup;
};

const TimingSeparator: React.FC<TimingSeparatorProps> = ({ group }) => {
  if (group.key === 'surplus') {
    return (
      <div className="flex items-center gap-2 px-0.5 pb-2 pt-3">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: 'var(--saffron-soft)',
            borderColor: '#F8D979',
            color: 'var(--saffron-deep)',
          }}
        >
          <span aria-hidden>🏦</span> Storage
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
    );
  }
  if (group.key === 'custom') {
    return (
      <div className="flex items-center gap-2 px-0.5 pb-2 pt-3">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: 'var(--indigo-soft)',
            borderColor: '#CFC9FF',
            color: 'var(--indigo-deep)',
          }}
        >
          Custom
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
    );
  }
  if (!group.label) return null;
  return (
    <div className="flex items-center gap-2 px-0.5 pb-2 pt-3">
      <TimingBadge timing={group.label} abbreviated={false} />
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
};

type DestinationRowProps = {
  destination: DestinationInfo;
  selected: boolean;
  quantity: number;
  onSelect: () => void;
};

const DestinationRow: React.FC<DestinationRowProps> = ({
  destination,
  selected,
  quantity,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'mb-1.5 flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors',
        selected
          ? ''
          : 'border-slate-200 bg-white hover:border-slate-300'
      )}
      style={
        selected
          ? {
              background: 'var(--indigo-soft)',
              borderColor: '#C7C1FF',
            }
          : undefined
      }
    >
      <div className="flex-1">
        <div
          className={cn(
            'text-[14px] font-semibold',
            selected ? 'text-[#3B33D4]' : 'text-foreground'
          )}
        >
          {destination.name}
        </div>
        {destination.code === 'surplus' ? (
          <div className="mt-0.5 text-[11px] text-slate-600">Hold for later distribution</div>
        ) : destination.isDirect ? (
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#C99B00]">
            Direct hand-off
          </div>
        ) : null}
      </div>
      {selected ? (
        <QuantityBadge
          quantity={quantity}
          options={{ fallbackUnit: '' }}
          tone="mint"
          className="px-2.5 py-1 text-[14px]"
        />
      ) : (
        <span className="text-[12px] font-semibold text-slate-400">+0</span>
      )}
    </button>
  );
};
