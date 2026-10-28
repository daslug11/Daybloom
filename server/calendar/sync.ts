import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '../auth.js';
import { handle, HttpError, json, readJson } from '../http.js';
import { FeedError, fetchFeedText } from './fetchFeed.js';
import { parseIcsEvents } from './ics.js';
import type { FeedResult, SyncRequestBody, SyncResponseBody } from './types.js';

export const CACHE_TTL_MS = 10 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000;
const MAX_FEEDS = 25;
const MAX_WINDOW_DAYS = 120;

interface CacheEntry {
  at: number;
  body: Promise<string>;
  failed?: boolean;
}

/** In-memory cache of raw feed bodies, keyed by URL. Lives as long as the server/function instance. */
const cache = new Map<string, CacheEntry>();

export function clearSyncCache() {
  cache.clear();
}

function cachedFetch(url: string, fetchImpl: typeof fetch, now: number) {
  const hit = cache.get(url);
  if (hit && now - hit.at < (hit.failed ? ERROR_TTL_MS : CACHE_TTL_MS)) return { entry: hit, cached: true };
  const entry: CacheEntry = { at: now, body: fetchFeedText(url, fetchImpl) };
  entry.body.catch(() => (entry.failed = true));
  cache.set(url, entry);
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return { entry, cached: false };
}

function parseWindow(body: SyncRequestBody, now: number) {
  const from = body.from ? new Date(body.from) : new Date(now - 7 * 86_400_000);
  let to = body.to ? new Date(body.to) : new Date(now + 60 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw new FeedError('Invalid date range.');
  }
  const max = new Date(from.getTime() + MAX_WINDOW_DAYS * 86_400_000);
  if (to > max) to = max;
  return { from, to };
}

export async function syncFeeds(
  body: SyncRequestBody,
  opts: { fetchImpl?: typeof fetch; now?: number } = {},
): Promise<SyncResponseBody> {
  const now = opts.now ?? Date.now();
  const { from, to } = parseWindow(body, now);
  const results = await Promise.all(
    body.feeds.map(async (feed): Promise<FeedResult> => {
      const base = { id: feed.id, events: [], cached: false, fetchedAt: new Date(now).toISOString() };
      try {
        const { entry, cached } = cachedFetch(feed.url.trim(), opts.fetchImpl ?? fetch, now);
        const text = await entry.body;
        return {
          ...base,
          ok: true,
          cached,
          fetchedAt: new Date(entry.at).toISOString(),
          events: parseIcsEvents(text, feed.id, from, to),
        };
      } catch (err) {
        const error = err instanceof FeedError ? err.message : 'Unexpected error while syncing this calendar.';
        if (!(err instanceof FeedError)) console.error('[calendar-sync]', feed.url, err);
        return { ...base, ok: false, error };
      }
    }),
  );
  return { results };
}

/** Syncs the user's calendars that have sync turned on (URLs are read from their rows, never from the request). */
export async function syncUserCalendars(db: SupabaseClient, window: { from?: string; to?: string } = {}) {
  const { data, error } = await db.from('calendars').select('id, url').eq('sync', true).limit(MAX_FEEDS);
  if (error) throw new HttpError(500, 'Could not load your calendars.');
  if (!data.length) return { results: [] };
  return syncFeeds({ feeds: data, ...window });
}

/** POST /api/calendar-sync {from?, to?} — signed-in users only. */
export const handleSyncRequest = handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const { db } = await requireUser(req);
  const body = await readJson<{ from?: string; to?: string }>(req);
  try {
    return json(await syncUserCalendars(db, { from: body.from, to: body.to }));
  } catch (err) {
    if (err instanceof FeedError) throw new HttpError(400, err.message);
    throw err;
  }
});
