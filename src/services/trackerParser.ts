/**
 * trackerParser.ts
 *
 * Reads tracker.md (plain markdown with pipe-delimited tables) and returns a
 * structured Roster.  Uses only Node built-ins — no external markdown library.
 */

import { readFile } from 'fs/promises';
import type {
  Roster,
  Volunteer,
  PipelineContact,
  LapsedEntry,
  CrewType,
  PipelineStatus,
} from '../types/portal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripBold(s: string): string {
  // Strip all **...** pairs (handles "**Name** (note)" and inline bold within notes)
  return s.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}

function cell(s: string): string {
  return stripBold(s.trim());
}

function nullIfEmpty(s: string): string | null {
  const v = cell(s);
  return v === '' || v === '—' || v === '-' ? null : v;
}

/** Split a pipe-delimited row into trimmed cells (strips leading/trailing pipes). */
function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** True if the line is a markdown table separator (|---|...). */
function isSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|/.test(line);
}

/** Parse all table rows from a block of lines (skips header + separator). */
function parseTableRows(lines: string[]): string[][] {
  const rows: string[][] = [];
  let headerSeen = false;
  let separatorSeen = false;
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    if (isSeparator(line)) {
      separatorSeen = true;
      continue;
    }
    if (!separatorSeen) {
      headerSeen = true;
      continue; // skip header
    }
    if (headerSeen) {
      rows.push(splitRow(line));
    }
  }
  return rows;
}

// ─── Section extraction ───────────────────────────────────────────────────────

interface Section {
  level: 2 | 3;
  heading: string;
  lines: string[];
}

