import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KEYS } from '../lib/storage';
import { EMPTY_SYNC_CACHE, requestSync, SyncRequestError, type FeedStatus, type SyncCache, type SyncedEvent } from '../lib/sync';
import type { CalendarLink } from '../lib/types';
import { useCalendars } from './useData';
import { useLocalStorage } from './useLocalStorage';

const AUTO_SYNC_MS = 10 * 60 * 1000;

interface CalendarSyncState {
  /** Events from calendars that currently have sync turned on. */
  events: SyncedEvent[];
  statuses: Record<string, FeedStatus>;
  syncing: boolean;
  lastSync?: string;
  /** The request as a whole failed (server unreachable etc.). */
  requestError: string | null;
  syncedCalendars: CalendarLink[];
  errorCount: number;
  sync: () => Promise<void>;
}

const SyncContext = createContext<CalendarSyncState | null>(null);

export function useCalendarSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useCalendarSync must be used inside <CalendarSyncProvider>');
  return ctx;
}

export function CalendarSyncProvider({ children }: { children: ReactNode }) {
  const [calendars] = useCalendars();
  const [cache, setCache] = useLocalStorage<SyncCache>(KEYS.syncCache, EMPTY_SYNC_CACHE);
  const [syncing, setSyncing] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const inFlight = useRef(0);

  const syncedCalendars = useMemo(() => calendars.filter((c) => c.sync), [calendars]);
  // Re-sync whenever the set of synced feeds changes (toggle, edit URL, add, delete, reset).
  const signature = syncedCalendars.map((c) => `${c.id}|${c.url}`).join('\n');
  const latest = useRef(syncedCalendars);
  latest.current = syncedCalendars;

  const sync = useCallback(async () => {
    const targets = latest.current;
    const ticket = ++inFlight.current;
    if (!targets.length) {
      setRequestError(null);
      setCache((c) => ({ ...c, events: [], statuses: {} }));
      return;
    }
    setSyncing(true);
    setRequestError(null);
    setCache((c) => ({
      ...c,
      statuses: Object.fromEntries(targets.map((t) => [t.id, { ...c.statuses[t.id], state: 'loading' as const }])),
    }));
    try {
      const results = await requestSync(targets);
      if (ticket !== inFlight.current) return; // a newer sync superseded this one
      setCache({
        lastSync: new Date().toISOString(),
        events: results.flatMap((r) => r.events),
        statuses: Object.fromEntries(
          results.map((r) => [
            r.id,
            r.ok
              ? { state: 'ok', count: r.events.length, fetchedAt: r.fetchedAt, cached: r.cached }
              : { state: 'error', error: r.error ?? 'Sync failed.' },
          ]),
        ),
      });
    } catch (err) {
      if (ticket !== inFlight.current) return;
      const message = err instanceof SyncRequestError ? err.message : 'Sync failed unexpectedly.';
      setRequestError(message);
      // Keep previously synced events, but mark every feed as failed.
      setCache((c) => ({
        ...c,
        statuses: Object.fromEntries(targets.map((t) => [t.id, { state: 'error' as const, error: message }])),
      }));
    } finally {
      if (ticket === inFlight.current) setSyncing(false);
    }
  }, [setCache]);

  useEffect(() => {
    const t = window.setTimeout(sync, 400);
    return () => window.clearTimeout(t);
  }, [signature, sync]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') sync();
    }, AUTO_SYNC_MS);
    return () => window.clearInterval(id);
  }, [sync]);

  const value = useMemo<CalendarSyncState>(() => {
    const ids = new Set(syncedCalendars.map((c) => c.id));
    const statuses = Object.fromEntries(Object.entries(cache.statuses).filter(([id]) => ids.has(id)));
    return {
      events: cache.events.filter((e) => ids.has(e.calendarId)),
      statuses,
      syncing,
      lastSync: cache.lastSync,
      requestError,
      syncedCalendars,
      errorCount: Object.values(statuses).filter((s) => s.state === 'error').length,
      sync,
    };
  }, [cache, syncing, requestError, syncedCalendars, sync]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
