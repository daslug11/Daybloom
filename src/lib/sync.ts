import type { FeedResult, SyncRequestBody, SyncResponseBody, SyncedEvent } from '../../server/types';
import type { CalendarLink } from './types';

export type { SyncedEvent };

export type FeedState = 'loading' | 'ok' | 'error';

export interface FeedStatus {
  state: FeedState;
  error?: string;
  count?: number;
  /** When the server last fetched this feed (it caches for 10 minutes). */
  fetchedAt?: string;
  cached?: boolean;
}

/** What we keep in localStorage so the Planner and dashboard work before the next sync. */
export interface SyncCache {
  events: SyncedEvent[];
  statuses: Record<string, FeedStatus>;
  lastSync?: string;
}

export const EMPTY_SYNC_CACHE: SyncCache = { events: [], statuses: {} };

export class SyncRequestError extends Error {}

export function syncWindow(now = new Date()) {
  const from = new Date(now);
  from.setDate(from.getDate() - 14);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setDate(to.getDate() + 56);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Calls the backend. Throws SyncRequestError with a UI-ready message when the request itself fails. */
export async function requestSync(calendars: CalendarLink[]): Promise<FeedResult[]> {
  const body: SyncRequestBody = {
    feeds: calendars.map((c) => ({ id: c.id, url: c.url })),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...syncWindow(),
  };
  let res: Response;
  try {
    res = await fetch('/api/calendar-sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new SyncRequestError("Couldn't reach the sync server. Check your connection and try again.");
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    throw new SyncRequestError('The sync server isn’t running here. Deploy with the /api functions (see README → Calendar sync).');
  }
  const data = (await res.json()) as SyncResponseBody & { error?: string };
  if (!res.ok) throw new SyncRequestError(data.error ?? `Sync failed (HTTP ${res.status}).`);
  return data.results;
}

export function timeAgo(iso?: string, now = Date.now()) {
  if (!iso) return 'never';
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
