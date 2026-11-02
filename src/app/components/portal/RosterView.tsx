import React, { useState, useMemo } from 'react';
import { usePortalStore, selectMostRecentTouchByContact } from '@/services/portalState';
import type { Volunteer } from '@/types/portal';
import { shiftColor, cookHouseColor } from '@/services/portalColors';
import type { ColorScheme } from '@/services/portalColors';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'name-az' | 'touch-newest' | 'touch-oldest' | 'shift';
type CrewFilter = 'all' | 'recurring' | 'distro' | 'cooks';

interface AugmentedVolunteer extends Volunteer {
  _primaryCrew: string;
  _groupLabel: string;
  _color: ColorScheme;
}

// ─── Neutral ink scheme (distro-lines) ───────────────────────────────────────

const INK_SCHEME: ColorScheme = {
  bar: '#1a1410',
  tint: 'rgba(26,20,16,0.04)',
  text: '#1a1410',
  label: '—',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY_STR = new Date().toISOString().slice(0, 10);

function daysAgo(dateStr: string): number {
  const fromMs = new Date(dateStr + 'T12:00:00').getTime();
  const toMs = new Date(TODAY_STR + 'T12:00:00').getTime();
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

function formatTouchDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysAgoLabel(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return '1d ago';
  return `${n}d ago`;
}

// Distro chat name → short display label
function chatShortLabel(chatName: string): string {
  const lower = chatName.toLowerCase();
  if (lower.includes('uc anytown') || lower.includes('ucb')) return 'UCB';
  if (lower.includes('bhs')) return 'BHS';
  if (lower.includes('sunday')) return 'SUN CHAT';
  if (lower.includes('occasional')) return 'OCC';
  if (lower.includes('monthly')) return 'MONTHLY';
  // Fallback: first word up to 8 chars
  return chatName.split(/\s+/)[0].toUpperCase().slice(0, 8);
}

// ─── Flatten roster into AugmentedVolunteer[] ────────────────────────────────

function flattenRoster(
  activeRecurring: Volunteer[],
  activeDistroByChat: Record<string, Volunteer[]>,
  activeCooks: Record<string, Volunteer[]>,
): AugmentedVolunteer[] {
  const result: AugmentedVolunteer[] = [];

  for (const v of activeRecurring) {
    const shift = v.shifts[0] ?? '';
    const color = shiftColor(shift);
    result.push({
      ...v,
      _primaryCrew: shift || 'recurring',
      _groupLabel: color.label,
      _color: color,
    });
  }

  for (const [chatName, volunteers] of Object.entries(activeDistroByChat)) {
    for (const v of volunteers) {
      result.push({
        ...v,
        _primaryCrew: 'distro-lines',
        _groupLabel: chatShortLabel(chatName),
        _color: INK_SCHEME,
      });
    }
  }

  for (const [houseSlug, volunteers] of Object.entries(activeCooks)) {
    const color = cookHouseColor(houseSlug);
    for (const v of volunteers) {
      result.push({
        ...v,
        _primaryCrew: `cook-${houseSlug}`,
        _groupLabel: color.label,
        _color: color,
      });
    }
  }

  return result;
}

// ─── Crew chip ────────────────────────────────────────────────────────────────

function CrewChip({ label, color }: { label: string; color: ColorScheme }) {
  const isNeutral = color === INK_SCHEME || color.bar === '#1a1410';
  return (
    <span
      className="inline-block px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
      style={{
        backgroundColor: isNeutral ? '#1a1410' : color.bar,
        color: '#f4e9cf',
      }}
    >
      {label}
    </span>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1 font-body text-[11px] font-semibold border border-ink/20 transition-colors"
      style={{
        backgroundColor: active ? '#1a1410' : 'transparent',
        color: active ? '#f4e9cf' : '#1a1410',
      }}
    >
      {label}
      {count !== undefined && (
        <span
          className="font-normal opacity-60"
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortKey)}
      className="font-mono text-[11px] px-2 py-1 border border-ink/20 bg-paper text-ink appearance-none cursor-pointer"
      style={{ outline: 'none' }}
    >
      <option value="name-az">Name A–Z</option>
      <option value="touch-newest">Last touch: newest</option>
      <option value="touch-oldest">Last touch: oldest</option>
      <option value="shift">Group by crew</option>
    </select>
  );
}

// ─── Roster row ───────────────────────────────────────────────────────────────

function RosterRow({
  vol,
  touchDate,
  isAlternate,
  onLogTouch,
  onOpenPerson,
}: {
  vol: AugmentedVolunteer;
  touchDate: string | null;
  isAlternate: boolean;
  onLogTouch: (name: string) => void;
  onOpenPerson: (name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const rowBg = isAlternate
    ? 'rgba(236,223,190,0.35)'
    : vol._color.tint;

  const daysN = touchDate ? daysAgo(touchDate) : null;

  return (
    <li
      className="relative flex items-stretch min-h-[50px] group"
      style={{
        boxShadow: `inset 4px 0 0 ${vol._color.bar}`,
        backgroundColor: rowBg,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Desktop layout */}
      <div className="hidden sm:grid w-full pl-3 pr-3 py-2.5 items-center gap-x-3"
        style={{ gridTemplateColumns: '180px 80px 80px 140px 1fr auto' }}
      >
        {/* Name */}
        <button
          className="text-left font-body font-semibold text-[14px] truncate transition-colors"
          style={{ color: hovered ? '#3c2a5e' : '#1a1410' }}
          onClick={() => onOpenPerson(vol.name)}
          title={vol.name}
        >
          {vol.name}
        </button>

        {/* Crew chip */}
        <div>
          <CrewChip label={vol._groupLabel} color={vol._color} />
        </div>

        {/* Pronouns */}
        <span className="font-body text-[12px] italic" style={{ color: 'rgba(26,20,16,0.55)' }}>
          {vol.pronouns ?? '—'}
        </span>

        {/* Last touch */}
        <div className="font-mono">
          {touchDate ? (
            <span className="flex flex-col gap-0">
              <span className="text-[11px]" style={{ color: '#1a1410' }}>{formatTouchDate(touchDate)}</span>
              <span className="text-[10px]" style={{ color: 'rgba(26,20,16,0.55)' }}>
                {daysAgoLabel(daysN!)}
              </span>
            </span>
          ) : (
            <span className="text-[11px]" style={{ color: 'rgba(26,20,16,0.45)' }}>—</span>
          )}
        </div>

        {/* Notes */}
        <p
          className="font-body text-[13px] truncate"
          style={{ color: 'rgba(26,20,16,0.60)' }}
          title={vol.notes}
        >
          {vol.notes || ''}
        </p>

        {/* Log touch button — only on hover */}
        <div className="flex items-center" style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.1s' }}>
          <button
            onClick={() => onLogTouch(vol.name)}
            className="font-body font-semibold text-[11px] px-2 py-1 whitespace-nowrap"
            style={{ backgroundColor: '#1a1410', color: '#f4e9cf' }}
          >
            Log touch
          </button>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden w-full pl-3 pr-3 py-2.5 flex flex-col gap-1">
        <div className="flex items-center gap-2 justify-between">
          <button
            className="font-body font-semibold text-[14px] truncate"
            style={{ color: '#1a1410' }}
            onClick={() => onOpenPerson(vol.name)}
          >
            {vol.name}
          </button>
          <CrewChip label={vol._groupLabel} color={vol._color} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {vol.pronouns && (
            <span className="font-body text-[11px] italic" style={{ color: 'rgba(26,20,16,0.55)' }}>
              {vol.pronouns}
            </span>
          )}
          {touchDate && (
            <span className="font-mono text-[10px]" style={{ color: 'rgba(26,20,16,0.55)' }}>
              {formatTouchDate(touchDate)} · {daysAgoLabel(daysN!)}
            </span>
          )}
        </div>
        {vol.notes && (
          <p className="font-body text-[12px] truncate" style={{ color: 'rgba(26,20,16,0.60)' }}>
            {vol.notes}
          </p>
        )}
        <button
          onClick={() => onLogTouch(vol.name)}
          className="self-start font-body font-semibold text-[11px] px-2 py-0.5 mt-0.5"
          style={{ backgroundColor: '#1a1410', color: '#f4e9cf' }}
        >
          Log touch
        </button>
      </div>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const SHIFT_FILTER_OPTIONS = [
  { key: 'friday-distro', label: 'Fri' },
  { key: 'saturday-distro', label: 'Sat' },
  { key: 'saturday-evening', label: 'Sat-eve' },
  { key: 'sunday-distro', label: 'Sun' },
  { key: 'thursday-produce-market', label: 'Thu' },
] as const;

const COOK_FILTER_OPTIONS = [
  { key: 'coop_c', label: 'Co-op C' },
  { key: 'coop_a', label: 'Co-op A' },
  { key: 'coop_b', label: 'Co-op B' },
  { key: 'outside', label: 'Outside' },
] as const;

const RosterView: React.FC = () => {
  const roster = usePortalStore((s) => s.roster);
  const openPersonFn = usePortalStore((s) => s.openPerson);
  const openLogTouchModal = usePortalStore((s) => s.openLogTouchModal);
  const mostRecentTouches = usePortalStore((s) => selectMostRecentTouchByContact(s));

  const [search, setSearch] = useState('');
  const [crewFilter, setCrewFilter] = useState<CrewFilter>('all');
  const [shiftFilters, setShiftFilters] = useState<Set<string>>(new Set());
  const [cookFilters, setCookFilters] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('name-az');

  // Flatten all three sources once
  const allVolunteers = useMemo<AugmentedVolunteer[]>(() => {
    if (!roster) return [];
    return flattenRoster(
      roster.active_recurring,
      roster.active_distro_by_chat,
      roster.active_cooks,
    );
  }, [roster]);

  // Crew-type counts (before search filter, for chip counts)
  const crewCounts = useMemo(() => {
    const recurring = allVolunteers.filter((v) => v.crew_type === 'recurring_shift').length;
    const distro = allVolunteers.filter((v) => v.crew_type === 'distro_lines').length;
    const cooks = allVolunteers.filter((v) => v.crew_type === 'cook').length;
    return { all: allVolunteers.length, recurring, distro, cooks };
  }, [allVolunteers]);

  // Filter + sort
  const filtered = useMemo<AugmentedVolunteer[]>(() => {
    let result = allVolunteers;

    // Crew filter
    if (crewFilter === 'recurring') {
      result = result.filter((v) => v.crew_type === 'recurring_shift');
    } else if (crewFilter === 'distro') {
      result = result.filter((v) => v.crew_type === 'distro_lines');
    } else if (crewFilter === 'cooks') {
      result = result.filter((v) => v.crew_type === 'cook');
    }

    // Shift sub-filter (only relevant for recurring or all)
    if (shiftFilters.size > 0 && (crewFilter === 'recurring' || crewFilter === 'all')) {
      result = result.filter(
        (v) =>
          v.crew_type !== 'recurring_shift' ||
          v.shifts.some((s) => shiftFilters.has(s)),
      );
    }

    // Cook house sub-filter
    if (cookFilters.size > 0 && (crewFilter === 'cooks' || crewFilter === 'all')) {
      result = result.filter(
        (v) =>
          v.crew_type !== 'cook' ||
          cookFilters.has(v._primaryCrew.replace('cook-', '')),
      );
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((v) => v.name.toLowerCase().includes(q));
    }

    // Sort
    if (sortKey === 'name-az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortKey === 'touch-newest') {
      result = [...result].sort((a, b) => {
        const at = mostRecentTouches.get(a.name)?.touch_date ?? '';
        const bt = mostRecentTouches.get(b.name)?.touch_date ?? '';
        return bt.localeCompare(at);
      });
    } else if (sortKey === 'touch-oldest') {
      result = [...result].sort((a, b) => {
        const at = mostRecentTouches.get(a.name)?.touch_date ?? '';
        const bt = mostRecentTouches.get(b.name)?.touch_date ?? '';
        return at.localeCompare(bt);
      });
    } else if (sortKey === 'shift') {
      result = [...result].sort((a, b) => {
        if (a._primaryCrew === b._primaryCrew) return a.name.localeCompare(b.name);
        return a._primaryCrew.localeCompare(b._primaryCrew);
      });
    }

    return result;
  }, [allVolunteers, crewFilter, shiftFilters, cookFilters, search, sortKey, mostRecentTouches]);

  const toggleShift = (key: string) => {
    setShiftFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCook = (key: string) => {
    setCookFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLogTouch = (name: string) => {
    openLogTouchModal({ contact_name: name, contact_type: 'active', direction: 'outbound' });
  };

  const handleOpenPerson = (name: string) => {
    openPersonFn({ name, contact_type: 'active' });
  };

  // Loading state
  if (roster === null) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <p className="font-mono text-[13px] italic" style={{ color: 'rgba(26,20,16,0.60)' }}>
          Loading roster…
        </p>
      </div>
    );
  }

  const showCount = filtered.length !== allVolunteers.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] mb-1" style={{ color: 'rgba(26,20,16,0.45)' }}>
            /portal/roster
          </p>
          <h1 className="font-body font-bold text-[28px] leading-none" style={{ color: '#1a1410' }}>
            Roster
          </h1>
        </div>
        <div className="font-mono text-[13px]" style={{ color: 'rgba(26,20,16,0.55)' }}>
          {showCount ? `${filtered.length}/${allVolunteers.length}` : allVolunteers.length}
        </div>
      </div>

      {/* Toolbar */}
      <div className="space-y-2 border-b border-ink/10 pb-3">
        {/* Row 1: search + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="font-body text-[13px] px-2.5 py-1 border border-ink/20 bg-paper text-ink placeholder-ink/35 flex-1 min-w-[180px]"
            style={{ outline: 'none' }}
          />
          <SortSelect value={sortKey} onChange={setSortKey} />
        </div>

        {/* Row 2: crew-type filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="All"
            active={crewFilter === 'all'}
            count={crewCounts.all}
            onClick={() => setCrewFilter('all')}
          />
          <FilterChip
            label="Recurring shift"
            active={crewFilter === 'recurring'}
            count={crewCounts.recurring}
            onClick={() => setCrewFilter('recurring')}
          />
          <FilterChip
            label="Distro lines"
            active={crewFilter === 'distro'}
            count={crewCounts.distro}
            onClick={() => setCrewFilter('distro')}
          />
          <FilterChip
            label="Cooks"
            active={crewFilter === 'cooks'}
            count={crewCounts.cooks}
            onClick={() => setCrewFilter('cooks')}
          />
        </div>

        {/* Row 3: shift sub-filters (shown when recurring or all) */}
        {(crewFilter === 'recurring' || crewFilter === 'all') && (
          <div className="flex flex-wrap gap-1.5">
            {SHIFT_FILTER_OPTIONS.map(({ key, label }) => (
              <FilterChip
                key={key}
                label={label}
                active={shiftFilters.has(key)}
                onClick={() => toggleShift(key)}
              />
            ))}
          </div>
        )}

        {/* Row 4: cook house sub-filters (shown when cooks or all) */}
        {(crewFilter === 'cooks' || crewFilter === 'all') && (
          <div className="flex flex-wrap gap-1.5">
            {COOK_FILTER_OPTIONS.map(({ key, label }) => (
              <FilterChip
                key={key}
                label={label}
                active={cookFilters.has(key)}
                onClick={() => toggleCook(key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-ink/15">
        {/* Header row (desktop only) */}
        <div
          className="hidden sm:grid px-3 py-2 border-b border-ink/15 bg-paperDeep"
          style={{ gridTemplateColumns: '180px 80px 80px 140px 1fr auto' }}
        >
          {['Name', 'Crew', 'Pronouns', 'Last touch', 'Notes', ''].map((col, i) => (
            <span
              key={i}
              className="font-body font-semibold text-[11px] uppercase tracking-wide"
              style={{ color: 'rgba(26,20,16,0.55)' }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-mono text-[13px] italic" style={{ color: 'rgba(26,20,16,0.60)' }}>
              No volunteers match.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink/10">
            {filtered.map((vol, idx) => {
              const prevCrew = idx > 0 ? filtered[idx - 1]._primaryCrew : null;
              const sameCrewAsPrev = vol._primaryCrew === prevCrew;
              const isAlternate = sameCrewAsPrev && idx % 2 === 1;
              const touch = mostRecentTouches.get(vol.name);
              return (
                <RosterRow
                  key={vol.name}
                  vol={vol}
                  touchDate={touch?.touch_date ?? null}
                  isAlternate={isAlternate}
                  onLogTouch={handleLogTouch}
                  onOpenPerson={handleOpenPerson}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RosterView;
