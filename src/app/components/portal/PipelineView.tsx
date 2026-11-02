import React, { useMemo, useState } from 'react';
import { usePortalStore } from '@/services/portalState';
import { statusColor, CHANNEL_LABEL } from '@/services/portalColors';
import type { PipelineContact, PipelineStatus, OutreachChannel } from '@/types/portal';

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

const ALL_STATUSES: PipelineStatus[] = [
  'New',
  'Reached out',
  'Met',
  'Met (via 3rd party)',
  'Committed',
];

type SortKey = 'name' | 'last_touch' | 'status';

const STATUS_RANK: Record<PipelineStatus, number> = {
  Committed: 0,
  Met: 1,
  'Met (via 3rd party)': 2,
  'Reached out': 3,
  New: 4,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDueOrOverdue(nextTouchDate: string | null | undefined): boolean {
  if (!nextTouchDate) return false;
  // "due today + 1" per spec: next_touch_date <= today + 1 day
  const cutoff = new Date(TODAY);
  cutoff.setDate(cutoff.getDate() + 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return nextTouchDate <= cutoffStr;
}

function formatDate(dateStr: string): string {
  // Accepts YYYY-MM-DD, returns "May 14"
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PipelineStatus | string }) {
  const sc = statusColor(status);
  return (
    <span
      className="font-body uppercase text-[10px] tracking-[0.10em] px-1.5 py-[1px] border"
      style={{
        background: sc.bg ?? sc.tint,
        color: sc.fg ?? sc.text,
        borderColor: 'rgba(26,20,16,0.18)',
      }}
    >
      {sc.label}
    </span>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColHeader({
  label,
  sortable,
  active,
  dir,
  onClick,
  className = '',
}: {
  label: string;
  sortable?: boolean;
  active?: boolean;
  dir?: 'asc' | 'desc';
  onClick?: () => void;
  className?: string;
}) {
  const base =
    'font-body font-semibold text-[11px] uppercase tracking-wide text-ink/55 select-none';
  if (sortable && onClick) {
    return (
      <button
        onClick={onClick}
        className={`${base} flex items-center gap-1 hover:text-ink/80 transition-colors ${className}`}
      >
        {label}
        {active && <span className="text-[9px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    );
  }
  return <span className={`${base} ${className}`}>{label}</span>;
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-body text-[11px] font-semibold px-2.5 py-1 border transition-colors whitespace-nowrap ${
        active
          ? 'bg-ink text-paper border-ink'
          : 'text-ink/60 border-ink/15 hover:border-ink/30 hover:text-ink/80'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1.5 font-mono text-[10px] ${active ? 'text-paper/70' : 'text-ink/40'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Pipeline row ─────────────────────────────────────────────────────────────

interface RowData {
  contact: PipelineContact;
  lastTouchDate: string | null;
  lastTouchChannel: OutreachChannel | null;
  lastTouchDateRaw: string | null; // for sorting
}

function PipelineRow({ data, index }: { data: RowData; index: number }) {
  const { contact, lastTouchDate, lastTouchChannel } = data;
  const sc = statusColor(contact.status);
  const { openPerson, openLogTouchModal } = usePortalStore();

  // Status tint is always applied (status colors do the visual grouping, per spec)
  void index;

  return (
    <li
      className="flex flex-col sm:flex-row sm:items-center gap-y-2 sm:gap-y-0 py-3 px-3 sm:px-4 relative"
      style={{
        boxShadow: `inset 4px 0 0 ${sc.bar}`,
        background: sc.tint,
      }}
    >
      {/* Mobile layout */}
      <div className="flex flex-col gap-1 sm:hidden w-full">
        <div className="flex items-center gap-2 justify-between">
          <button
            onClick={() => openPerson({ name: contact.name, contact_type: 'pipeline' })}
            className="font-body font-semibold text-[14px] text-ink hover:text-purple-ink transition-colors text-left"
          >
            {contact.name}
          </button>
          <StatusBadge status={contact.status} />
        </div>
        {contact.days_role && (
          <p className="font-body text-[13px] text-ink/75 truncate">{contact.days_role}</p>
        )}
        <div className="flex items-center gap-2 justify-between">
          <span className="font-mono text-[11px] text-ink/55">
            {lastTouchDate ? (
              <>
                {lastTouchDate}
                {lastTouchChannel && (
                  <span className="ml-1 text-[10px]">· {CHANNEL_LABEL[lastTouchChannel] ?? lastTouchChannel}</span>
                )}
              </>
            ) : contact.last_touch ? (
              contact.last_touch
            ) : (
              '—'
            )}
          </span>
          <button
            onClick={() =>
              openLogTouchModal({
                contact_name: contact.name,
                contact_type: 'pipeline',
                channel: lastTouchChannel ?? 'IG',
                direction: 'outbound',
              })
            }
            className="font-body font-semibold text-[11px] bg-ink text-paper px-2 py-1 hover:bg-purple-ink transition-colors shrink-0"
          >
            Log touch
          </button>
        </div>
        {contact.notes && (
          <p className="font-body text-[13px] text-ink/60 truncate">{contact.notes}</p>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1.2fr_1.5fr_2fr_auto] sm:items-center sm:gap-x-4 w-full">
        {/* Name */}
        <button
          onClick={() => openPerson({ name: contact.name, contact_type: 'pipeline' })}
          className="font-body font-semibold text-[14px] text-ink hover:text-purple-ink transition-colors text-left truncate"
        >
          {contact.name}
        </button>

        {/* Status */}
        <div>
          <StatusBadge status={contact.status} />
        </div>

        {/* Last touch */}
        <div className="min-w-0">
          {lastTouchDate ? (
            <>
              <p className="font-mono text-[11px] text-ink">{lastTouchDate}</p>
              {lastTouchChannel && (
                <p className="font-mono text-[10px] text-ink/55">
                  {CHANNEL_LABEL[lastTouchChannel] ?? lastTouchChannel}
                </p>
              )}
            </>
          ) : contact.last_touch ? (
            <p className="font-mono text-[11px] text-ink/70">{contact.last_touch}</p>
          ) : (
            <span className="font-mono text-[11px] text-ink/35">—</span>
          )}
        </div>

        {/* Days/role */}
        <p className="font-body text-[13px] text-ink/75 truncate">{contact.days_role ?? '—'}</p>

        {/* Notes */}
        <p className="font-body text-[13px] text-ink/60 truncate">{contact.notes || '—'}</p>

        {/* Actions */}
        <button
          onClick={() =>
            openLogTouchModal({
              contact_name: contact.name,
              contact_type: 'pipeline',
              channel: lastTouchChannel ?? 'IG',
              direction: 'outbound',
            })
          }
          className="font-body font-semibold text-[11px] bg-ink text-paper px-2 py-1 hover:bg-purple-ink transition-colors whitespace-nowrap shrink-0"
        >
          Log touch
        </button>
      </div>
    </li>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const PipelineView: React.FC = () => {
  const roster = usePortalStore((s) => s.roster);
  const outreachLog = usePortalStore((s) => s.outreachLog);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | 'All'>('All');
  const [dueOnly, setDueOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('last_touch');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Build most-recent touch map from store state
  const touchMap = useMemo(() => {
    const map = new Map<string, { date: string; channel: OutreachChannel; nextTouch: string | null }>();
    for (const entry of outreachLog) {
      const existing = map.get(entry.contact_name);
      if (!existing || entry.touch_date > existing.date) {
        map.set(entry.contact_name, {
          date: entry.touch_date,
          channel: entry.channel,
          nextTouch: entry.next_touch_date,
        });
      }
    }
    return map;
  }, [outreachLog]);

  // Status counts across ALL contacts (before filter, after search)
  const pipeline = roster?.pipeline ?? [];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: pipeline.length };
    for (const s of ALL_STATUSES) counts[s] = 0;
    for (const c of pipeline) {
      if (counts[c.status] !== undefined) counts[c.status]++;
      else counts[c.status] = 1;
    }
    return counts;
  }, [pipeline]);

  // Filtered + sorted rows
  const rows = useMemo<RowData[]>(() => {
    const needle = search.toLowerCase().trim();

    let filtered = pipeline.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      if (statusFilter !== 'All' && c.status !== statusFilter) return false;
      if (dueOnly) {
        const touch = touchMap.get(c.name);
        if (!isDueOrOverdue(touch?.nextTouch)) return false;
      }
      return true;
    });

    // Annotate with touch data
    const annotated: RowData[] = filtered.map((c) => {
      const touch = touchMap.get(c.name);
      return {
        contact: c,
        lastTouchDate: touch ? formatDate(touch.date) : null,
        lastTouchChannel: touch?.channel ?? null,
        lastTouchDateRaw: touch?.date ?? null,
      };
    });

    // Sort
    annotated.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.contact.name.localeCompare(b.contact.name);
      } else if (sortKey === 'last_touch') {
        const ad = a.lastTouchDateRaw ?? '0000-00-00';
        const bd = b.lastTouchDateRaw ?? '0000-00-00';
        cmp = ad < bd ? -1 : ad > bd ? 1 : 0;
      } else if (sortKey === 'status') {
        const ar = STATUS_RANK[a.contact.status as PipelineStatus] ?? 99;
        const br = STATUS_RANK[b.contact.status as PipelineStatus] ?? 99;
        cmp = ar - br;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return annotated;
  }, [pipeline, search, statusFilter, dueOnly, sortKey, sortDir, touchMap]);

  // Sort toggle helper
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'last_touch' ? 'desc' : 'asc');
    }
  }

  // Loading state
  if (roster === null) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <p className="font-mono text-[13px] italic text-ink/60">Loading…</p>
      </div>
    );
  }

  const isFiltered = search.trim() !== '' || statusFilter !== 'All' || dueOnly;
  const total = pipeline.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] text-ink/45 mb-1">/portal/pipeline</p>
          <h1 className="font-body font-bold text-[28px] text-ink leading-none">Pipeline</h1>
        </div>
        {isFiltered && (
          <span className="font-mono text-[12px] text-ink/55 shrink-0">
            {rows.length} of {total}
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search by name…"
          className="font-body text-[13px] text-ink placeholder:text-ink/35 bg-paper border border-ink/20 px-3 py-1.5 focus:outline-none focus:border-ink/50 w-48"
        />

        {/* Status chips */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="All"
            count={statusCounts['All']}
            active={statusFilter === 'All'}
            onClick={() => setStatusFilter('All')}
          />
          {ALL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              label={statusColor(s).label}
              count={statusCounts[s] ?? 0}
              active={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)}
            />
          ))}
        </div>

        {/* Due/overdue toggle */}
        <button
          onClick={() => setDueOnly((v) => !v)}
          className={`font-body text-[11px] font-semibold px-2.5 py-1 border transition-colors whitespace-nowrap ${
            dueOnly
              ? 'bg-amberPortal text-ink border-amberPortal/60'
              : 'text-ink/60 border-ink/15 hover:border-ink/30 hover:text-ink/80'
          }`}
        >
          Due / overdue
        </button>

        {/* Sort */}
        <select
          value={`${sortKey}:${sortDir}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
            setSortKey(k);
            setSortDir(d);
          }}
          className="font-body text-[12px] text-ink bg-paper border border-ink/20 px-2 py-1.5 focus:outline-none focus:border-ink/50"
        >
          <option value="last_touch:desc">Last touch ↓</option>
          <option value="last_touch:asc">Last touch ↑</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
          <option value="status:asc">Status</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-ink/15">
        {/* Desktop header row */}
        <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1.2fr_1.5fr_2fr_auto] sm:gap-x-4 px-4 py-2 border-b border-ink/15">
          <ColHeader
            label="Name"
            sortable
            active={sortKey === 'name'}
            dir={sortDir}
            onClick={() => handleSort('name')}
          />
          <ColHeader
            label="Status"
            sortable
            active={sortKey === 'status'}
            dir={sortDir}
            onClick={() => handleSort('status')}
          />
          <ColHeader
            label="Last touch"
            sortable
            active={sortKey === 'last_touch'}
            dir={sortDir}
            onClick={() => handleSort('last_touch')}
          />
          <ColHeader label="Days/role" />
          <ColHeader label="Notes" />
          <ColHeader label="Actions" />
        </div>

        {/* Body */}
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="font-mono text-[13px] italic text-ink/60">No contacts match.</p>
          </div>
        ) : (
          <ul className="divide-y divide-ink/10">
            {rows.map((data, i) => (
              <PipelineRow key={data.contact.name} data={data} index={i} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PipelineView;
