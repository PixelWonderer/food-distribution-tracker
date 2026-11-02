/**
 * Timing utilities for auto-detecting the current distribution time slot
 * based on the actual clock time.
 *
 * Distribution schedule:
 * - Friday AM (before noon)
 * - Friday PM (noon onwards)
 * - Saturday AM (before noon) - for Partner Group 9 delivery
 * - Saturday noon (noon to 2pm)
 * - Saturday PM (2pm onwards)
 * - Sunday (all day)
 */

export type TimingSlot = 'friday am' | 'friday pm' | 'saturday am' | 'saturday noon' | 'saturday pm' | 'sunday' | null;

/**
 * Get the current timing slot based on actual clock time.
 * Returns null on non-distribution days (Mon-Thu).
 */
export function getCurrentTimingSlot(date: Date = new Date()): TimingSlot {
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const hour = date.getHours();

  switch (day) {
    case 5: // Friday
      return hour < 12 ? 'friday am' : 'friday pm';

    case 6: // Saturday
      if (hour < 12) return 'saturday am';
      return hour < 14 ? 'saturday noon' : 'saturday pm';

    case 0: // Sunday
      return 'sunday';

    default:
      // Mon-Thu: no active distribution slot
      return null;
  }
}

/**
 * Get the display label for a timing slot.
 */
export function getTimingSlotLabel(slot: TimingSlot): string {
  switch (slot) {
    case 'friday am':
      return 'Friday AM';
    case 'friday pm':
      return 'Friday PM';
    case 'saturday am':
      return 'Saturday AM';
    case 'saturday noon':
      return 'Saturday Noon';
    case 'saturday pm':
      return 'Saturday PM';
    case 'sunday':
      return 'Sunday';
    default:
      return 'All';
  }
}

/**
 * Normalize timing strings to lowercase for comparison.
 * Handles variations like "Friday AM", "friday am", "Friday am", etc.
 */
export function normalizeTimingString(timing: string): string {
  return timing.toLowerCase().trim();
}

/**
 * Check if a group's timing matches the given slot.
 * Handles case-insensitive comparison.
 */
