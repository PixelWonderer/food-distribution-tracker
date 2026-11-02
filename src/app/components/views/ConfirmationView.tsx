import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { Chip } from '@/app/components/ui/chip';
import { Input } from '@/app/components/ui/input';
import { QuantityBadge } from '@/app/components/ui/quantity-badge';
import { useModalManager } from '@/app/providers/ModalProvider';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import type { OrderConfirmationItem } from '@/types';
import {
  determineItemStatus,
  groupConfirmationItems,
  type ConfirmationGroup,
  type ConfirmationStatus,
} from '@/app/utils/confirmation';

// --- Staged flag model --------------------------------------------------
// Local intent that a pending row should commit as ran-low or ran-out.
// Nothing hits the database until the volunteer taps "Confirm all".
type StagedFlag =
  | { status: 'ran-low'; receivedQty: number }
  | { status: 'ran-out' };

type StagedFlags = Record<string, StagedFlag>;

// Default quantity when a row is first flagged ran-low. Matches
// RanLowModal's "was ran out" fallback at RanLowModal.tsx:62-64.
const defaultRanLowQty = (expected: number): number => {
  if (!Number.isFinite(expected) || expected <= 1) return Math.max(0.5, expected - 0.5);
  return Math.ceil(expected * 0.5);
};

// --- Status chip tokens (match surfaces-primary.jsx ConfirmRow) -----------
type StatusTone = {
  bg: string;
  border: string;
  text: string;
  label: string;
  icon: string;
};

const STATUS_CHIP: Record<
  Exclude<ConfirmationStatus, 'pending'>,
  Omit<StatusTone, 'label'> & { label: (item: OrderConfirmationItem) => string }
> = {
  expected: {
    bg: '#E9FFF4',
    border: '#A7F0CA',
    text: '#0F7A4F',
    icon: '✓',
    label: () => 'Confirmed',
  },
  'ran-low': {
    bg: '#FFF4ED',
    border: '#FFCFAC',
    text: '#B75A28',
    icon: '⊙',
    label: (item) =>
      `Ran low · rec'd ${item.receivedQuantity ?? 0}`,
  },
  'ran-out': {
    bg: '#FFE4E9',
    border: '#F8B8C5',
    text: '#E11D48',
    icon: '×',
    label: () => 'Ran out',
  },
};

// Chip labels for *staged* (uncommitted) flags. Different copy so volunteers
// can visually distinguish "I flagged this" vs "this is committed".
const STAGED_CHIP = {
  'ran-low': {
    bg: '#FFF4ED',
    border: '#FFCFAC',
    text: '#B75A28',
    icon: '⊙',
    label: 'Flagged ran low — tap again for ran out',
  },
  'ran-out': {
    bg: '#FFE4E9',
    border: '#F8B8C5',
    text: '#E11D48',
    icon: '×',
    label: 'Flagged ran out — tap again to clear',
  },
} as const;

// Chip for items where Claude/Food Bank heads-up flagged ran_out=true but no
// volunteer has confirmed at pickup yet. Shows as a warning so the volunteer
// knows to verify (and can override if Food Bank actually delivered).
const PROVISIONAL_RAN_OUT_CHIP = {
  bg: '#FFF4ED',
  border: '#FFCFAC',
  text: '#B75A28',
  icon: '⚠',
  label: 'Food Bank: ran out — verify at pickup',
} as const;

const QUANTITY_TONE: Record<ConfirmationStatus, 'lavender' | 'mint' | 'peach'> = {
  pending: 'lavender',
  expected: 'mint',
  'ran-low': 'peach',
  'ran-out': 'peach',
};

// Recent-update window for the multi-user mint border treatment.
const RECENT_UPDATE_MS = 6000;

