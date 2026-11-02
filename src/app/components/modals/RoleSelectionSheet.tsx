import React, { useState, useMemo } from 'react';

import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent } from '@/app/components/ui/sheet';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { TIMING_SLOTS } from '@/app/utils/roles';
import { getDestinationsByTiming, getAllGroupOptions } from '@/app/utils/timing';
import type { VolunteerRole, PickupFilterMode } from '@/types';

type RoleSelectionSheetProps = {
  open: boolean;
  onClose: () => void;
};

type SelectionStep = 'role' | 'pickupFilter' | 'pickupGroups' | 'pickupTiming';

// Role options ordered: Food Bank first, then Pickup, then Co-op Delivery, then Full
const ROLE_OPTIONS: Array<{
  id: VolunteerRole;
  emoji: string;
  name: string;
  description: string;
}> = [
  {
    id: 'foodBank',
    emoji: '🌐',
    name: 'Full shift at Hub',
    description: 'Confirm, Storage, partial Pickup',
  },
  {
    id: 'pickupOnly',
    emoji: '🛒',
    name: 'Picking up for my co-op',
    description: 'Just the Pickup tab, filtered',
  },
  {
    id: 'coopDelivery',
    emoji: '🥕',
    name: 'Driving a delivery',
    description: 'Pickup tab for my route',
  },
  {
    id: 'fullAccess',
    emoji: '🔓',
    name: 'Coordinating',
    description: 'Full access to everything',
  },
];

const FILTER_OPTIONS: Array<{
  id: PickupFilterMode;
  emoji: string;
  name: string;
  description: string;
}> = [
  {
    id: 'groups',
    emoji: '🏷️',
    name: 'By group name',
    description: 'Pick specific groups (Partner Group 5, Co-op C, etc.)',
  },
  {
    id: 'timing',
    emoji: '🕐',
    name: 'By timing slot',
    description: 'Show everything in a time window',
  },
];

// Pastel swatch per-group so the grid reads like tokens, not a wall of text.
const GROUP_SWATCHES = [
  'bg-[#E9DEFF]',
  'bg-[#E9FFF4]',
  'bg-[#FFF4ED]',
  'bg-[#FFF5D1]',
  'bg-[#E8E6FF]',
];

// ── Shared bits ──────────────────────────────────────────────────────────────

type ProgressBarProps = {
  /** Always 3 in the redesigned flow, but kept as a prop for future flexibility. */
  total: number;
  /** 1-indexed position of the currently active step. */
  current: number;
};
// Design always shows 3 equal-width pills regardless of which branch the user takes.
// Non-pickup roles "skip" steps 2-3, but we still render all three pills (dimmed for
// the steps that won't happen) so the visual weight matches the design comps.
const ProgressBar: React.FC<ProgressBarProps> = ({ total, current }) => (
  <div className="flex gap-1.5" aria-hidden>
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={cn(
          'h-1 flex-1 rounded-full transition-colors',
          i < current ? 'bg-primary' : 'bg-slate-200'
        )}
      />
    ))}
  </div>
);

type StepFrameProps = {
  total: number;
  current: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};
const StepFrame: React.FC<StepFrameProps> = ({ total, current, title, subtitle, children, footer }) => (
  <div className="flex h-full flex-col">
    <div className="pb-4 pt-2">
      <ProgressBar total={total} current={current} />
    </div>
    <div className="pb-4">
      <div
        className="text-[11px] font-bold uppercase text-slate-500"
        style={{ letterSpacing: '0.14em' }}
      >
        STEP {current} OF {total}
      </div>
      <h2
        className="mt-1.5 text-[28px] font-bold leading-[1.15] text-foreground"
        style={{ letterSpacing: '-0.02em' }}
      >
        {title}
      </h2>
      <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
    </div>
    <div className="flex-1 space-y-2.5 overflow-y-auto pb-4">{children}</div>
    <div className="flex gap-2 pt-2">{footer}</div>
  </div>
);

// Role-style card with 48px emoji glyph, title, subtitle, optional trailing check.
type GlyphCardProps = {
  emoji: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  onClick: () => void;
};
const GlyphCard: React.FC<GlyphCardProps> = ({ emoji, title, subtitle, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex min-h-[72px] w-full items-center gap-3.5 rounded-[18px] border bg-white p-4 text-left transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      'active:scale-[0.99]',
      selected
        ? 'border-primary shadow-[0_0_0_4px_var(--indigo-soft),0_1px_2px_rgba(14,16,32,0.06)]'
        : 'border-slate-200 shadow-[var(--shadow-s1)] hover:border-slate-300'
    )}
    aria-pressed={selected}
  >
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#F4F5F8] text-[28px] leading-none"
      aria-hidden
    >
      {emoji}
    </span>
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="text-[15px] font-bold leading-tight text-foreground">{title}</span>
      {subtitle && (
        <span className="mt-0.5 text-xs leading-snug text-slate-500">{subtitle}</span>
      )}
    </div>
    {selected && (
      <span
        className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground"
        aria-hidden
      >
        ✓
      </span>
    )}
  </button>
);

