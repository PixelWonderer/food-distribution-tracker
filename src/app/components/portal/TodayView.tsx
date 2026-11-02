import React from 'react';
import {
  MessageCircle,
  Mail,
  Instagram,
  Phone,
  User,
  Mic,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePortalStore,
  selectNudgesDueToday,
  selectOpenCoverage,
} from '@/services/portalState';
import { urgencyForDays, shiftColor } from '@/services/portalColors';
import type { NudgeItem, CoverageRequest, OutreachChannel, Volunteer } from '@/types/portal';
import { toast } from '@/lib/toast';

// ─── Channel icons ────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<OutreachChannel, React.ReactNode> = {
  IG:            <Instagram className="w-3.5 h-3.5" />,
  text:          <MessageCircle className="w-3.5 h-3.5" />,
  email:         <Mail className="w-3.5 h-3.5" />,
  'in-person':   <User className="w-3.5 h-3.5" />,
  phone:         <Phone className="w-3.5 h-3.5" />,
  'voice-memo':  <Mic className="w-3.5 h-3.5" />,
  'third-party': <MessageCircle className="w-3.5 h-3.5" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "SAT MAY 23" — uppercase, no comma */
function formatShiftDateBig(date: string | null): string {
  if (!date) return 'ONGOING';
  const d = new Date(date + 'T12:00:00');
  return d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()
    .replace(',', '');
}

/** "Sun · May 17 · 2026" */
function formatPageDate(d: Date): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month   = d.toLocaleDateString('en-US', { month: 'short' });
  const day     = d.getDate();
  const year    = d.getFullYear();
  return `${weekday} · ${month} ${day} · ${year}`;
}

// ─── Kicker ───────────────────────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
      {children}
    </span>
  );
}

// ─── Counter pill ─────────────────────────────────────────────────────────────

