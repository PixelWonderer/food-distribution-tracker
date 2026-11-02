/**
 * Portal color tokens — shift type, cook house, pipeline status.
 *
 * Color is structural: encodes information visually so the eye can scan
 * a roster/pipeline/coverage view without reading every row.
 *
 * Hex values match the tokens in tailwind.config.js.
 */

import type { PipelineStatus } from '@/types/portal';

export interface ColorScheme {
  bar: string;   // left-edge stripe color
  tint: string;  // background tint (semi-transparent)
  text: string;  // accent text color
  label: string; // short uppercase display label
  fg?: string;   // foreground text when bar is bg
  bg?: string;   // background fill (for filled badges)
}

const INK_NEUTRAL: ColorScheme = {
  bar: '#1a1410',
  tint: 'rgba(26,20,16,0.04)',
  text: '#1a1410',
  label: '—',
};

// ─── Shift type (for active recurring volunteers) ─────────────────────────────

export const SHIFT_COLORS: Record<string, ColorScheme> = {
  'friday-distro': {
    bar: '#3c2a5e',
    tint: 'rgba(60,42,94,0.07)',
    text: '#3c2a5e',
    label: 'FRI',
  },
  'saturday-distro': {
    bar: '#c44a1f',
    tint: 'rgba(196,74,31,0.07)',
    text: '#a93f17',
    label: 'SAT',
  },
  'saturday-evening': {
    bar: '#e4a532',
    tint: 'rgba(228,165,50,0.09)',
    text: '#5a3e10',
    label: 'SAT-EVE',
  },
  'sunday-distro': {
    bar: '#4a6a32',
    tint: 'rgba(74,106,50,0.07)',
    text: '#3f5a2b',
    label: 'SUN',
  },
  'thursday-produce-market': {
    bar: '#86807a',
    tint: 'rgba(26,20,16,0.04)',
    text: '#1a1410',
    label: 'THU',
  },
};

export function shiftColor(shift: string): ColorScheme {
  return SHIFT_COLORS[shift] ?? INK_NEUTRAL;
}

export function shiftLabel(shift: string): string {
  return SHIFT_COLORS[shift]?.label ?? shift.toUpperCase();
}

// ─── Cook house ──────────────────────────────────────────────────────────────

export const COOK_HOUSE_COLORS: Record<string, ColorScheme> = {
  coop_c: {
    bar: '#c44a1f',
    tint: 'rgba(196,74,31,0.07)',
    text: '#a93f17',
    label: 'CO-C',
  },
  coop_a: {
    bar: '#4a6a32',
    tint: 'rgba(74,106,50,0.07)',
    text: '#3f5a2b',
    label: 'CO-A',
  },
  coop_b: {
    bar: '#3c2a5e',
    tint: 'rgba(60,42,94,0.07)',
    text: '#3c2a5e',
    label: 'CO-B',
  },
  outside: {
    bar: '#86807a',
    tint: 'rgba(26,20,16,0.04)',
    text: '#1a1410',
    label: 'OUTSIDE',
  },
};

export function cookHouseColor(house: string): ColorScheme {
  return COOK_HOUSE_COLORS[house.toLowerCase()] ?? INK_NEUTRAL;
}

// ─── Pipeline status ─────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<PipelineStatus, ColorScheme> = {
  New: {
    bar: '#86807a',
    tint: 'rgba(26,20,16,0.04)',
    text: '#1a1410',
    label: 'NEW',
    fg: '#1a1410',
    bg: '#ecdfbe',
  },
  'Reached out': {
    bar: '#e4a532',
    tint: 'rgba(228,165,50,0.10)',
    text: '#5a3e10',
    label: 'REACHED OUT',
    fg: '#5a3e10',
    bg: '#fbe9c1',
  },
  Met: {
    bar: '#c44a1f',
    tint: 'rgba(196,74,31,0.08)',
    text: '#a93f17',
    label: 'MET',
    fg: '#fff5e9',
    bg: '#c44a1f',
  },
  'Met (via 3rd party)': {
    bar: '#c44a1f',
    tint: 'rgba(196,74,31,0.08)',
    text: '#a93f17',
    label: 'MET (3RD)',
    fg: '#fff5e9',
    bg: '#c44a1f',
  },
  Committed: {
    bar: '#4a6a32',
    tint: 'rgba(74,106,50,0.10)',
    text: '#3f5a2b',
    label: 'COMMITTED',
    fg: '#eaf2dd',
    bg: '#4a6a32',
  },
};

export function statusColor(status: PipelineStatus | string): ColorScheme {
  return STATUS_COLORS[status as PipelineStatus] ?? STATUS_COLORS['New'];
}

// ─── Urgency (for Today nudges) ──────────────────────────────────────────────

export interface UrgencyColor {
  bar: string;
  tint: string;
  text: string;
  badge: string; // e.g. "3 days overdue", "due today", "in 2 days"
}

export function urgencyForDays(daysOverdue: number): UrgencyColor {
  if (daysOverdue > 0) {
    return {
      bar: '#b8351e',
      tint: 'rgba(184,53,30,0.07)',
      text: '#b8351e',
      badge: daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`,
    };
  }
  if (daysOverdue === 0) {
    return {
      bar: '#e4a532',
      tint: 'rgba(228,165,50,0.09)',
      text: '#5a3e10',
      badge: 'due today',
    };
  }
  // future
  const inDays = -daysOverdue;
  return {
    bar: '#86807a',
    tint: 'rgba(26,20,16,0.025)',
    text: '#1a1410',
    badge: inDays === 1 ? 'tomorrow' : `in ${inDays} days`,
  };
}

// ─── Channel display ─────────────────────────────────────────────────────────

export const CHANNEL_LABEL: Record<string, string> = {
  IG: 'IG',
  text: 'text',
  email: 'email',
  'in-person': 'in person',
  'voice-memo': 'voice memo',
  'third-party': '3rd party',
  phone: 'phone',
};
