import type {
  Roster,
  OutreachLogEntry,
  NewOutreachLogEntry,
  CoverageRequest,
  NewCoverageRequest,
  CookCrew,
} from '@/types/portal';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Portal API ${init?.method ?? 'GET'} ${url} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRoster(): Promise<Roster> {
  return apiFetch<Roster>('/api/portal/roster');
}

export async function fetchOutreachLog(): Promise<OutreachLogEntry[]> {
  return apiFetch<OutreachLogEntry[]>('/api/portal/outreach');
}

export async function postOutreachEntry(
  entry: NewOutreachLogEntry,
): Promise<OutreachLogEntry> {
  const result = await apiFetch<{ entry: OutreachLogEntry; all: OutreachLogEntry[] }>(
    '/api/portal/outreach',
    { method: 'POST', body: JSON.stringify(entry) },
  );
  return result.entry;
}

export async function fetchCoverageRequests(): Promise<CoverageRequest[]> {
  return apiFetch<CoverageRequest[]>('/api/portal/coverage');
}

export async function upsertCoverageRequest(
  req: CoverageRequest | NewCoverageRequest,
): Promise<CoverageRequest> {
  const result = await apiFetch<{ request: CoverageRequest; all: CoverageRequest[] }>(
    '/api/portal/coverage',
    { method: 'POST', body: JSON.stringify(req) },
  );
  return result.request;
}

export async function fetchCookCrews(): Promise<Record<string, CookCrew>> {
  return apiFetch<Record<string, CookCrew>>('/api/portal/cook-crews');
}
