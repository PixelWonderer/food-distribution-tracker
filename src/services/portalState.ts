import { create } from 'zustand';
import type {
  PortalState,
  OutreachLogEntry,
  NudgeItem,
  CoverageRequest,
  NewOutreachLogEntry,
  NewCoverageRequest,
  ContactType,
} from '@/types/portal';
import {
  fetchRoster,
  fetchOutreachLog,
  postOutreachEntry,
  fetchCoverageRequests,
  upsertCoverageRequest,
  fetchCookCrews,
} from './portalApi';

export interface PersonRef {
  name: string;
  contact_type: ContactType;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PortalActions {
  fetchAll: () => Promise<void>;
  logTouch: (entry: NewOutreachLogEntry) => Promise<void>;
  upsertCoverage: (req: CoverageRequest | NewCoverageRequest) => Promise<void>;
  openPerson: (ref: PersonRef) => void;
  closePerson: () => void;
  openLogTouchModal: (prefill?: Partial<NewOutreachLogEntry>) => void;
  closeLogTouchModal: () => void;
}

interface PortalUIState {
  selectedPerson: PersonRef | null;
  logTouchPrefill: Partial<NewOutreachLogEntry> | null;
  logTouchOpen: boolean;
}

type PortalStore = PortalState & PortalActions & PortalUIState;

export const usePortalStore = create<PortalStore>((set) => ({
  // Initial state
  roster: null,
  outreachLog: [],
  coverageRequests: [],
  cookCrews: {},
  loading: false,
  error: null,

  // UI state
  selectedPerson: null,
  logTouchPrefill: null,
  logTouchOpen: false,

  openPerson: (ref) => set({ selectedPerson: ref }),
  closePerson: () => set({ selectedPerson: null }),
  openLogTouchModal: (prefill) => set({ logTouchOpen: true, logTouchPrefill: prefill ?? null }),
  closeLogTouchModal: () => set({ logTouchOpen: false, logTouchPrefill: null }),

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [roster, outreachLog, coverageRequests, cookCrews] = await Promise.all([
        fetchRoster(),
        fetchOutreachLog(),
        fetchCoverageRequests(),
        fetchCookCrews(),
      ]);
      set({ roster, outreachLog, coverageRequests, cookCrews, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load portal data';
      set({ error: message, loading: false });
    }
  },

  logTouch: async (entry: NewOutreachLogEntry) => {
    await postOutreachEntry(entry);
    const outreachLog = await fetchOutreachLog();
    set({ outreachLog });
  },

  upsertCoverage: async (req: CoverageRequest | NewCoverageRequest) => {
    await upsertCoverageRequest(req);
    const coverageRequests = await fetchCoverageRequests();
    set({ coverageRequests });
  },
}));

// ─── Derived selectors ────────────────────────────────────────────────────────

const TODAY = (): string => new Date().toISOString().slice(0, 10);

export function selectMostRecentTouchByContact(
  state: PortalState,
): Map<string, OutreachLogEntry> {
  const map = new Map<string, OutreachLogEntry>();
  for (const entry of state.outreachLog) {
    const existing = map.get(entry.contact_name);
    if (!existing || entry.touch_date > existing.touch_date) {
      map.set(entry.contact_name, entry);
    }
  }
  return map;
}

/**
 * Items whose `next_touch_date` is in the past, today, or within the next
 * NUDGE_HORIZON_DAYS days. Sorted most-overdue first, then due-today, then
 * upcoming. Returning a slightly wider window than "due today" makes the
 * Today view useful day-1 instead of a ghost town.
 */
export const NUDGE_HORIZON_DAYS = 3;

export function selectNudgesDueToday(state: PortalState): NudgeItem[] {
  const today = TODAY();
  const mostRecent = selectMostRecentTouchByContact(state);

  const nudges: NudgeItem[] = [];
  for (const [, entry] of mostRecent) {
    if (!entry.next_touch_date) continue;
    const daysOverdue = daysBetween(entry.next_touch_date, today);
    nudges.push({
      contact_name: entry.contact_name,
      contact_type: entry.contact_type,
      days_overdue: daysOverdue,
      next_touch_action: entry.next_touch_action,
      last_touch_summary: entry.summary,
      last_touch_date: entry.touch_date,
      last_touch_channel: entry.channel,
      source_log_id: entry.id,
    });
  }

  return nudges
    .filter((n) => n.days_overdue >= -NUDGE_HORIZON_DAYS)
    .sort((a, b) => b.days_overdue - a.days_overdue);
}

export function selectOpenCoverage(state: PortalState): CoverageRequest[] {
  const PRIORITY_RANK: Record<string, number> = { high: 2, medium: 1, low: 0 };

  return state.coverageRequests
    .filter((r) => r.status === 'open' || r.status === 'in-progress')
    .sort((a, b) => {
      // Primary: shift_date asc (nulls last)
      if (a.shift_date !== b.shift_date) {
        if (a.shift_date === null) return 1;
        if (b.shift_date === null) return -1;
        if (a.shift_date < b.shift_date) return -1;
        if (a.shift_date > b.shift_date) return 1;
      }
      // Secondary: priority desc
      return (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24));
}