export function timingMatchesSlot(groupTiming: string, slot: TimingSlot): boolean {
  if (!slot) return true; // No slot = show all
  return normalizeTimingString(groupTiming) === slot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timing Display Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intentional color tokens for each timing slot. Each slot has a bg / border / text
 * triplet plus a dot accent used for the leading pill dot and progress fills.
 * These are wayfinding, not decoration — the Pickup tab's primary cue.
 */
export type TimingTone = {
  bg: string;
  border: string;
  text: string;
  dot: string;
};

export const TIMING_TONES: Record<string, TimingTone> = {
  'friday am':     { bg: '#E4EEFF', border: '#BBD1FF', text: '#1E4BAE', dot: '#3E70E0' },
  'friday noon':   { bg: '#E6E5FF', border: '#C5C3FF', text: '#3B33D4', dot: '#4F46FF' },
  'friday pm':     { bg: '#E6E5FF', border: '#C5C3FF', text: '#3B33D4', dot: '#4F46FF' },
  'saturday am':   { bg: '#DFF6F2', border: '#A6E3D8', text: '#0F6E64', dot: '#14B8A6' },
  'saturday noon': { bg: '#DBF5E5', border: '#9FE3BC', text: '#096D3A', dot: '#10A152' },
  'saturday pm':   { bg: '#FFEFD1', border: '#FAD48A', text: '#8A5A0A', dot: '#D97706' },
  sunday:          { bg: '#FFE0E6', border: '#FBC1CE', text: '#A11538', dot: '#E11D48' },
  'monday am':     { bg: '#EDE7FF', border: '#D6CCFF', text: '#5B3FB8', dot: '#8B5CF6' },
};

const UNKNOWN_TONE: TimingTone = {
  bg: '#F6F7FA',
  border: '#E2E5EC',
  text: '#6B6F82',
  dot: '#9498A8',
};

/**
 * Get the full tone object (bg/border/text/dot) for a timing slot.
 */
export function getTimingTone(timing: string | undefined | null): TimingTone {
  if (!timing) return UNKNOWN_TONE;
  const key = normalizeTimingString(timing);
  return TIMING_TONES[key] ?? UNKNOWN_TONE;
}

/**
 * Legacy className helper — kept for existing callers that rely on Tailwind
 * utilities. Returns a neutral outline shell; colors are applied via inline
 * style by components that call getTimingTone() directly (new path).
 */
export function getTimingClasses(_timing: string | undefined | null): string {
  return 'border';
}

/**
 * Inline style helper — the preferred path for new code.
 */
export function getTimingStyle(timing: string | undefined | null): {
  background: string;
  borderColor: string;
  color: string;
} {
  const tone = getTimingTone(timing);
  return { background: tone.bg, borderColor: tone.border, color: tone.text };
}

/**
 * Deprecated — retained for type compatibility during migration.
 */
export const TIMING_TONE_CLASSES: Record<string, string> = Object.fromEntries(
  Object.keys(TIMING_TONES).map((k) => [k, 'border'])
);

/**
 * Abbreviate timing for compact display.
 * Examples: "Friday AM" → "Fri. AM", "Saturday noon" → "Sat. Noon"
 */
export function abbreviateTiming(value: string | null | undefined): string {
  if (!value) return 'All';
  const normalized = value.trim();
  if (!normalized) return 'All';
  if (normalized.toLowerCase() === 'partner group 7') {
    return 'Partner Group 7';
  }
  const [dayRaw, partRaw = ''] = normalized.split(/\s+/);
  const dayBase = dayRaw.slice(0, 3);
  const day = `${dayBase.charAt(0).toUpperCase()}${dayBase.slice(1).toLowerCase()}.`;
  const part = partRaw
    ? partRaw.toLowerCase() === 'noon'
      ? 'Noon'
      : partRaw.toUpperCase()
    : '';
  return `${day} ${part}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Timing Grouping Utilities
// ─────────────────────────────────────────────────────────────────────────────

import { GROUPS } from '@/utils/constants';
import type { DestinationInfo } from '@/types';

/**
 * Get destinations grouped by their timing slot.
 * Includes custom Supabase destinations when provided.
 * Returns a Map where keys are normalized timing strings and values are arrays of destination names.
 */
export function getDestinationsByTiming(
  dynamicDestinations?: DestinationInfo[]
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  Object.values(GROUPS).forEach((group) => {
    const timingKey = normalizeTimingString(group.timing);
    const existing = result.get(timingKey) || [];
    existing.push(group.name);
    result.set(timingKey, existing);
  });

  // Add custom destinations not already in static GROUPS
  const staticCodes = new Set(Object.keys(GROUPS));
  if (dynamicDestinations && dynamicDestinations.length > 0) {
    dynamicDestinations
      .filter(
        (dest) =>
          dest.isCustom === true &&
          dest.isActive !== false &&
          dest.code !== 'surplus' &&
          !staticCodes.has(dest.code)
      )
      .forEach((dest) => {
        if (dest.timing) {
          const timingKey = normalizeTimingString(dest.timing);
          const existing = result.get(timingKey) || [];
          existing.push(dest.name);
          result.set(timingKey, existing);
        }
      });
  }

  return result;
}

/**
 * Build a merged list of group options from static GROUPS config
 * and dynamic custom destinations from Supabase.
 * Custom destinations whose code matches a static GROUPS key are skipped
 * to avoid duplicates (e.g., Partner Group 9 and Partner Group 8 exist in both).
 * Custom destinations use `custom-{id}` key format to match buildPickupGroups().
 */
export function getAllGroupOptions(
  dynamicDestinations?: DestinationInfo[]
): Array<{ key: string; name: string; timing: string }> {
  const options = Object.entries(GROUPS).map(([key, group]) => ({
    key,
    name: group.name,
    timing: group.timing,
  }));

  const staticKeys = new Set(Object.keys(GROUPS));

  if (dynamicDestinations && dynamicDestinations.length > 0) {
    dynamicDestinations
      .filter(
        (dest) =>
          dest.isCustom === true &&
          dest.isActive !== false &&
          dest.code !== 'surplus' &&
          !staticKeys.has(dest.code)
      )
      .forEach((dest) => {
        options.push({
          key: `custom-${dest.id}`,
          name: dest.name,
          timing: dest.timing || 'Unscheduled',
        });
      });
  }

  return options;
}
