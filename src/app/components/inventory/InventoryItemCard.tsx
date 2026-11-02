import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { QuantityBadge } from '@/app/components/ui/quantity-badge';
import { Chip } from '@/app/components/ui/chip';
import { cn } from '@/lib/utils';
import type { InventoryItem, InventoryViewMode } from '@/types';
import { formatQuantity } from '@/app/utils/quantity';
import { Check, RotateCcw } from 'lucide-react';

type InventoryItemCardProps = {
  item: InventoryItem;
  mode: InventoryViewMode;
  onTake?: () => void;
  onQuantityChange?: (delta: number) => Promise<void>;
  onMarkCounted?: () => void;
  isUpdating?: boolean;
};

// Relative-time helper for attribution line ("2h ago", "yesterday")
const formatRelative = (iso: string | null): string | null => {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return null;
};

export const InventoryItemCard: React.FC<InventoryItemCardProps> = ({
  item,
  mode,
  onTake,
  onQuantityChange,
  onMarkCounted,
  isUpdating = false,
}) => {
  const [localUpdating, setLocalUpdating] = useState(false);
  const updating = isUpdating || localUpdating;

  // Pending state for Count mode (buffer changes before confirming)
  const [pendingQuantity, setPendingQuantity] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset pending quantity when item changes (e.g., after external update)
  useEffect(() => {
    setPendingQuantity(null);
  }, [item.currentQuantity]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Calculate display quantity (pending overrides actual for count mode)
  const displayQuantity = mode === 'count' && pendingQuantity !== null
    ? pendingQuantity
    : item.currentQuantity;
  const hasChanges = mode === 'count' && pendingQuantity !== null && pendingQuantity !== item.currentQuantity;

  // Get pluralized unit based on display quantity
  const { unit: pluralizedUnit } = formatQuantity(displayQuantity, { unit: item.unit });

  // For count mode: update pending quantity only (no API call)
  const handlePendingChange = (delta: number) => {
    const currentPending = pendingQuantity ?? item.currentQuantity;
    const newQuantity = Math.max(0, currentPending + delta);
    setPendingQuantity(newQuantity);
  };

  // Confirm the pending change (makes API call)
  const handleConfirm = async () => {
    if (!onQuantityChange || pendingQuantity === null || updating) return;

    const delta = pendingQuantity - item.currentQuantity;
    if (delta === 0) {
      setPendingQuantity(null);
      return;
    }

    setLocalUpdating(true);
    try {
      await onQuantityChange(delta);
      setPendingQuantity(null);
    } finally {
      setLocalUpdating(false);
    }
  };

  // Reset pending changes
  const handleReset = () => {
    setPendingQuantity(null);
  };

  // Tap-to-edit: start editing
  const handleStartEdit = () => {
    if (mode !== 'count') return;
    setInputValue(displayQuantity.toString());
    setIsEditing(true);
  };

  // Tap-to-edit: finish editing
  const handleFinishEdit = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setPendingQuantity(parsed);
    }
    setIsEditing(false);
  };

  // Handle keyboard events in edit mode
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const isOutOfStock = item.currentQuantity === 0;
  const isLowStock = item.isLowStock && !isOutOfStock;
  const par = item.lowStockThreshold;

  // Progress-with-par-marker. Stock fill uses par as denominator so par == "full bar".
  // Par-tick uses max(stock, par) so the tick stays visible when overstocked.
  const parSafe = Math.max(par, 1);
  const stockPct = Math.min(100, (item.currentQuantity / parSafe) * 100);
  const parPct = Math.min(100, (par / Math.max(item.currentQuantity, par, 1)) * 100);

  const subcategoryLabel = item.subcategory || item.category || 'Pantry';
  const lastUpdatedLabel = formatRelative(item.lastUpdatedAt);
  const updatedBy = item.lastUpdatedBy;

  return (
    <div
      className={cn(
        'rounded-[16px] border border-slate-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(14,16,32,0.06),0_1px_1px_rgba(14,16,32,0.04)] transition-colors'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Emoji glyph — 28px per design */}
        <span aria-hidden className="shrink-0 text-[28px] leading-none">
          {item.emoji}
        </span>

        {/* Name column: name + badges + metadata line */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="truncate text-[15px] font-[650] leading-tight text-slate-900">
              {item.itemName}
            </span>
            {mode !== 'count' && isLowStock && (
              <Chip tone="rose" density="tag" className="pointer-events-none">
                Below par
              </Chip>
            )}
            {mode !== 'count' && isOutOfStock && (
              <Chip tone="rose" density="tag" className="pointer-events-none">
                Out
              </Chip>
            )}
          </div>
          <div className="mt-0.5 text-[11px] leading-tight text-slate-500">
            <span>{subcategoryLabel}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span>par {par} {item.unit}</span>
            {lastUpdatedLabel && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>{lastUpdatedLabel}{updatedBy ? ` · ${updatedBy}` : ''}</span>
              </>
            )}
          </div>
        </div>

        {/* Right-side controls, vary by mode */}
        {mode === 'browse' && (
          <div className="flex shrink-0 items-center gap-2">
            <QuantityBadge
              quantity={item.currentQuantity}
              options={{ unit: item.unit }}
              tone={isOutOfStock || isLowStock ? 'peach' : 'mint'}
            />
            {item.currentQuantity > 0 && onTake && (
              <Button
                size="sm"
                variant="outline"
                onClick={onTake}
                className="h-9 min-w-11 px-3"
              >
                Take
              </Button>
            )}
          </div>
        )}

        {mode === 'count' && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePendingChange(-1)}
              disabled={updating || displayQuantity <= 0}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-lg font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Decrease count"
            >
              −
            </button>

            {isEditing ? (
              <input
                ref={inputRef}
                type="number"
                min="0"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={handleKeyDown}
                className="w-14 rounded-lg border border-indigo-300 px-1 py-0.5 text-center text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            ) : (
              <button
                type="button"
                onClick={handleStartEdit}
                className={cn(
                  'h-11 w-14 rounded-lg text-center transition',
                  hasChanges
                    ? 'border border-[#CFC9FF] bg-[#E8E6FF]'
                    : 'hover:bg-slate-50'
                )}
              >
                <span
                  className={cn(
                    'block text-lg font-semibold tabular-nums',
                    hasChanges ? 'text-[#3B33D4]' : 'text-slate-800'
                  )}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {displayQuantity}
                </span>
                <span className="block text-[10px] capitalize leading-none text-slate-500">
                  {pluralizedUnit}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handlePendingChange(1)}
              disabled={updating}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-lg font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Increase count"
            >
              +
            </button>

            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={updating}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                title="Reset"
                aria-label="Reset"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={hasChanges ? handleConfirm : onMarkCounted}
              disabled={updating}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-lg transition disabled:opacity-50',
                hasChanges
                  ? 'bg-[#0F7A4F] text-white hover:bg-[#0D6A44]'
                  : 'border border-slate-300 text-slate-400 hover:border-[#A7F0CA] hover:bg-[#E9FFF4] hover:text-[#0F7A4F]'
              )}
              title={hasChanges ? 'Confirm change' : 'Mark as counted'}
              aria-label={hasChanges ? 'Confirm change' : 'Mark as counted'}
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        )}

        {mode === 'reorder' && (
          <QuantityBadge
            quantity={item.currentQuantity}
            options={{ unit: item.unit }}
            tone={isOutOfStock || isLowStock ? 'peach' : 'mint'}
          />
        )}
      </div>

      {/* Progress-with-par-marker — only when we have a meaningful par and not during counting */}
      {mode !== 'count' && par > 0 && (
        <div
          className="relative mt-2 h-1 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={item.currentQuantity}
          aria-valuemin={0}
          aria-valuemax={Math.max(par, item.currentQuantity)}
          aria-label={`Stock ${item.currentQuantity} of par ${par}`}
        >
          <div
            className={cn(
              'h-full transition-all',
              isOutOfStock
                ? 'bg-[#B75A28]'
                : isLowStock
                  ? 'bg-[#B75A28]'
                  : 'bg-[#0F7A4F]'
            )}
            style={{ width: `${stockPct}%` }}
          />
          {/* Par-tick: 2px wide, bleeds above/below the bar — 10px per design */}
          <div
            className="absolute top-[-3px] h-[10px] w-[2px] bg-slate-400"
            style={{ left: `${parPct}%` }}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
};

export default InventoryItemCard;