// ── Main sheet ───────────────────────────────────────────────────────────────

export const RoleSelectionSheet: React.FC<RoleSelectionSheetProps> = ({ open, onClose }) => {
  const { updatePreference, destinations } = useAppStore((state) => ({
    updatePreference: state.updatePreference,
    destinations: state.destinations,
  }));

  const groupOptions = useMemo(() => getAllGroupOptions(destinations), [destinations]);

  const [step, setStep] = useState<SelectionStep>('role');
  const [selectedRole, setSelectedRole] = useState<VolunteerRole | null>(null);
  const [filterMode, setFilterMode] = useState<PickupFilterMode | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedTimings, setSelectedTimings] = useState<string[]>([]); // Multi-select array

  // Memoize destinations grouped by timing for display (includes custom destinations)
  const destinationsByTiming = useMemo(() => getDestinationsByTiming(destinations), [destinations]);

  // Design always shows 3 progress pills — step count is fixed, not branch-dependent.
  // Non-pickup roles complete at step 1, but we still render the 3-pill indicator so
  // the eyebrow ("STEP 1 OF 3") and the pill row match the design comp visually.
  const totalSteps = 3;

  const handleRoleSelectTap = (roleId: VolunteerRole) => {
    setSelectedRole(roleId);
  };

  const handleRoleContinue = () => {
    if (!selectedRole) return;
    if (selectedRole === 'pickupOnly') {
      setStep('pickupFilter');
    } else {
      saveAndClose(selectedRole);
    }
  };

  const handleFilterModeSelect = (mode: PickupFilterMode) => {
    setFilterMode(mode);
  };

  const handleFilterContinue = () => {
    if (!filterMode) return;
    if (filterMode === 'groups') {
      setStep('pickupGroups');
    } else {
      setStep('pickupTiming');
    }
  };

  const handleGroupToggle = (groupKey: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupKey) ? prev.filter((k) => k !== groupKey) : [...prev, groupKey]
    );
  };

  // Multi-select timing toggle
  const handleTimingToggle = (timing: string) => {
    setSelectedTimings((prev) =>
      prev.includes(timing) ? prev.filter((t) => t !== timing) : [...prev, timing]
    );
  };

  const saveAndClose = (role: VolunteerRole) => {
    // Save role
    updatePreference('role', role);
    updatePreference('hasCompletedRoleSetup', true);

    // Save pickup-specific preferences if applicable
    if (role === 'pickupOnly' && filterMode) {
      updatePreference('pickupFilterMode', filterMode);
      if (filterMode === 'groups' && selectedGroups.length > 0) {
        updatePreference('selectedGroups', selectedGroups);
      }
      if (filterMode === 'timing' && selectedTimings.length > 0) {
        updatePreference('selectedTiming', selectedTimings); // Now an array
      }
    }

    // Reset state and close
    setStep('role');
    setSelectedRole(null);
    setFilterMode(null);
    setSelectedGroups([]);
    setSelectedTimings([]);
    onClose();
  };

  const handleBack = () => {
    if (step === 'pickupFilter') {
      setStep('role');
      // Keep selectedRole — lets the user see their previous choice highlighted.
    } else if (step === 'pickupGroups' || step === 'pickupTiming') {
      setStep('pickupFilter');
      setFilterMode(null);
      setSelectedGroups([]);
      setSelectedTimings([]);
    }
  };

  const canFinish =
    step === 'pickupGroups'
      ? selectedGroups.length > 0
      : step === 'pickupTiming'
        ? selectedTimings.length > 0 // Multi-select: at least one timing selected
        : false;

  const handleFinish = () => {
    if (selectedRole) {
      saveAndClose(selectedRole);
    }
  };

  // ── Step bodies ───────────────────────────────────────────────────────────

  const renderRoleStep = () => (
    <StepFrame
      total={totalSteps}
      current={1}
      title="What brings you in today?"
      subtitle="You can change this any time from Quick Actions."
      footer={
        // Per design: step 1 has a single full-width primary. Skip/back live elsewhere
        // (header close button, keyboard). `size="lg"` now renders 52px height.
        <Button
          size="lg"
          onClick={handleRoleContinue}
          disabled={!selectedRole}
          className="flex-1"
        >
          Continue
        </Button>
      }
    >
      {ROLE_OPTIONS.map((option) => (
        <GlyphCard
          key={option.id}
          emoji={option.emoji}
          title={option.name}
          subtitle={option.description}
          selected={selectedRole === option.id}
          onClick={() => handleRoleSelectTap(option.id)}
        />
      ))}
    </StepFrame>
  );

  const renderFilterStep = () => (
    <StepFrame
      total={totalSteps}
      current={2}
      title="How do you want to filter?"
      subtitle="Makes your Pickup tab just the right amount of full."
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={handleBack}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            size="lg"
            onClick={handleFilterContinue}
            disabled={!filterMode}
            className="flex-1"
          >
            Continue
          </Button>
        </>
      }
    >
      {FILTER_OPTIONS.map((option) => (
        <GlyphCard
          key={option.id}
          emoji={option.emoji}
          title={option.name}
          subtitle={option.description}
          selected={filterMode === option.id}
          onClick={() => handleFilterModeSelect(option.id)}
        />
      ))}
    </StepFrame>
  );

  const renderGroupsStep = () => (
    <StepFrame
      total={totalSteps}
      current={3}
      title="Which co-op's yours?"
      subtitle="Pick one or more."
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={handleBack}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            size="lg"
            onClick={handleFinish}
            disabled={!canFinish}
            className="flex-1"
          >
            Done
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {groupOptions.map((group, i) => {
          const isSelected = selectedGroups.includes(group.key);
          const swatch = GROUP_SWATCHES[i % GROUP_SWATCHES.length];
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => handleGroupToggle(group.key)}
              className={cn(
                'flex min-h-[72px] flex-col items-start gap-1.5 rounded-2xl border bg-white p-3 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                'active:scale-[0.99]',
                isSelected
                  ? 'border-primary shadow-[0_0_0_4px_var(--indigo-soft),0_1px_2px_rgba(14,16,32,0.06)]'
                  : 'border-slate-200 shadow-[var(--shadow-s1)] hover:border-slate-300'
              )}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  'size-8 rounded-[10px]',
                  swatch
                )}
                aria-hidden
              />
              <span className="text-sm font-bold leading-tight text-foreground">{group.name}</span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {group.timing}
              </span>
            </button>
          );
        })}
      </div>
    </StepFrame>
  );

  const renderTimingStep = () => (
    <StepFrame
      total={totalSteps}
      current={3}
      title="Which shifts are yours?"
      subtitle="Pick one or more timing slots."
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={handleBack}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            size="lg"
            onClick={handleFinish}
            disabled={!canFinish}
            className="flex-1"
          >
            Done
          </Button>
        </>
      }
    >
      {TIMING_SLOTS.map((slot) => {
        const isSelected = selectedTimings.includes(slot.value);
        const destList = destinationsByTiming.get(slot.value) || [];
        return (
          <button
            key={slot.value}
            type="button"
            onClick={() => handleTimingToggle(slot.value)}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border bg-white p-3.5 text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              'active:scale-[0.99]',
              isSelected
                ? 'border-primary shadow-[0_0_0_4px_var(--indigo-soft),0_1px_2px_rgba(14,16,32,0.06)]'
                : 'border-slate-200 shadow-[var(--shadow-s1)] hover:border-slate-300'
            )}
            aria-pressed={isSelected}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-bold leading-tight text-foreground">
                {slot.label}
              </span>
              {destList.length > 0 && (
                <span className="mt-1 truncate text-xs text-slate-500">{destList.join(', ')}</span>
              )}
            </div>
            {isSelected && (
              <span
                className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground"
                aria-hidden
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </StepFrame>
  );

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] gap-0 overflow-hidden rounded-t-[32px] border-t-0 bg-[hsl(var(--background))] p-0 shadow-[0_-28px_90px_rgba(14,16,32,0.16)]"
      >
        <div className="flex justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-slate-300" aria-hidden />
        </div>
        <div className="flex min-h-[520px] flex-col px-5 pb-5 pt-2">
          {step === 'role' && renderRoleStep()}
          {step === 'pickupFilter' && renderFilterStep()}
          {step === 'pickupGroups' && renderGroupsStep()}
          {step === 'pickupTiming' && renderTimingStep()}
        </div>
      </SheetContent>
    </Sheet>
  );
};