function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);

    if (h2) {
      if (current) sections.push(current);
      current = { level: 2, heading: h2[1].trim(), lines: [] };
    } else if (h3) {
      if (current) sections.push(current);
      current = { level: 3, heading: h3[1].trim(), lines: [] };
    } else {
      if (current) current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

// ─── Shift slug derivation ────────────────────────────────────────────────────

function deriveShiftSlug(h3Heading: string): string {
  const h = h3Heading.toLowerCase();
  if (h.startsWith('friday')) return 'friday-distro';
  if (h.startsWith('saturday distro')) return 'saturday-distro';
  if (h.startsWith('saturday evening')) return 'saturday-evening';
  if (h.startsWith('sunday')) return 'sunday-distro';
  if (h.startsWith('thursday')) return 'thursday-produce-market';
  // fallback: slugify
  return h3Heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Volunteer builders ───────────────────────────────────────────────────────

/** Parse "Active recurring volunteers — by shift" sub-sections. */
function parseRecurringSection(sections: Section[]): Volunteer[] {
  const results: Volunteer[] = [];
  const targetH2 = 'Active recurring volunteers — by shift';

  // Collect h3 sections that immediately follow the target h2
  let inBlock = false;
  for (const sec of sections) {
    if (sec.level === 2) {
      inBlock = sec.heading === targetH2;
      continue;
    }
    if (!inBlock || sec.level !== 3) continue;

    const shift = deriveShiftSlug(sec.heading);
    const rows = parseTableRows(sec.lines);
    for (const row of rows) {
      if (row.length < 5) continue;
      const [nameRaw, pronounsRaw, tenureRaw, accessRaw, notesRaw] = row;
      const volunteer: Volunteer = {
        name: cell(nameRaw),
        pronouns: nullIfEmpty(pronounsRaw),
        contact: null,
        tenure: nullIfEmpty(tenureRaw),
        access: nullIfEmpty(accessRaw),
        shifts: [shift],
        group_chat: null,
        notes: cell(notesRaw ?? ''),
        crew_type: 'recurring_shift' as CrewType,
      };
      results.push(volunteer);
    }
  }
  return results;
}

/** Derive a clean chat name from an h3 like "State University student crew (main chat — set up by a volunteer; texting)". */
function extractChatName(h3Heading: string): string {
  // Everything before the first '(' is the chat name
  const paren = h3Heading.indexOf('(');
  if (paren > 0) return h3Heading.slice(0, paren).trim();
  return h3Heading.trim();
}

/** Parse "Active distro volunteers — doing the lines" sub-sections. */
function parseDistroLines(sections: Section[]): Record<string, Volunteer[]> {
  const result: Record<string, Volunteer[]> = {};
  const targetH2 = 'Active distro volunteers — “doing the lines”';
  // The heading in the file uses curly quotes: "doing the lines"
  // Let's match more loosely
  const targetAlt = 'Active distro volunteers';

  let inBlock = false;
  for (const sec of sections) {
    if (sec.level === 2) {
      inBlock =
        sec.heading === targetH2 ||
        sec.heading.startsWith(targetAlt);
      continue;
    }
    if (!inBlock || sec.level !== 3) continue;

    const chatName = extractChatName(sec.heading);
    const volunteers: Volunteer[] = [];

    // These sections have varying columns.  Try to detect header row first.
    // All sections have: Name | Pronouns | (Tenure/cadence OR Cadence OR ...) | Notes
    // Monthly contributors: Name | Cadence | What they bring | Notes (no Pronouns col)
    const isMonthly = sec.heading.toLowerCase().includes('monthly');

    const rows = parseTableRows(sec.lines);
    for (const row of rows) {
      if (isMonthly) {
        // Name | Cadence | What they bring | Notes
        if (row.length < 3) continue;
        const [nameRaw, , , notesRaw] = row;
        volunteers.push({
          name: cell(nameRaw),
          pronouns: null,
          contact: null,
          tenure: nullIfEmpty(row[1]),
          access: null,
          shifts: [],
          group_chat: chatName,
          notes: cell(notesRaw ?? row[2] ?? ''),
          crew_type: 'distro_lines',
        });
      } else {
        // Name | Pronouns | Tenure/cadence | Notes
        if (row.length < 3) continue;
        const [nameRaw, pronounsRaw, tenureRaw, notesRaw] = row;
        volunteers.push({
          name: cell(nameRaw),
          pronouns: nullIfEmpty(pronounsRaw),
          contact: null,
          tenure: nullIfEmpty(tenureRaw),
          access: null,
          shifts: [],
          group_chat: chatName,
          notes: cell(notesRaw ?? ''),
          crew_type: 'distro_lines',
        });
      }
    }

    if (volunteers.length > 0) {
      result[chatName] = volunteers;
    }
  }
  return result;
}

/** Derive house slug from an h3 like "Co-op C co-op". */
function deriveHouseSlug(h3Heading: string): string {
  const h = h3Heading.toLowerCase();
  if (h.startsWith('co-op c')) return 'coop_c';
  if (h.startsWith('co-op a')) return 'coop_a';
  if (h.startsWith('co-op b')) return 'coop_b';
  if (h.startsWith('outside')) return 'outside';
  return h3Heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Parse "Active cooks" sub-sections. */
function parseActiveCooks(sections: Section[]): Record<string, Volunteer[]> {
  const result: Record<string, Volunteer[]> = {};
  const targetH2 = 'Active cooks';

  let inBlock = false;
  for (const sec of sections) {
    if (sec.level === 2) {
      inBlock = sec.heading === targetH2;
      continue;
    }
    if (!inBlock || sec.level !== 3) continue;

    const slug = deriveHouseSlug(sec.heading);
    const rows = parseTableRows(sec.lines);
    const volunteers: Volunteer[] = [];

    for (const row of rows) {
      // Name | Pronouns | Tenure | Notes
      if (row.length < 4) continue;
      const [nameRaw, pronounsRaw, tenureRaw, notesRaw] = row;
      volunteers.push({
        name: cell(nameRaw),
        pronouns: nullIfEmpty(pronounsRaw),
        contact: null,
        tenure: nullIfEmpty(tenureRaw),
        access: null,
        shifts: [],
        group_chat: null,
        notes: cell(notesRaw ?? ''),
        crew_type: 'cook',
      });
    }

    if (volunteers.length > 0) {
      result[slug] = volunteers;
    }
  }
  return result;
}

/** Parse "Outreach pipeline (currently active follow-ups)" h2 section. */
function parsePipeline(sections: Section[]): PipelineContact[] {
  const results: PipelineContact[] = [];

  for (const sec of sections) {
    if (sec.level !== 2) continue;
    if (!sec.heading.startsWith('Outreach pipeline')) continue;

    const rows = parseTableRows(sec.lines);
    for (const row of rows) {
      // Name | Pronouns | Contact | Source | Days · Role | Status | Last touch | Notes
      if (row.length < 6) continue;
      const [nameRaw, pronounsRaw, contactRaw, sourceRaw, daysRaw, statusRaw, lastTouchRaw, notesRaw] = row;

      // Strip ** from status
      const statusClean = cell(statusRaw) as PipelineStatus;

      results.push({
        name: cell(nameRaw),
        pronouns: nullIfEmpty(pronounsRaw),
        contact: nullIfEmpty(contactRaw),
        source: nullIfEmpty(sourceRaw),
        days_role: nullIfEmpty(daysRaw),
        status: statusClean,
        last_touch: nullIfEmpty(lastTouchRaw ?? ''),
        notes: cell(notesRaw ?? ''),
      });
    }
    break; // only one such section
  }
  return results;
}

/** Parse "Lapsed / not pursuing" h2 section. */
function parseLapsed(sections: Section[]): LapsedEntry[] {
  const results: LapsedEntry[] = [];

  for (const sec of sections) {
    if (sec.level !== 2) continue;
    if (!sec.heading.startsWith('Lapsed')) continue;

    const rows = parseTableRows(sec.lines);
    for (const row of rows) {
      // Name | Why | Last touch
      if (row.length < 2) continue;
      const [nameRaw, whyRaw, lastTouchRaw] = row;
      results.push({
        name: cell(nameRaw),
        reason: cell(whyRaw ?? ''),
        last_touch: nullIfEmpty(lastTouchRaw ?? ''),
      });
    }
    break;
  }
  return results;
}

/** Extract "Open follow-ups" h2 section as raw markdown. */
function extractFollowUps(sections: Section[]): string {
  for (const sec of sections) {
    if (sec.level !== 2) continue;
    if (!sec.heading.startsWith('Open follow-ups')) continue;
    return sec.lines.join('\n').trim();
  }
  return '';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function parseTracker(filePath: string): Promise<Roster> {
  const content = await readFile(filePath, 'utf-8');
  const sections = parseSections(content);

  return {
    active_recurring: parseRecurringSection(sections),
    active_distro_by_chat: parseDistroLines(sections),
    active_cooks: parseActiveCooks(sections),
    pipeline: parsePipeline(sections),
    lapsed: parseLapsed(sections),
    follow_ups_markdown: extractFollowUps(sections),
    parsed_at: new Date().toISOString(),
  };
}