function CounterPill({
  label,
  value,
  sub,
  subUrgent,
}: {
  label: string;
  value: number;
  sub?: string;
  subUrgent?: boolean;
}) {
  return (
    <div className="flex flex-col items-end sm:items-center min-w-[72px]">
      <Kicker>{label}</Kicker>
      <span className="font-display font-bold text-[22px] text-ink leading-none mt-0.5">
        {value}
      </span>
      {sub && (
        <span
          className={cn(
            'font-mono text-[10px] mt-0.5',
            subUrgent ? 'text-brick' : 'text-moss',
          )}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  kicker,
  title,
  count,
  right,
}: {
  kicker: string;
  title: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div className="flex items-baseline gap-3">
        <Kicker>{kicker}</Kicker>
        <h2 className="font-display font-bold text-[20px] text-ink tracking-tight">
          {title}
          {count !== undefined && (
            <span className="ml-1.5 font-mono text-[13px] font-normal text-ink/45">
              ({count})
            </span>
          )}
        </h2>
      </div>
      {right}
    </div>
  );
}

// ─── Section 1: Nudge row ─────────────────────────────────────────────────────

function NudgeRow({
  nudge,
  index,
}: {
  nudge: NudgeItem;
  index: number;
}) {
  const urg = urgencyForDays(nudge.days_overdue);
  const isOverdue = nudge.days_overdue > 0;
  const rowBg = isOverdue
    ? urg.tint
    : index % 2 === 1
    ? 'rgba(236,223,190,0.45)' // paperDeep-ish zebra
    : 'transparent';

  const handleRowClick = () => {
    usePortalStore.getState().openPerson({
      name: nudge.contact_name,
      contact_type: nudge.contact_type,
    });
  };

  const handleLogTouch = (e: React.MouseEvent) => {
    e.stopPropagation();
    usePortalStore.getState().openLogTouchModal({
      contact_name: nudge.contact_name,
      contact_type: nudge.contact_type,
    });
  };

  return (
    <div
      className="relative flex items-center gap-3 px-4 py-3.5 cursor-pointer group min-h-[60px]"
      style={{
        boxShadow: `inset 4px 0 0 ${urg.bar}`,
        backgroundColor: rowBg,
      }}
      onClick={handleRowClick}
    >
      {/* Channel icon */}
      <span className="shrink-0 text-ink/40 group-hover:text-ink/70 transition-colors">
        {CHANNEL_ICON[nudge.last_touch_channel]}
      </span>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-body font-semibold text-[14px] text-ink truncate">
            {nudge.contact_name}
          </span>
          {/* Urgency badge */}
          <span
            className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 leading-none"
            style={{ color: urg.text, backgroundColor: urg.tint, border: `1px solid ${urg.bar}40` }}
          >
            {urg.badge}
          </span>
        </div>
        {nudge.next_touch_action && (
          <p className="font-mono text-[11px] italic text-ink/65 truncate mt-0.5">
            {nudge.next_touch_action}
          </p>
        )}
      </div>

      {/* Log touch button */}
      <button
        onClick={handleLogTouch}
        className={cn(
          'shrink-0 font-body font-semibold text-[12px] px-2.5 py-1 transition-colors',
          isOverdue ? 'bg-brick text-paper hover:bg-sprayDeep' : 'bg-ink text-paper hover:bg-ink/80',
        )}
      >
        Log touch
      </button>
    </div>
  );
}

// ─── Section 2: Coverage card ─────────────────────────────────────────────────

function CoverageCard({ req }: { req: CoverageRequest }) {
  const { upsertCoverage } = usePortalStore();
  const isHot = req.priority === 'high' && req.candidates.length === 0;
  const isFilled = req.status === 'filled';

  const handleAddCandidate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = window.prompt('Add candidate name:');
    if (!name?.trim()) return;
    try {
      await upsertCoverage({ ...req, candidates: [...req.candidates, name.trim()] });
      toast.success('Candidate added');
    } catch {
      toast.error('Failed to add candidate');
    }
  };

  const handleMarkFilled = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const filler = window.prompt(`Who filled this shift? (${req.shift_label})`);
    if (filler === null) return;
    try {
      await upsertCoverage({ ...req, status: 'filled', filled_by: filler.trim() || null });
      toast.success('Coverage marked filled ✓');
    } catch {
      toast.error('Failed to update coverage');
    }
  };

  return (
    <div className="bg-paper border border-ink/15 flex flex-col overflow-hidden">
      {/* Top tab */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1.5',
          isHot ? 'bg-brick text-paper' : 'bg-ink text-paper',
        )}
      >
        <Kicker>
          <span className="text-paper/70">{req.shift_type.toUpperCase()}</span>
        </Kicker>
        {isHot && (
          <span className="font-mono text-[10px] font-bold text-paper/90 tracking-widest">
            ! HOT
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-3 flex-1 flex flex-col gap-2">
        {/* Date */}
        <p className="font-display font-bold text-[22px] text-ink uppercase tracking-tight leading-none">
          {formatShiftDateBig(req.shift_date)}
        </p>

        {/* Assignee + reason */}
        <p className="font-mono text-[11px]">
          <span className="text-ink">Out: {req.original_assignee}</span>
          {req.reason && (
            <span className="text-ink/55"> — {req.reason}</span>
          )}
        </p>

        {/* Candidates */}
        <div>
          <Kicker>Candidates</Kicker>
          {req.candidates.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {req.candidates.map((c) => (
                <span
                  key={c}
                  className="bg-paperDeep border border-ink/15 px-1.5 py-[1px] text-[12px] font-body text-ink"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="font-mono text-[11px] italic text-brick mt-1">
              no candidates — ask around
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-3 py-2 border-t border-ink/10">
        <button
          onClick={handleAddCandidate}
          className="font-body text-[12px] text-ink/55 hover:text-ink transition-colors"
        >
          + add candidate
        </button>
        <button
          onClick={handleMarkFilled}
          className={cn(
            'font-body font-semibold text-[12px] px-2.5 py-1 transition-colors',
            isFilled
              ? 'bg-paperDeep text-ink border border-ink/15'
              : 'bg-spray text-paper hover:bg-sprayDeep',
          )}
        >
          {isFilled ? 'Filled ✓' : 'Mark filled'}
        </button>
      </div>
    </div>
  );
}

// ─── Section 3: This week's shifts ───────────────────────────────────────────

const SHIFT_DAYS: { key: string; dayLabel: string }[] = [
  { key: 'thursday-produce-market', dayLabel: 'Thursday' },
  { key: 'friday-distro',        dayLabel: 'Friday' },
  { key: 'saturday-distro',      dayLabel: 'Saturday' },
  { key: 'saturday-evening',     dayLabel: 'Saturday Eve' },
  { key: 'sunday-distro',        dayLabel: 'Sunday' },
];

function groupByPrimaryShift(volunteers: Volunteer[]): Map<string, Volunteer[]> {
  const map = new Map<string, Volunteer[]>();
  for (const v of volunteers) {
    if (!v.shifts.length) continue;
    const key = v.shifts[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(v);
  }
  return map;
}

function WeeklyShifts({ volunteers }: { volunteers: Volunteer[] }) {
  const byShift = groupByPrimaryShift(volunteers);

  const rows = SHIFT_DAYS.map(({ key, dayLabel }) => ({
    key,
    dayLabel,
    color: shiftColor(key),
    volunteers: byShift.get(key) ?? [],
  })).filter((r) => r.volunteers.length > 0);

  if (rows.length === 0) {
    return (
      <p className="font-mono text-[12px] text-ink/45 italic">
        No recurring shift assignments in roster.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map(({ key, dayLabel, color, volunteers: vols }) => (
        <div key={key} className="bg-paper border border-ink/15 overflow-hidden">
          {/* Day header */}
          <div className="bg-ink text-paper flex items-center justify-between px-3 py-1.5">
            <span className="font-display font-bold text-[15px] uppercase">{dayLabel}</span>
            <span className="font-mono text-[10px] text-paper/55">{color.label}</span>
          </div>
          {/* Names */}
          <div
            className="px-3 py-2.5"
            style={{ boxShadow: `inset 4px 0 0 ${color.bar}` }}
          >
            <div className="flex flex-col gap-1.5 pl-1">
              {vols.map((v) => (
                <div key={v.name} className="flex items-center gap-1.5">
                  <CheckCircle2
                    className="w-3 h-3 shrink-0"
                    style={{ color: '#4a6a32' /* moss */ }}
                  />
                  <span className="font-body text-[14px] text-ink">{v.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const TodayView: React.FC = () => {
  const store = usePortalStore();
  const { roster, loading, error } = store;

  const nudges = selectNudgesDueToday(store);
  const openCoverage = selectOpenCoverage(store);

  // Derived counters
  const overdueCount = nudges.filter((n) => n.days_overdue > 0).length;
  const hotCount = openCoverage.filter(
    (r) => r.priority === 'high' && r.candidates.length === 0,
  ).length;
  const crewCount = roster?.active_recurring.length ?? 0;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-mono text-[12px] text-ink/45">Loading portal data…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div
          className="border border-brick/40 px-4 py-3 font-mono text-[12px] text-brick"
          style={{ boxShadow: 'inset 4px 0 0 #b8351e' }}
        >
          <strong className="font-semibold">Failed to load portal data.</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-10">

      {/* ── Top band ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Left: title + date */}
        <div>
          <h1 className="font-display font-bold text-[28px] text-ink leading-none tracking-tight">
            Community Portal
          </h1>
          <p className="font-mono text-[12px] text-ink/55 mt-1">
            {formatPageDate(new Date())}
          </p>
        </div>

        {/* Right: counter pills */}
        <div className="flex items-start gap-6 sm:gap-8">
          <CounterPill
            label="Nudges"
            value={nudges.length}
            sub={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
            subUrgent={overdueCount > 0}
          />
          <CounterPill
            label="Open shifts"
            value={openCoverage.length}
            sub={hotCount > 0 ? `${hotCount} hot` : undefined}
            subUrgent={hotCount > 0}
          />
          <CounterPill
            label="Crew this wknd"
            value={crewCount}
            sub="bodies"
            subUrgent={false}
          />
        </div>
      </div>

      {/* ── Section 1: Nudge today ────────────────────────────────────────── */}
      <section>
        <SectionHeader
          kicker="01 · outreach"
          title="Nudge today"
          count={nudges.length}
          right={
            overdueCount > 0 ? (
              <span className="font-mono text-[11px] text-brick">
                {overdueCount} overdue
              </span>
            ) : undefined
          }
        />

        {nudges.length === 0 ? (
          <div className="border border-ink/15 px-4 py-6 font-mono text-[12px] text-ink/60 italic text-center">
            ✅ All caught up — nothing in the next 3 days.
          </div>
        ) : (
          <div className="border border-ink/15 divide-y divide-ink/10">
            {nudges.map((n, i) => (
              <NudgeRow key={n.source_log_id} nudge={n} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Open coverage ──────────────────────────────────────── */}
      <section>
        <SectionHeader
          kicker="02 · 4 weeks out"
          title="Open coverage"
          count={openCoverage.length}
        />

        {openCoverage.length === 0 ? (
          <div className="border border-ink/15 px-4 py-6 font-mono text-[12px] text-ink/60 italic text-center">
            ✅ No open coverage gaps.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {openCoverage.map((req) => (
              <CoverageCard key={req.id} req={req} />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: This week's shifts ─────────────────────────────────── */}
      <section>
        <SectionHeader
          kicker="03 · confirmed"
          title="This week's shifts"
          right={
            <span className="font-mono text-[11px] text-ink/40">read-only</span>
          }
        />

        {roster ? (
          <WeeklyShifts volunteers={roster.active_recurring} />
        ) : (
          <p className="font-mono text-[12px] text-ink/45 italic">Roster not loaded.</p>
        )}
      </section>
    </div>
  );
};

export default TodayView;
