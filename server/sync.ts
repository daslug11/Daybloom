import { DEMO_FEED_PATH, demoCalendarIcs } from './demo.js';
import { FeedError, fetchFeedText, normalizeFeedUrl } from './fetchFeed.js';
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

function isDemoFeed(url: string, requestHost: string | null) {
  try {
    const u = normalizeFeedUrl(url);
    return u.pathname === DEMO_FEED_PATH && (!requestHost || u.host === requestHost);
  } catch {
    return false;
  }
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
  opts: { requestHost?: string | null; fetchImpl?: typeof fetch; now?: number } = {},
): Promise<SyncResponseBody> {
  const now = opts.now ?? Date.now();
  const { from, to } = parseWindow(body, now);
  const results = await Promise.all(
    body.feeds.map(async (feed): Promise<FeedResult> => {
      const base = { id: feed.id, events: [], cached: false, fetchedAt: new Date(now).toISOString() };
      try {
        if (isDemoFeed(feed.url, opts.requestHost ?? null)) {
          const tz = normalizeFeedUrl(feed.url).searchParams.get('tz') ?? body.tz;
          return { ...base, ok: true, events: parseIcsEvents(demoCalendarIcs(tz, new Date(now)), feed.id, from, to) };
        }
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** POST /api/calendar-sync — Web-standard handler used by both Vercel and the Vite dev server. */
export async function handleSyncRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  let body: SyncRequestBody;
  try {
    body = (await req.json()) as SyncRequestBody;
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }
  if (!body || !Array.isArray(body.feeds)) return json({ error: 'Expected { feeds: [{ id, url }] }.' }, 400);
  if (body.feeds.length > MAX_FEEDS) return json({ error: `You can sync up to ${MAX_FEEDS} calendars at once.` }, 400);
  if (body.feeds.some((f) => !f || typeof f.id !== 'string' || typeof f.url !== 'string' || f.url.length > 2048)) {
    return json({ error: 'Each feed needs a string id and url.' }, 400);
  }
  try {
    return json(await syncFeeds(body, { requestHost: new URL(req.url).host }));
  } catch (err) {
    return json({ error: err instanceof FeedError ? err.message : 'Sync failed.' }, 400);
  }
}

/** GET /api/demo-calendar.ics?tz=Europe/Berlin — a real ICS feed you can subscribe to anywhere. */
export function handleDemoCalendar(req: Request): Response {
  const tz = new URL(req.url).searchParams.get('tz');
  return new Response(demoCalendarIcs(tz), {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'public, max-age=600' },
  });
}
