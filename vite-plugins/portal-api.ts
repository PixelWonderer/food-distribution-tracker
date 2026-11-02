/**
 * portal-api.ts
 *
 * Vite dev-server plugin exposing the localhost-only volunteer portal API.
 * Reads/writes files in demo-data/volunteers/ relative to the repo root (fake demo data; replace with your own).
 *
 * Routes:
 *   GET  /api/portal/roster       → Roster (parsed from tracker.md)
 *   GET  /api/portal/outreach     → OutreachLogEntry[]
 *   POST /api/portal/outreach     → { entry, all }
 *   GET  /api/portal/coverage     → CoverageRequest[]
 *   POST /api/portal/coverage     → { request, all }
 *   GET  /api/portal/cook-crews   → Record<string, CookCrew>
 */

import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import { parseTracker } from '../src/services/trackerParser';
import type {
  OutreachLogEntry,
  NewOutreachLogEntry,
  CoverageRequest,
  NewCoverageRequest,
} from '../src/types/portal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJsonBody(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer | string) => (data += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmp = filePath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendJson(res: any, status: number, body: unknown): void {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function portalApiPlugin(): Plugin {
  return {
    name: 'portal-api',

    configureServer(server) {
      // Data lives in <repo>/demo-data/volunteers/ (override with PORTAL_DATA_DIR)
      const dataDir = process.env.PORTAL_DATA_DIR
        ? path.resolve(process.env.PORTAL_DATA_DIR)
        : path.resolve(__dirname, '..', 'demo-data', 'volunteers');

      const TRACKER   = path.join(dataDir, 'tracker.md');
      const OUTREACH  = path.join(dataDir, 'outreach-log.json');
      const COVERAGE  = path.join(dataDir, 'coverage-requests.json');
      const COOK_CREWS = path.join(dataDir, 'cook-crews.json');

      server.middlewares.use('/api/portal', async (req, res, next) => {
        const url = req.url ?? '';
        const method = req.method ?? 'GET';

        try {
          // ── GET /api/portal/roster ────────────────────────────────────────
          if (url === '/roster' && method === 'GET') {
            const roster = await parseTracker(TRACKER);
            return sendJson(res, 200, roster);
          }

          // ── GET /api/portal/outreach ──────────────────────────────────────
          if (url === '/outreach' && method === 'GET') {
            const all = await readJsonFile<OutreachLogEntry[]>(OUTREACH, []);
            return sendJson(res, 200, all);
          }

          // ── POST /api/portal/outreach ─────────────────────────────────────
          if (url === '/outreach' && method === 'POST') {
            let body: NewOutreachLogEntry;
            try {
              body = (await readJsonBody(req)) as NewOutreachLogEntry;
            } catch {
              return sendJson(res, 400, { error: 'Invalid JSON body' });
            }

            const entry: OutreachLogEntry = {
              id: crypto.randomUUID(),
              logged_at: new Date().toISOString(),
              ...body,
            };

            const all = await readJsonFile<OutreachLogEntry[]>(OUTREACH, []);
            all.push(entry);
            await writeJsonAtomic(OUTREACH, all);
            return sendJson(res, 200, { entry, all });
          }

          // ── GET /api/portal/coverage ──────────────────────────────────────
          if (url === '/coverage' && method === 'GET') {
            const all = await readJsonFile<CoverageRequest[]>(COVERAGE, []);
            return sendJson(res, 200, all);
          }

          // ── POST /api/portal/coverage ─────────────────────────────────────
          if (url === '/coverage' && method === 'POST') {
            let body: Partial<CoverageRequest> & Partial<NewCoverageRequest>;
            try {
              body = (await readJsonBody(req)) as typeof body;
            } catch {
              return sendJson(res, 400, { error: 'Invalid JSON body' });
            }

            const all = await readJsonFile<CoverageRequest[]>(COVERAGE, []);
            const now = new Date().toISOString();
            let request: CoverageRequest;

            if ('id' in body && typeof body.id === 'string') {
              // Upsert: update existing record by id
              const existing = all.find((r) => r.id === body.id);
              if (existing) {
                request = {
                  ...existing,
                  ...(body as Partial<CoverageRequest>),
                  last_updated: now,
                };
                const idx = all.findIndex((r) => r.id === body.id);
                all[idx] = request;
              } else {
                // id supplied but not found — treat as insert
                request = {
                  shift_date: body.shift_date ?? null,
                  shift_type: body.shift_type ?? '',
                  shift_label: body.shift_label ?? '',
                  original_assignee: body.original_assignee ?? '',
                  reason: body.reason ?? '',
                  status: body.status ?? 'open',
                  candidates: body.candidates ?? [],
                  filled_by: (body as Partial<CoverageRequest>).filled_by ?? null,
                  priority: body.priority ?? 'medium',
                  notes: body.notes ?? '',
                  created_at: now,
                  last_updated: now,
                  id: body.id,
                };
                all.push(request);
              }
            } else {
              // New insert
              const newBody = body as NewCoverageRequest;
              request = {
                id: crypto.randomUUID(),
                shift_date: newBody.shift_date ?? null,
                shift_type: newBody.shift_type ?? '',
                shift_label: newBody.shift_label ?? '',
                original_assignee: newBody.original_assignee ?? '',
                reason: newBody.reason ?? '',
                status: newBody.status ?? 'open',
                candidates: newBody.candidates ?? [],
                filled_by: null,
                priority: newBody.priority ?? 'medium',
                notes: newBody.notes ?? '',
                created_at: now,
                last_updated: now,
              };
              all.push(request);
            }

            await writeJsonAtomic(COVERAGE, all);
            return sendJson(res, 200, { request, all });
          }

          // ── GET /api/portal/cook-crews ────────────────────────────────────
          if (url === '/cook-crews' && method === 'GET') {
            const crews = await readJsonFile<Record<string, unknown>>(COOK_CREWS, {});
            return sendJson(res, 200, crews);
          }

          // ── 404 for unknown portal routes ─────────────────────────────────
          return sendJson(res, 404, { error: `Unknown portal route: ${method} ${url}` });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return sendJson(res, 500, { error: message });
        }
      });
    },
  };
}
