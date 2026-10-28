import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoCalendarIcs } from '../server/demo.js';
import { isPrivateAddress, normalizeFeedUrl } from '../server/fetchFeed.js';
import { parseIcsEvents } from '../server/ics.js';
import { clearSyncCache, handleSyncRequest, syncFeeds } from '../server/sync.js';

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:one',
  'DTSTART:20261028T150000Z',
  'DTEND:20261028T160000Z',
  'SUMMARY:Planning',
  'LOCATION:Room 4',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly',
  'DTSTART:20261026T090000Z',
  'DTEND:20261026T093000Z',
  'RRULE:FREQ=WEEKLY;COUNT=4',
  'SUMMARY:Weekly sync',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:cancelled',
  'DTSTART:20261029T100000Z',
  'DTEND:20261029T110000Z',
  'STATUS:CANCELLED',
  'SUMMARY:Nope',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const from = new Date('2026-10-25T00:00:00Z');
const to = new Date('2026-11-30T00:00:00Z');

function mockFetch(body: string, status = 200) {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

afterEach(() => {
  clearSyncCache();
  delete process.env.SYNC_ALLOW_PRIVATE;
});

describe('parseIcsEvents', () => {
  it('parses single, recurring and skips cancelled events', () => {
    const events = parseIcsEvents(ICS, 'cal', from, to);
    expect(events.map((e) => e.title)).toEqual(['Weekly sync', 'Planning', 'Weekly sync', 'Weekly sync', 'Weekly sync']);
    const planning = events.find((e) => e.title === 'Planning')!;
    expect(planning).toMatchObject({ calendarId: 'cal', start: '2026-10-28T15:00:00.000Z', end: '2026-10-28T16:00:00.000Z', allDay: false, location: 'Room 4' });
  });

  it('keeps all-day events on their calendar date', () => {
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:h', 'DTSTART;VALUE=DATE:20261031', 'DTEND;VALUE=DATE:20261101', 'SUMMARY:Halloween', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    expect(parseIcsEvents(ics, 'c', from, to)[0]).toMatchObject({ start: '2026-10-31', end: '2026-11-01', allDay: true });
  });

  it('rejects HTML pages with a helpful message', () => {
    expect(() => parseIcsEvents('<!DOCTYPE html><html></html>', 'c', from, to)).toThrow(/web page, not an ICS feed/);
  });

  it('rejects non-calendar text', () => {
    expect(() => parseIcsEvents('hello', 'c', from, to)).toThrow(/BEGIN:VCALENDAR/);
  });
});

describe('demo feed', () => {
  it('produces timed events in the requested time zone and an all-day event', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    const events = parseIcsEvents(demoCalendarIcs('America/New_York', now), 'demo', new Date('2026-10-26T00:00:00Z'), new Date('2026-11-02T00:00:00Z'));
    const lunch = events.find((e) => e.title.startsWith('Lunch'))!;
    // 12:30 New York (EDT, UTC-4) on Oct 28 → 16:30Z
    expect(lunch.start).toBe('2026-10-28T16:30:00.000Z');
    expect(events.filter((e) => e.title.startsWith('Daily standup')).length).toBe(5);
    expect(events.find((e) => e.title.includes('birthday'))).toMatchObject({ allDay: true, start: '2026-10-31', end: '2026-11-01' });
  });
});

describe('url guard', () => {
  it('normalizes webcal and rejects other protocols', () => {
    expect(normalizeFeedUrl('webcal://example.com/a.ics').toString()).toBe('https://example.com/a.ics');
    expect(() => normalizeFeedUrl('ftp://example.com/a.ics')).toThrow();
  });
  it('flags private addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.4', '172.20.1.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fd00::1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
  });
  it('refuses to fetch localhost feeds', async () => {
    const fetchImpl = mockFetch(ICS);
    const { results } = await syncFeeds({ feeds: [{ id: 'a', url: 'http://localhost:9999/x.ics' }] }, { fetchImpl });
    expect(results[0]).toMatchObject({ ok: false, error: expect.stringMatching(/private network/) });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('syncFeeds', () => {
  it('caches feed bodies for 10 minutes', async () => {
    process.env.SYNC_ALLOW_PRIVATE = '1';
    const fetchImpl = mockFetch(ICS);
    const body = { feeds: [{ id: 'a', url: 'http://127.0.0.1/cal.ics' }], from: from.toISOString(), to: to.toISOString() };
    const now = Date.parse('2026-10-28T12:00:00Z');
    const first = await syncFeeds(body, { fetchImpl, now });
    const second = await syncFeeds(body, { fetchImpl, now: now + 9 * 60_000 });
    const third = await syncFeeds(body, { fetchImpl, now: now + 11 * 60_000 });
    expect(first.results[0]).toMatchObject({ ok: true, cached: false });
    expect(second.results[0]).toMatchObject({ ok: true, cached: true });
    expect(third.results[0].cached).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(first.results[0].events.length).toBe(5);
  });

  it('reports HTTP errors per feed without failing the others', async () => {
    process.env.SYNC_ALLOW_PRIVATE = '1';
    const fetchImpl = vi.fn(async (url: URL) =>
      String(url).includes('bad') ? new Response('nope', { status: 403 }) : new Response(ICS),
    ) as unknown as typeof fetch;
    const { results } = await syncFeeds(
      { feeds: [{ id: 'good', url: 'http://127.0.0.1/good.ics' }, { id: 'bad', url: 'http://127.0.0.1/bad.ics' }], from: from.toISOString(), to: to.toISOString() },
      { fetchImpl },
    );
    expect(results[0].ok).toBe(true);
    expect(results[1]).toMatchObject({ ok: false, error: expect.stringMatching(/refused access \(403\)/) });
  });

  it('serves the built-in demo feed without a network request', async () => {
    const fetchImpl = mockFetch('');
    const { results } = await syncFeeds(
      { feeds: [{ id: 'demo', url: 'http://localhost:5173/api/demo-calendar.ics' }], tz: 'Europe/Berlin' },
      { fetchImpl, requestHost: 'localhost:5173' },
    );
    expect(results[0].ok).toBe(true);
    expect(results[0].events.length).toBeGreaterThan(5);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('handleSyncRequest', () => {
  it('validates input', async () => {
    const res = await handleSyncRequest(new Request('http://x/api/calendar-sync', { method: 'POST', body: '{"feeds":5}' }));
    expect(res.status).toBe(400);
    const get = await handleSyncRequest(new Request('http://x/api/calendar-sync'));
    expect(get.status).toBe(405);
  });
});
