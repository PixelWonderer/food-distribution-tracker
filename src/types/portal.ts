/**
 * Portal — types for the localhost-only volunteer coordination feature.
 *
 * The portal extends FoodTracker with three views: /portal (Today), /portal/roster,
 * /portal/pipeline. It reads tracker.md (the canonical narrative roster) plus three
 * structured supplements (outreach-log.json, coverage-requests.json, cook-crews.json)
 * living in demo-data/volunteers/ (fake demo data).
 *
 * Data flows: Vite middleware (vite-plugins/portal-api.ts) reads/writes the local
 * files and exposes a small API. The Zustand store (services/portalState.ts) fetches
 * via portalApi.ts. Views select from the store.
 *
 * No Supabase. No cloud. No auth. Localhost only.
 */

// ─── Outreach log ─────────────────────────────────────────────────────────────

export type OutreachChannel =
  | 'IG'
  | 'text'
  | 'email'
  | 'in-person'
  | 'voice-memo'
  | 'third-party'
  | 'phone';

export type OutreachDirection = 'outbound' | 'inbound';
export type ContactType = 'pipeline' | 'active' | 'partner_org' | 'lapsed';

export interface OutreachLogEntry {
  id: string;
  contact_name: string;
  contact_type: ContactType;
  touch_date: string; // YYYY-MM-DD
  channel: OutreachChannel;
  direction: OutreachDirection;
  summary: string;
  next_touch_date: string | null; // YYYY-MM-DD or null (no follow-up planned)
  next_touch_action: string;
  logged_at: string; // ISO timestamp
}

export interface NewOutreachLogEntry {
  contact_name: string;
  contact_type: ContactType;
  touch_date: string;
  channel: OutreachChannel;
  direction: OutreachDirection;
  summary: string;
  next_touch_date: string | null;
  next_touch_action: string;
}

// ─── Coverage requests ────────────────────────────────────────────────────────

export type CoverageStatus = 'open' | 'in-progress' | 'filled' | 'covered-by-lead';
export type CoveragePriority = 'high' | 'medium' | 'low';

export interface CoverageRequest {
  id: string;
  shift_date: string | null; // YYYY-MM-DD or null (for floating/monitoring)
  shift_type: string;
  shift_label: string;
  original_assignee: string;
  reason: string;
  status: CoverageStatus;
  candidates: string[];
  filled_by: string | null;
  priority: CoveragePriority;
  notes: string;
  created_at: string;
  last_updated: string;
}

export interface NewCoverageRequest {
  shift_date: string | null;
  shift_type: string;
  shift_label: string;
  original_assignee: string;
  reason: string;
  status?: CoverageStatus;
  candidates?: string[];
  priority?: CoveragePriority;
  notes?: string;
}

// ─── Roster (parsed from tracker.md) ──────────────────────────────────────────

export type CrewType =
  | 'recurring_shift'
  | 'distro_lines'
  | 'cook'
  | 'pipeline'
  | 'lapsed'
  | 'occasional';

export type PipelineStatus =
  | 'New'
  | 'Reached out'
  | 'Met'
  | 'Committed'
  | 'Met (via 3rd party)';

export interface Volunteer {
  name: string;
  pronouns: string | null;
  contact: string | null; // raw cell text from tracker.md
  tenure: string | null;
  access: string | null;
  shifts: string[]; // e.g. ['friday-distro', 'thursday-produce-market']
  group_chat: string | null;
  notes: string;
  crew_type: CrewType;
}

export interface PipelineContact {
  name: string;
  pronouns: string | null;
  contact: string | null;
  source: string | null;
  days_role: string | null;
  status: PipelineStatus;
  last_touch: string | null; // raw "YYYY-MM-DD (channel)" string from tracker
  notes: string;
}

export interface LapsedEntry {
  name: string;
  reason: string;
  last_touch: string | null;
}

export interface Roster {
  active_recurring: Volunteer[];
  active_distro_by_chat: Record<string, Volunteer[]>;
  active_cooks: Record<string, Volunteer[]>; // keyed by house slug: 'coop_c' | 'coop_a' | 'coop_b' | 'outside'
  pipeline: PipelineContact[];
  lapsed: LapsedEntry[];
  follow_ups_markdown: string; // raw markdown of the "Open follow-ups" section
  parsed_at: string; // ISO timestamp
}

// ─── Cook crews (manual JSON, not parsed) ─────────────────────────────────────

export interface CookCrewContact {
  name: string;
  role: string;
  status: string;
  notes: string;
}

export interface CookCrewPartnerOrg {
  name: string;
  description: string;
  interest: string;
  primary_contact: string;
}

export interface CookCrew {
  name: string;
  current_lead: string | null;
  lead_status: string | null;
  summer_lead: string | null;
  summer_lead_notes: string | null;
  fall_lead: string | null;
  fall_lead_notes: string | null;
  additional_contacts: CookCrewContact[];
  partner_orgs: CookCrewPartnerOrg[];
  handoff_strategy: string;
  summer_plan: string;
  open_questions: string[];
  last_updated: string;
}

// ─── Portal store state ───────────────────────────────────────────────────────

export interface PortalState {
  roster: Roster | null;
  outreachLog: OutreachLogEntry[];
  coverageRequests: CoverageRequest[];
  cookCrews: Record<string, CookCrew>;
  loading: boolean;
  error: string | null;
}

// ─── Derived view models ──────────────────────────────────────────────────────

export interface NudgeItem {
  contact_name: string;
  contact_type: ContactType;
  days_overdue: number; // 0 = due today, positive = overdue, negative = future
  next_touch_action: string;
  last_touch_summary: string;
  last_touch_date: string;
  last_touch_channel: OutreachChannel;
  source_log_id: string;
}

// ─── API contract ─────────────────────────────────────────────────────────────
// GET  /api/portal/roster        → Roster
// GET  /api/portal/outreach      → OutreachLogEntry[]
// POST /api/portal/outreach      body: NewOutreachLogEntry → { entry: OutreachLogEntry, all: OutreachLogEntry[] }
// GET  /api/portal/coverage      → CoverageRequest[]
// POST /api/portal/coverage      body: NewCoverageRequest | CoverageRequest (upsert) → { request: CoverageRequest, all: CoverageRequest[] }
// GET  /api/portal/cook-crews    → Record<string, CookCrew>
