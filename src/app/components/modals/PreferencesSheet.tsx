import React, { useState, useMemo } from 'react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { TimingBadge } from '@/app/components/ui/timing-badge';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { TIMING_SLOTS } from '@/app/utils/roles';
import { getDestinationsByTiming, getAllGroupOptions } from '@/app/utils/timing';
import type { VolunteerRole, PickupFilterMode } from '@/types';

type PreferencesSheetProps = {
  open: boolean;
  onClose: () => void;
};

const ROLE_OPTIONS: Array<{ id: VolunteerRole; emoji: string; label: string; hint: string }> = [
  { id: 'foodBank', emoji: '🌐', label: 'Food Bank', hint: 'Confirm, Storage, partial Pickup' },
  { id: 'pickupOnly', emoji: '🛒', label: 'Pickup', hint: 'Just the Pickup tab, filtered' },
  { id: 'coopDelivery', emoji: '🥕', label: 'Delivery', hint: 'Pickup tab for my route' },
  { id: 'fullAccess', emoji: '🔓', label: 'Full', hint: 'Full access to everything' },
];

export const PreferencesSheet: React.FC<PreferencesSheetProps> = ({ open, onClose }) => {
  const { preferences, updatePreference, destinations } = useAppStore((state) => ({
    preferences: state.preferences,
    updatePreference: state.updatePreference,
    destinations: state.destinations,
  }));

  const groupOptions = useMemo(() => getAllGroupOptions(destinations), [destinations]);

  const [localName, setLocalName] = useState(preferences.volunteerName);
  const [editingName, setEditingName] = useState(false);
  const [editingRole, setEditingRole] = useState(false);

  const destinationsByTiming = useMemo(() => getDestinationsByTiming(destinations), [destinations]);

  const handleSaveName = () => {
    updatePreference('volunteerName', localName);
    toast.success('Volunteer name saved!');
    setEditingName(false);
  };

  const handleToggle = (key: 'autoScroll' | 'compactMode' | 'showShiftTasks', value: boolean) => {
    updatePreference(key, value);
    if (key === 'showShiftTasks') {
      updatePreference('hasSeenShiftTasksIntro', true);
    }
  };

  const handleRoleSelect = (roleId: VolunteerRole) => {
    updatePreference('role', roleId);
    updatePreference('hasCompletedRoleSetup', true);
    if (roleId !== 'pickupOnly') {
      updatePreference('pickupFilterMode', undefined);
      updatePreference('selectedGroups', undefined);
      updatePreference('selectedTiming', undefined);
    }
  };

  const handleFilterModeSelect = (mode: PickupFilterMode) => {
    updatePreference('pickupFilterMode', mode);
    if (mode === 'groups') {
      updatePreference('selectedTiming', undefined);
    } else {
      updatePreference('selectedGroups', undefined);
    }
  };

  const handleGroupToggle = (groupKey: string) => {
    const current = preferences.selectedGroups || [];
    const next = current.includes(groupKey)
      ? current.filter((k) => k !== groupKey)
      : [...current, groupKey];
    updatePreference('selectedGroups', next.length > 0 ? next : undefined);
  };

  const handleTimingToggle = (timing: string) => {
    const current = preferences.selectedTiming || [];
    const next = current.includes(timing)
      ? current.filter((t) => t !== timing)
      : [...current, timing];
    updatePreference('selectedTiming', next.length > 0 ? next : undefined);
  };

  const currentRole = ROLE_OPTIONS.find((r) => r.id === preferences.role);
  const subtitleParts = [
    preferences.volunteerName || 'Volunteer',
    currentRole?.label ?? 'No role',
  ];

  const displayNameValue = preferences.volunteerName || 'Not set';
  const roleValue = currentRole?.label ?? 'Not set';

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] gap-0 overflow-hidden rounded-t-[24px] border-border/70 bg-white p-0 shadow-[0_-28px_90px_rgba(15,23,42,0.18)]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-2" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <SheetHeader className="gap-1 px-5 pb-2 pt-3">
          <SheetTitle className="text-[20px] font-bold leading-tight tracking-[-0.3px] text-foreground">
            Preferences
          </SheetTitle>
          <SheetDescription className="text-[13px] text-muted-foreground">
            {subtitleParts.join(' · ')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-0 overflow-y-auto px-5 pb-4 pt-2">
          {/* Display name row — value › style */}
          <ValueRow
            title="Display name"
            value={displayNameValue}
            expanded={editingName}
            onToggle={() => {
              if (editingName) {
                setLocalName(preferences.volunteerName);
              }
              setEditingName((prev) => !prev);
            }}
          />
          {editingName ? (
            <div className="flex items-center gap-2 pb-3.5">
              <Input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Enter your name"
                autoFocus
                className="h-10 flex-1 rounded-xl"
              />
              <Button
                onClick={handleSaveName}
                disabled={localName === preferences.volunteerName || !localName.trim()}
                size="sm"
                className="h-10 rounded-xl px-4 text-[13px] font-semibold"
              >
                Save
              </Button>
            </div>
          ) : null}

          <div className="h-px bg-slate-100" />

          {/* Role row — value › style */}
          <ValueRow
            title="Role"
            value={roleValue}
            expanded={editingRole}
            onToggle={() => setEditingRole((prev) => !prev)}
          />
          {editingRole ? (
            <div className="pb-3.5">
              <div className="grid grid-cols-4 gap-2">
                {ROLE_OPTIONS.map((option) => {
                  const active = preferences.role === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleRoleSelect(option.id)}
                      className={cn(
                        'flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[14px] border p-2 text-center transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active ? '' : 'border-slate-200 bg-white hover:border-slate-300'
                      )}
                      style={
                        active
                          ? {
                              background: 'var(--indigo-soft)',
                              borderColor: '#C7C1FF',
                              color: 'var(--indigo-deep)',
                            }
                          : undefined
                      }
                    >
                      <span className="text-[22px] leading-none" aria-hidden>
                        {option.emoji}
                      </span>
                      <span className="text-[11px] font-bold">{option.label}</span>
                    </button>
                  );
                })}
              </div>
              {currentRole ? (
                <p className="mt-2 text-[11px] text-muted-foreground">{currentRole.hint}</p>
              ) : null}

              {preferences.role === 'pickupOnly' ? (
                <div
                  className="mt-3 flex flex-col gap-3 rounded-[14px] border p-3"
                  style={{
                    background: 'var(--indigo-soft)',
                    borderColor: '#C7C1FF',
                  }}
                >
                  {(preferences.selectedGroups?.length || preferences.selectedTiming?.length) ? (
                    <div className="rounded-lg bg-white/80 px-2.5 py-1.5 text-[11px]">
                      <span className="font-semibold text-slate-500">Showing: </span>
                      <span className="font-bold" style={{ color: 'var(--indigo-deep)' }}>
                        {preferences.pickupFilterMode === 'groups' && preferences.selectedGroups
                          ? preferences.selectedGroups
                              .map((key) => groupOptions.find((g) => g.key === key)?.name || key)
                              .join(', ')
                          : preferences.pickupFilterMode === 'timing' && preferences.selectedTiming?.length
                            ? preferences.selectedTiming
                                .map((t) => TIMING_SLOTS.find((s) => s.value === t)?.label || t)
                                .join(', ')
                            : 'All groups'}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className="text-[12px] font-semibold"
                    style={{ color: 'var(--indigo-deep)' }}
                  >
                    Filter pickups by:
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleFilterModeSelect('groups')}
                      className={cn(
                        'flex-1 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition-colors',
                        preferences.pickupFilterMode === 'groups'
                          ? 'border-transparent bg-primary text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      )}
                    >
                      Group name
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFilterModeSelect('timing')}
                      className={cn(
                        'flex-1 rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition-colors',
                        preferences.pickupFilterMode === 'timing'
                          ? 'border-transparent bg-primary text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      )}
                    >
                      Timing slot
                    </button>
                  </div>

                  {preferences.pickupFilterMode === 'groups' ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {groupOptions.map((group) => {
                        const isSelected = preferences.selectedGroups?.includes(group.key);
                        return (
                          <button
                            key={group.key}
                            type="button"
                            onClick={() => handleGroupToggle(group.key)}
                            className={cn(
                              'flex flex-col items-start gap-1 rounded-[10px] border px-2.5 py-2 transition-colors',
                              isSelected
                                ? 'border-[#C7C1FF] bg-white'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            )}
                          >
                            <span
                              className={cn(
                                'text-[12px] font-bold',
                                isSelected ? 'text-[#3B33D4]' : 'text-foreground'
                              )}
                            >
                              {group.name}
                            </span>
                            <TimingBadge timing={group.timing} />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {preferences.pickupFilterMode === 'timing' ? (
                    <div className="flex flex-col gap-1.5">
                      {TIMING_SLOTS.map((slot) => {
                        const isSelected = preferences.selectedTiming?.includes(slot.value);
                        const slotDestinations = destinationsByTiming.get(slot.value) || [];
                        return (
                          <button
                            key={slot.value}
                            type="button"
                            onClick={() => handleTimingToggle(slot.value)}
                            className={cn(
                              'flex flex-col gap-0.5 rounded-[10px] border px-3 py-2 text-left transition-colors',
                              isSelected
                                ? 'border-[#C7C1FF] bg-white'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            )}
                          >
                            <span
                              className={cn(
                                'text-[12px] font-bold',
                                isSelected ? 'text-[#3B33D4]' : 'text-foreground'
                              )}
                            >
                              {slot.label}
                            </span>
                            {slotDestinations.length > 0 ? (
                              <span className="text-[10px] text-muted-foreground">
                                {slotDestinations.join(', ')}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                      <p className="text-center text-[10px] text-muted-foreground">
                        Select one or more timing slots
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="h-px bg-slate-100" />

          {/* Reading eyebrow */}
          <div className="pb-2 pt-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Reading
          </div>

          <ToggleRow
            title="Auto-scroll to current"
            hint="After 'Pack All', jump to the next incomplete section"
            checked={preferences.autoScroll}
            onChange={(v) => handleToggle('autoScroll', v)}
          />
          <ToggleRow
            title="Compact mode"
            hint="Tighter spacing for dense lists"
            checked={preferences.compactMode}
            onChange={(v) => handleToggle('compactMode', v)}
          />

          {/* Shift eyebrow */}
          <div className="pb-2 pt-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Shift
          </div>

          <ToggleRow
            title="Shift task reminders"
            hint="Cleanup, lights, defrost check in the Pickup tab"
            checked={preferences.showShiftTasks ?? false}
            onChange={(v) => handleToggle('showShiftTasks', v)}
            last
          />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-white px-5 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-12 w-full rounded-xl text-[15px] font-semibold"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

type ValueRowProps = {
  title: string;
  value: string;
  expanded: boolean;
  onToggle: () => void;
};

const ValueRow: React.FC<ValueRowProps> = ({ title, value, expanded, onToggle }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center py-3.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      aria-expanded={expanded}
    >
      <div className="flex-1 pr-3">
        <div className="text-[15px] font-semibold text-foreground">{title}</div>
      </div>
      <div className="flex items-center gap-1 text-[14px] text-muted-foreground">
        <span>{value}</span>
        <span
          aria-hidden
          className="inline-block text-[14px] leading-none transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ›
        </span>
      </div>
    </button>
  );
};

type ToggleRowProps = {
  title: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  last?: boolean;
};

const ToggleRow: React.FC<ToggleRowProps> = ({ title, hint, checked, onChange, last }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center py-3.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !last && 'border-b border-slate-100'
      )}
    >
      <div className="flex-1 pr-3">
        <div className="text-[15px] font-semibold text-foreground">{title}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
      </div>
      <Toggle on={checked} />
    </button>
  );
};

const Toggle: React.FC<{ on: boolean }> = ({ on }) => (
  <div
    aria-hidden
    className="relative h-[26px] w-[44px] rounded-full p-[2px] transition-colors"
    style={{
      background: on ? '#0F7A4F' : '#CBD0DB',
      boxShadow: 'inset 0 1px 2px rgba(14,16,32,0.1)',
    }}
  >
    <div
      className="h-[22px] w-[22px] rounded-full bg-white transition-transform"
      style={{
        transform: on ? 'translateX(18px)' : 'translateX(0)',
        boxShadow: 'var(--shadow-s1)',
      }}
    />
  </div>
);
