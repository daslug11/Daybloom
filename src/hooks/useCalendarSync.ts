import { useQuery } from '@tanstack/react-query';
import type { FeedResult, SyncedEvent } from '../../server/calendar/types';
import { apiFetch } from '../lib/api';
import { addDays } from '../lib/dates';
import { useUserId } from './useAuth';
import { useCalendars } from './data/calendars';
import { useToday } from './useProfile';

export type { SyncedEvent };

export interface FeedStatus {
  state: 'loading' | 'ok' | 'error';
  error?: string;
  count?: number;
  fetchedAt?: string;
}

/** How long the sync server keeps a fetched feed before fetching it again (server/calendar/sync.ts CACHE_TTL_MS). */
export const FEED_REFRESH_MS = 10 * 60_000;

/** The oldest successful fetch time: the honest "checked" time for the set as a whole. */
export function oldestFetch(results: Pick<FeedResult, 'ok' | 'fetchedAt'>[]) {
  const times = results.filter((r) => r.ok && r.fetchedAt).map((r) => Date.parse(r.fetchedAt)).filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)).toISOString() : undefined;
}

/**
 * Synced ICS events for calendars with "Sync" on. The server fetches the feeds
 * (and caches them for 10 minutes); we refetch every 10 minutes too.
 */
export function useCalendarSync() {
  const uid = useUserId();
  const { data: calendars = [] } = useCalendars();
  const { today } = useToday();
  const synced = calendars.filter((c) => c.sync);
  const signature = synced.map((c) => `${c.id}:${c.url}`).join('|');

  const query = useQuery({
    queryKey: ['calendar-sync', uid, signature],
    enabled: !!uid && synced.length > 0,
    queryFn: async () => {
      const from = new Date(`${addDays(today, -14)}T00:00:00`).toISOString();
      const to = new Date(`${addDays(today, 56)}T00:00:00`).toISOString();
      return apiFetch<{ results: FeedResult[] }>('/api/calendar-sync', { from, to });
    },
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });

  const results = query.data?.results ?? [];
  const syncedIds = new Set(synced.map((c) => c.id));
  const events = results.filter((r) => syncedIds.has(r.id)).flatMap((r) => r.events);
  const statuses: Record<string, FeedStatus> = {};
  for (const c of synced) {
    const r = results.find((x) => x.id === c.id);
    statuses[c.id] = query.isFetching && !r
      ? { state: 'loading' }
      : r
        ? r.ok
          ? { state: 'ok', count: r.events.length, fetchedAt: r.fetchedAt }
          : { state: 'error', error: r.error }
        : query.isError
          ? { state: 'error', error: (query.error as Error).message }
          : { state: 'loading' };
  }
  const ours = results.filter((r) => syncedIds.has(r.id));
  return {
    events,
    statuses,
    syncedCalendars: synced,
    syncing: query.isFetching,
    /**
     * When the feeds were last actually fetched (the oldest of them), not when the browser last
     * asked: a request inside the server's 10-minute cache window returns the cached copy.
     */
    lastSync: oldestFetch(ours) ?? (query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : undefined),
    requestError: query.isError ? (query.error as Error).message : null,
    errorCount: Object.values(statuses).filter((s) => s.state === 'error').length,
    /** Asks the server again. `fresh` is false when every feed came back from its cache. */
    sync: async () => {
      const r = await query.refetch();
      const list = (r.data?.results ?? []).filter((x) => syncedIds.has(x.id));
      return { fresh: list.some((x) => !x.cached), lastSync: oldestFetch(list), ok: !r.isError };
    },
  };
}