// --- Time formatting helpers ---------------------------------------------
function formatAgo(ts: number | null | undefined): string {
  if (!ts) return 'just now';
  const diffMs = Date.now() - ts;
  if (diffMs < 10_000) return 'just now';
  if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s ago`;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function formatWeekDate(weekDate: string | null): string {
  if (!weekDate) return 'this week';
  const parsed = new Date(`${weekDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return weekDate;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// --- Inline ran-low stepper ----------------------------------------------
// Appears below a staged ran-low row. Scoped smaller than RanLowModal's
// full sheet — just the stepper + unit label. Clamps to 0.25..expected.
type InlineStepperProps = {
  quantity: number;
  expectedQuantity: number;
  unit: string | null | undefined;
  onChange: (next: number) => void;
};

const InlineStepper: React.FC<InlineStepperProps> = ({
  quantity,
  expectedQuantity,
  unit,
  onChange,
}) => {
  const unitLabel = (unit || 'cases').toLowerCase();
  const clamp = (n: number) => {
    if (!Number.isFinite(n)) return 0.5;
    const capped = Math.min(n, Math.max(0.25, expectedQuantity - 0.25));
    return Math.max(0.25, capped);
  };
  const dec = () => onChange(clamp(quantity - 1));
  const inc = () => onChange(clamp(quantity + 1));
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-[#FFCFAC] bg-[#FFF9F4] p-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        variant="outline"
        onClick={dec}
        className="h-10 w-10 shrink-0 rounded-lg p-0 text-lg font-bold"
        aria-label="Decrease quantity"
      >
        −
      </Button>
      <div className="flex flex-1 flex-col items-center">
        <Input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          value={quantity}
          onChange={(event) =>
            onChange(clamp(Number.parseFloat(event.target.value) || 0))
          }
          className="h-9 border-0 bg-transparent text-center text-[22px] font-bold text-[#B75A28] shadow-none focus-visible:ring-0 tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}
          aria-label={`Received ${unitLabel}`}
        />
        <span className="text-[10px] text-muted-foreground">
          {`received · expected ${expectedQuantity}`}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={inc}
        className="h-10 w-10 shrink-0 rounded-lg p-0 text-lg font-bold"
        aria-label="Increase quantity"
      >
        +
      </Button>
    </div>
  );
};

// --- ConfirmRow ----------------------------------------------------------
type ConfirmRowProps = {
  item: OrderConfirmationItem;
  staged: StagedFlag | undefined;
  onTapRow: (item: OrderConfirmationItem) => void;
  onShowDetails: (item: OrderConfirmationItem) => void;
  onUpdateStagedQty: (orderId: string, qty: number) => void;
  recentlyUpdatedByTeammate?: boolean;
  tutorialTarget?: string;
};

const ConfirmRow: React.FC<ConfirmRowProps> = ({
  item,
  staged,
  onTapRow,
  onShowDetails,
  onUpdateStagedQty,
  recentlyUpdatedByTeammate = false,
  tutorialTarget,
}) => {
  const committedStatus = determineItemStatus(item);
  const isPending = committedStatus === 'pending';

  // Effective status for display — staged flag wins on pending rows.
  const displayStatus: ConfirmationStatus =
    staged && isPending ? staged.status : committedStatus;

  const committedChip = !isPending ? STATUS_CHIP[committedStatus] : null;
  const stagedChip = staged && isPending ? STAGED_CHIP[staged.status] : null;
  const provisionalRanOut = isPending && !staged && item.ranOut && !item.isConfirmed;

  const overReceived =
    item.receivedQuantity !== null &&
    item.receivedQuantity > item.expectedQuantity;

  const displayedQty =
    staged?.status === 'ran-low'
      ? staged.receivedQty
      : staged?.status === 'ran-out'
        ? 0
        : displayStatus === 'ran-out'
          ? 0
          : item.receivedQuantity ?? item.expectedQuantity;

  const showOriginal =
    displayStatus === 'ran-low' || displayStatus === 'ran-out';

  const rowInner = (
    <div
      role="button"
      tabIndex={0}
      data-tutorial={tutorialTarget}
      onClick={() => onTapRow(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onTapRow(item);
        }
      }}
      className={cn(
        'rounded-[18px] border bg-white transition-all',
        'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1',
        'shadow-[0_1px_2px_rgba(14,16,32,0.06),0_1px_1px_rgba(14,16,32,0.04)]',
        staged?.status === 'ran-low' && 'border-[#FFCFAC]',
        staged?.status === 'ran-out' && 'border-[#F8B8C5]',
        !staged && 'border-slate-200',
        committedStatus === 'expected' && 'opacity-60'
      )}
      style={{
        padding: '14px 14px 14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        aria-hidden
        className="shrink-0 text-center leading-none"
        style={{ width: 40, fontSize: 30 }}
      >
        {item.emoji}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className="text-foreground leading-tight"
          style={{ fontSize: 16, fontWeight: 650, letterSpacing: '-0.2px' }}
        >
          {item.itemName}
        </div>

        {stagedChip ? (
          <span
            className="inline-flex w-fit items-center gap-1.5"
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: stagedChip.bg,
              border: `1px solid ${stagedChip.border}`,
              color: stagedChip.text,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span aria-hidden>{stagedChip.icon}</span>
            {stagedChip.label}
          </span>
        ) : committedChip ? (
          <span
            className="inline-flex w-fit items-center gap-1.5"
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: committedChip.bg,
              border: `1px solid ${committedChip.border}`,
              color: committedChip.text,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span aria-hidden>{committedChip.icon}</span>
            {committedChip.label(item)}
          </span>
        ) : provisionalRanOut ? (
          <span
            className="inline-flex w-fit items-center gap-1.5"
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: PROVISIONAL_RAN_OUT_CHIP.bg,
              border: `1px solid ${PROVISIONAL_RAN_OUT_CHIP.border}`,
              color: PROVISIONAL_RAN_OUT_CHIP.text,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span aria-hidden>{PROVISIONAL_RAN_OUT_CHIP.icon}</span>
            {PROVISIONAL_RAN_OUT_CHIP.label}
          </span>
        ) : (
          <div
            className="text-[11px] font-medium"
            style={{ color: '#6B6F82' }}
          >
            {`Expected · ${item.expectedQuantity}${item.unit ? ` ${item.unit}` : ''} · tap to flag`}
          </div>
        )}

        {overReceived ? (
          <div
            className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: '#FFF5D1',
              borderColor: '#F5C422',
              color: '#8A6A00',
            }}
          >
            ⚠ Over-received · expected {item.expectedQuantity}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <QuantityBadge
          quantity={displayedQty}
          originalQuantity={showOriginal ? item.expectedQuantity : undefined}
          options={{ unit: item.unit ?? undefined, hideCaseUnit: true }}
          tone={QUANTITY_TONE[displayStatus]}
        />
        {isPending ? (
          <button
            type="button"
            aria-label="Show item details"
            onClick={(event) => {
              event.stopPropagation();
              onShowDetails(item);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[12px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            ⓘ
          </button>
        ) : null}
      </div>
    </div>
  );

  const wrappedRow = recentlyUpdatedByTeammate ? (
    <div
      style={{
        position: 'relative',
        borderRadius: 18,
        padding: 2,
        background: 'linear-gradient(135deg, #0F7A4F, #A7F0CA)',
        boxShadow: '0 0 0 4px #E9FFF4',
      }}
    >
      <div style={{ background: '#fff', borderRadius: 16 }}>{rowInner}</div>
    </div>
  ) : (
    rowInner
  );

  if (staged?.status === 'ran-low') {
    return (
      <div className="flex flex-col gap-1.5">
        {wrappedRow}
        <InlineStepper
          quantity={staged.receivedQty}
          expectedQuantity={item.expectedQuantity}
          unit={item.unit}
          onChange={(qty) => onUpdateStagedQty(item.orderId, qty)}
        />
      </div>
    );
  }

  return wrappedRow;
};

// --- SectionHead ---------------------------------------------------------
const SectionHead: React.FC<{
  title: string;
  count?: string | number;
  className?: string;
}> = ({ title, count, className }) => (
  <div
    className={cn('flex items-baseline justify-between px-1 pt-4 pb-2', className)}
  >
    <div className="flex items-center gap-2">
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#6B6F82',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#9AA0B2',
          }}
        >
          {count}
        </span>
      )}
    </div>
  </div>
);

// --- GroupSection --------------------------------------------------------
type GroupSectionProps = {
  group: ConfirmationGroup;
  stagedFlags: StagedFlags;
  onTapRow: (item: OrderConfirmationItem) => void;
  onShowDetails: (item: OrderConfirmationItem) => void;
  onUpdateStagedQty: (orderId: string, qty: number) => void;
  recentTeammateUpdates: Set<string>;
  isFirstGroup?: boolean;
};

const GroupSection: React.FC<GroupSectionProps> = ({
  group,
  stagedFlags,
  onTapRow,
  onShowDetails,
  onUpdateStagedQty,
  recentTeammateUpdates,
  isFirstGroup = false,
}) => {
  const pendingItems = group.items.filter(
    (item) => determineItemStatus(item) === 'pending'
  );
  const completedItems = group.items.filter(
    (item) => determineItemStatus(item) !== 'pending'
  );
  const done = completedItems.length;
  const total = group.items.length;

  return (
    <section className="flex flex-col">
      <div className="flex items-baseline justify-between px-1 pt-2 pb-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-base leading-none">
            {group.icon}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#6B6F82',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
            }}
          >
            {group.label}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#9AA0B2',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {done}/{total}
        </span>
      </div>

      {pendingItems.length > 0 && (
        <>
          <SectionHead title="Pending" count={`${pendingItems.length} left`} />
          <div className="flex flex-col gap-2">
            {pendingItems.map((item, idx) => (
              <ConfirmRow
                key={item.orderId}
                item={item}
                staged={stagedFlags[item.orderId]}
                onTapRow={onTapRow}
                onShowDetails={onShowDetails}
                onUpdateStagedQty={onUpdateStagedQty}
                recentlyUpdatedByTeammate={recentTeammateUpdates.has(item.orderId)}
                tutorialTarget={isFirstGroup && idx === 0 ? 'confirm-first-row' : undefined}
              />
            ))}
          </div>
        </>
      )}

      {completedItems.length > 0 && (
        <>
          <SectionHead title="Done" count={completedItems.length} />
          <div className="flex flex-col gap-2">
            {completedItems.map((item) => (
              <ConfirmRow
                key={item.orderId}
                item={item}
                staged={undefined}
                onTapRow={onTapRow}
                onShowDetails={onShowDetails}
                onUpdateStagedQty={onUpdateStagedQty}
                recentlyUpdatedByTeammate={recentTeammateUpdates.has(item.orderId)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

// --- ConfirmEmpty --------------------------------------------------------
const ConfirmEmpty: React.FC<{
  weekDate: string | null;
  lastSyncTime: number | null;
}> = ({ weekDate, lastSyncTime }) => {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div
        aria-hidden
        className="flex items-center justify-center"
        style={{
          width: 92,
          height: 92,
          borderRadius: 26,
          background: '#FFF5D1',
          fontSize: 42,
          marginBottom: 16,
          boxShadow: 'inset 0 -8px 0 #F8D979',
        }}
      >
        🥕
      </div>
      <div
        className="text-foreground"
        style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}
      >
        Nothing here yet.
      </div>
      <p
        className="max-w-[280px]"
        style={{ fontSize: 13, color: '#6B6F82', lineHeight: 1.5 }}
      >
        The weekly order imported on Thursday. Items appear as Food Bank drops the
        pallet — usually between 8:30 and 9:00 on Friday.
      </p>
      <div className="flex gap-2" style={{ marginTop: 20 }}>
        <Chip tone="saffron" density="tag" aria-label={`Imported ${formatWeekDate(weekDate)}`}>
          <span aria-hidden>📅</span>
          {`Imported ${formatWeekDate(weekDate)}`}
        </Chip>
        <Chip tone="slate" density="tag" aria-label={`Checked ${formatAgo(lastSyncTime)}`}>
          <span aria-hidden>↻</span>
          {`Checked ${formatAgo(lastSyncTime)}`}
        </Chip>
      </div>
    </div>
  );
};

// --- Multi-user attribution card -----------------------------------------
const TeammateAttributionCard: React.FC<{
  teammateName: string;
  itemName: string;
}> = ({ teammateName, itemName }) => (
  <div
    style={{
      marginTop: 8,
      padding: '8px 12px',
      background: '#E9FFF4',
      border: '1px dashed #A7F0CA',
      borderRadius: 12,
      fontSize: 12,
      color: '#0F7A4F',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: 99,
        background: '#0F7A4F',
      }}
    />
    {`${teammateName} confirmed ${itemName}. You don't need to re-check.`}
  </div>
);

// --- Bulk commit bar -----------------------------------------------------
type BulkCommitBarProps = {
  expectedCount: number;
  ranLowCount: number;
  ranOutCount: number;
  disabled: boolean;
  inFlight: boolean;
  onCommit: () => void;
};

const BulkCommitBar: React.FC<BulkCommitBarProps> = ({
  expectedCount,
  ranLowCount,
  ranOutCount,
  disabled,
  inFlight,
  onCommit,
}) => {
  const total = expectedCount + ranLowCount + ranOutCount;
  const parts: string[] = [];
  if (expectedCount > 0) parts.push(`${expectedCount} as expected`);
  if (ranLowCount > 0) parts.push(`${ranLowCount} ran low`);
  if (ranOutCount > 0) parts.push(`${ranOutCount} ran out`);
  const breakdown = parts.length > 0 ? parts.join(' · ') : 'Nothing pending';

  const buttonLabel = inFlight
    ? 'Confirming…'
    : total === 0
      ? 'All caught up'
      : expectedCount === total
        ? `Confirm all ${total} as expected`
        : `Confirm ${total} items`;

  return (
    <div
      className="sticky z-40 mt-4 flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_6px_24px_rgba(14,16,32,0.1)]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)' }}
    >
      <Button
        type="button"
        variant="confirm"
        size="lg"
        disabled={disabled || inFlight || total === 0}
        onClick={onCommit}
        className="h-12 w-full rounded-xl text-[15px] font-semibold"
      >
        <span aria-hidden>✓</span>
        {buttonLabel}
      </Button>
      <div className="text-center text-[11px] text-muted-foreground">
        {breakdown}
      </div>
    </div>
  );
};

// --- Main view -----------------------------------------------------------
export const ConfirmationView: React.FC = () => {
  const {
    orderConfirmationItems: items,
    isSyncing,
    preferences,
    isDemoMode,
    lastSyncTime,
    currentWeekDate,
  } = useAppStore((state) => ({
    orderConfirmationItems: state.orderConfirmationItems ?? [],
    isSyncing: state.isSyncing,
    preferences: state.preferences,
    isDemoMode: state.isDemoMode,
    lastSyncTime: state.lastSyncTime,
    currentWeekDate: state.currentWeekDate,
  }));

  const confirmItemRanLow = useAppStore((state) => state.confirmItemRanLow);
  const markItemRanOut = useAppStore((state) => state.markItemRanOut);
  const confirmAllItems = useAppStore((state) => state.confirmAllItems);
  const resetConfirmations = useAppStore((state) => state.resetConfirmations);
  const { openItemDetail, openPreferences } = useModalManager();

  const requireVolunteerName = useCallback(() => {
    if (isDemoMode) return 'Demo User';
    const trimmed = preferences.volunteerName.trim();
    if (!trimmed) {
      toast.info('Please set your volunteer name first');
      openPreferences();
      return null;
    }
    return trimmed;
  }, [preferences.volunteerName, openPreferences, isDemoMode]);

  const groups = useMemo(() => groupConfirmationItems(items), [items]);
  const fridgeGroup = groups.find((group) => group.key === 'fridge') ?? null;
  const pantryGroup = groups.find((group) => group.key === 'pantry') ?? null;
  const otherGroup = groups.find((group) => group.key === 'other') ?? null;

  const { totalItems, doneItems } = useMemo(() => {
    const total = items.length;
    const done = items.filter(
      (item) => determineItemStatus(item) !== 'pending'
    ).length;
    return { totalItems: total, doneItems: done };
  }, [items]);

  const progressPct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  // --- Staged flags (local intent; not persisted) -----------------------
  const [stagedFlags, setStagedFlags] = useState<StagedFlags>({});
  const inFlightRef = useRef(false);
  const [inFlight, setInFlight] = useState(false);

  // Prune staged flags for items that no longer exist or are no longer pending
  // (e.g. a teammate just committed them, or the weekly import cleared).
  useEffect(() => {
    setStagedFlags((prev) => {
      const itemById = new Map(items.map((i) => [i.orderId, i]));
      let changed = false;
      const next: StagedFlags = {};
      for (const [orderId, flag] of Object.entries(prev)) {
        const item = itemById.get(orderId);
        if (!item) {
          changed = true;
          continue;
        }
        if (determineItemStatus(item) !== 'pending') {
          changed = true;
          continue;
        }
        next[orderId] = flag;
      }
      return changed ? next : prev;
    });
  }, [items]);

  // Cycle: pending → ran-low → ran-out → pending (clear)
  const cycleStagedFlag = useCallback(
    (item: OrderConfirmationItem) => {
      setStagedFlags((prev) => {
        const current = prev[item.orderId];
        const next = { ...prev };
        if (!current) {
          next[item.orderId] = {
            status: 'ran-low',
            receivedQty: defaultRanLowQty(item.expectedQuantity),
          };
        } else if (current.status === 'ran-low') {
          next[item.orderId] = { status: 'ran-out' };
        } else {
          delete next[item.orderId];
        }
        return next;
      });
    },
    []
  );

  const updateStagedQty = useCallback((orderId: string, qty: number) => {
    setStagedFlags((prev) => {
      const current = prev[orderId];
      if (!current || current.status !== 'ran-low') return prev;
      return { ...prev, [orderId]: { status: 'ran-low', receivedQty: qty } };
    });
  }, []);

  // Multi-user updates
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { recentTeammateUpdates, teammateAttribution } = useMemo(() => {
    const updates = new Set<string>();
    const currentVolunteer = preferences.volunteerName.trim();
    let attribution:
      | { teammateName: string; itemName: string; orderId: string; ts: number }
      | null = null;
    const now = Date.now();
    for (const item of items) {
      if (!item.confirmedAt || !item.confirmedBy) continue;
      const confirmedAtMs = Date.parse(item.confirmedAt);
      if (Number.isNaN(confirmedAtMs)) continue;
      if (now - confirmedAtMs > RECENT_UPDATE_MS) continue;
      if (currentVolunteer && item.confirmedBy === currentVolunteer) continue;
      updates.add(item.orderId);
      if (!attribution || confirmedAtMs > attribution.ts) {
        attribution = {
          teammateName: item.confirmedBy,
          itemName: item.itemName,
          orderId: item.orderId,
          ts: confirmedAtMs,
        };
      }
    }
    return { recentTeammateUpdates: updates, teammateAttribution: attribution };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, preferences.volunteerName, tick]);

  // --- Row tap handler ---------------------------------------------------
  // Pending + committed rows behave differently:
  //   - Pending: cycle the staged flag.
  //   - Committed (expected/ran-low/ran-out): open details dialog.
  //
  // Note: items where Claude/Food Bank provisionally set ran_out=true but no
  // volunteer has confirmed are classified as 'pending' (see
  // determineItemStatus in app/utils/confirmation.ts) so the cycle works
  // on them — volunteer's pickup-floor observation overrides the heads-up.
  const handleTapRow = useCallback(
    (item: OrderConfirmationItem) => {
      const status = determineItemStatus(item);
      if (status === 'pending') {
        cycleStagedFlag(item);
        return;
      }
      openItemDetail({
        itemName: item.itemName,
        sheetRow: item.sheetRow ?? undefined,
        emoji: item.emoji,
        unit: item.unit,
        expectedQuantity: item.expectedQuantity,
        receivedQuantity: item.receivedQuantity ?? undefined,
        storageType: item.storageType ?? undefined,
        source: 'confirmation',
        mode: 'confirmation',
      });
    },
    [cycleStagedFlag, openItemDetail]
  );

  const handleShowDetails = useCallback(
    (item: OrderConfirmationItem) => {
      openItemDetail({
        itemName: item.itemName,
        sheetRow: item.sheetRow ?? undefined,
        emoji: item.emoji,
        unit: item.unit,
        expectedQuantity: item.expectedQuantity,
        receivedQuantity: item.receivedQuantity ?? undefined,
        storageType: item.storageType ?? undefined,
        source: 'confirmation',
        mode: 'confirmation',
      });
    },
    [openItemDetail]
  );

  // --- Bulk commit -------------------------------------------------------
  const pendingItems = useMemo(
    () => items.filter((item) => determineItemStatus(item) === 'pending'),
    [items]
  );

  const { expectedToCommit, ranLowToCommit, ranOutToCommit } = useMemo(() => {
    const expected: OrderConfirmationItem[] = [];
    const ranLow: Array<{ item: OrderConfirmationItem; qty: number }> = [];
    const ranOut: OrderConfirmationItem[] = [];
    for (const item of pendingItems) {
      const flag = stagedFlags[item.orderId];
      if (!flag) {
        // Provisional ran_out from Food Bank's heads-up (no volunteer override yet):
        // default to committing as ran-out so bulk commit doesn't silently
        // mark them as fully received.
        if (item.ranOut) ranOut.push(item);
        else expected.push(item);
      } else if (flag.status === 'ran-low')
        ranLow.push({ item, qty: flag.receivedQty });
      else ranOut.push(item);
    }
    return {
      expectedToCommit: expected,
      ranLowToCommit: ranLow,
      ranOutToCommit: ranOut,
    };
  }, [pendingItems, stagedFlags]);

  const handleBulkCommit = useCallback(async () => {
    if (inFlightRef.current) return;
    const name = requireVolunteerName();
    if (!name) return;

    inFlightRef.current = true;
    setInFlight(true);
    try {
      // Ran-low and ran-out each need per-item RPCs (quantity varies);
      // the remaining "expected" items go through a single atomic RPC that
      // skips already-confirmed allocations — so the ran-low writes above
      // are not touched.
      let succeeded = 0;
      let failed = 0;
      const commitSettled = (orderId: string) => {
        setStagedFlags((prev) => {
          if (!prev[orderId]) return prev;
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      };
      for (const { item, qty } of ranLowToCommit) {
        try {
          await confirmItemRanLow(item.orderId, qty, name);
          commitSettled(item.orderId);
          succeeded++;
        } catch {
          failed++;
        }
      }
      for (const item of ranOutToCommit) {
        try {
          await markItemRanOut(item.orderId, name);
          commitSettled(item.orderId);
          succeeded++;
        } catch {
          failed++;
        }
      }
      if (expectedToCommit.length > 0) {
        try {
          await confirmAllItems(name);
          succeeded += expectedToCommit.length;
        } catch {
          failed += expectedToCommit.length;
        }
      }
      if (failed === 0) {
        toast.success(
          succeeded === 1 ? 'Confirmed 1 item' : `Confirmed ${succeeded} items`
        );
      } else if (succeeded === 0) {
        toast.error('Could not confirm items — will retry automatically');
      } else {
        toast.info(
          `Confirmed ${succeeded}, ${failed} failed — will retry automatically`
        );
      }
    } finally {
      inFlightRef.current = false;
      setInFlight(false);
    }
  }, [
    confirmAllItems,
    confirmItemRanLow,
    expectedToCommit,
    markItemRanOut,
    ranLowToCommit,
    ranOutToCommit,
    requireVolunteerName,
  ]);

  const handleReset = useCallback(async () => {
    const name = requireVolunteerName();
    setStagedFlags({});
    await resetConfirmations(name || undefined);
  }, [resetConfirmations, requireVolunteerName]);

  if (totalItems === 0) {
    return (
      <div className="flex flex-col pt-2">
        <ConfirmEmpty weekDate={currentWeekDate} lastSyncTime={lastSyncTime} />
      </div>
    );
  }

  const hasPending = pendingItems.length > 0;

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div
        className="px-1"
        role="progressbar"
        aria-valuenow={doneItems}
        aria-valuemin={0}
        aria-valuemax={totalItems}
        aria-label={`${doneItems} of ${totalItems} items confirmed`}
      >
        <div
          className="overflow-hidden rounded-full"
          style={{ height: 6, background: '#F0F2F6' }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4F46FF, #3B33D4)',
              transition: 'width 240ms ease-out',
            }}
          />
        </div>
      </div>

      {teammateAttribution && (
        <TeammateAttributionCard
          teammateName={teammateAttribution.teammateName}
          itemName={teammateAttribution.itemName}
        />
      )}

      {fridgeGroup && (
        <GroupSection
          group={fridgeGroup}
          stagedFlags={stagedFlags}
          onTapRow={handleTapRow}
          onShowDetails={handleShowDetails}
          onUpdateStagedQty={updateStagedQty}
          recentTeammateUpdates={recentTeammateUpdates}
          isFirstGroup
        />
      )}

      {pantryGroup && (
        <GroupSection
          group={pantryGroup}
          stagedFlags={stagedFlags}
          onTapRow={handleTapRow}
          onShowDetails={handleShowDetails}
          onUpdateStagedQty={updateStagedQty}
          recentTeammateUpdates={recentTeammateUpdates}
          isFirstGroup={!fridgeGroup}
        />
      )}

      {otherGroup && (
        <GroupSection
          group={otherGroup}
          stagedFlags={stagedFlags}
          onTapRow={handleTapRow}
          onShowDetails={handleShowDetails}
          onUpdateStagedQty={updateStagedQty}
          recentTeammateUpdates={recentTeammateUpdates}
          isFirstGroup={!fridgeGroup && !pantryGroup}
        />
      )}

      {hasPending && (
        <div data-tutorial="confirm-bulk-bar">
          <BulkCommitBar
            expectedCount={expectedToCommit.length}
            ranLowCount={ranLowToCommit.length}
            ranOutCount={ranOutToCommit.length}
            disabled={isSyncing}
            inFlight={inFlight}
            onCommit={() => void handleBulkCommit()}
          />
        </div>
      )}

      <div className="mt-4 flex justify-end px-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleReset()}
          disabled={isSyncing}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden>↺</span>
          Reset all confirmations
        </Button>
      </div>
    </div>
  );
};
