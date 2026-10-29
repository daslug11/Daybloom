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
  return {
    events,
    statuses,
    syncedCalendars: synced,
    syncing: query.isFetching,
    lastSync: query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : undefined,
    requestError: query.isError ? (query.error as Error).message : null,
    errorCount: Object.values(statuses).filter((s) => s.state === 'error').length,
    sync: () => query.refetch(),
  };
}
