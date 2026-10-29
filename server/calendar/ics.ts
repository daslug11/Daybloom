import ical, { type VEvent } from 'node-ical';
import { FeedError } from './fetchFeed.js';
import type { SyncedEvent } from './types.js';

const MAX_EVENTS_PER_FEED = 2000;

const pad = (n: number) => String(n).padStart(2, '0');
/** node-ical builds date-only values at local midnight, so read them back with local getters. */
const dateOnly = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'val' in value) return String((value as { val: unknown }).val ?? '');
  return '';
}

/** Parses ICS text and returns event instances overlapping [from, to]. */
export function parseIcsEvents(body: string, calendarId: string, from: Date, to: Date): SyncedEvent[] {
  const trimmed = body.trimStart().slice(0, 500).toLowerCase();
  if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.includes('<head')) {
    throw new FeedError("This link opens a web page, not an ICS feed. Use the calendar's secret iCal (.ics) address — see “How to find your ICS address”.");
  }
  if (!body.includes('BEGIN:VCALENDAR')) {
    throw new FeedError("Couldn't read this as an ICS calendar (no BEGIN:VCALENDAR found).");
  }

  let data: ReturnType<typeof ical.sync.parseICS>;
  try {
    data = ical.sync.parseICS(body);
  } catch {
    throw new FeedError('The ICS file is malformed and could not be parsed.');
  }

  const events: SyncedEvent[] = [];
  for (const component of Object.values(data)) {
    if (!component || component.type !== 'VEVENT') continue;
    const vevent = component as VEvent;
    if (!vevent.start) continue;
    let instances;
    try {
      instances = ical.expandRecurringEvent(vevent, { from, to, expandOngoing: true });
    } catch {
      continue; // One broken event shouldn't sink the whole feed.
    }
    for (const inst of instances) {
      const start = new Date(inst.start);
      let end = inst.end ? new Date(inst.end) : new Date(start);
      if (inst.isFullDay && end <= start) end = new Date(start.getTime() + 86_400_000);
      if (Number.isNaN(start.getTime()) || end < from || start > to) continue;
      const status = text(inst.event.status).toUpperCase();
      if (status === 'CANCELLED') continue;
      events.push({
        id: `${vevent.uid ?? text(inst.summary)}@${inst.isFullDay ? dateOnly(start) : start.toISOString()}`,
        calendarId,
        title: text(inst.summary).trim() || '(busy)',
        // All-day events are calendar dates, not instants: send "YYYY-MM-DD" (end exclusive)
        // so they land on the same day in every time zone.
        start: inst.isFullDay ? dateOnly(start) : start.toISOString(),
        end: inst.isFullDay ? dateOnly(end) : end.toISOString(),
        allDay: inst.isFullDay,
        location: text(inst.event.location).trim() || undefined,
      });
      if (events.length >= MAX_EVENTS_PER_FEED) break;
    }
    if (events.length >= MAX_EVENTS_PER_FEED) break;
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}
