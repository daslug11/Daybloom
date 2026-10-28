import { dateKey, parseKey } from './dates';
import type { SyncedEvent } from '../../server/calendar/types';

export const DAY_MINUTES = 24 * 60;
export const SNAP = 15;

export const snap = (mins: number) => Math.round(mins / SNAP) * SNAP;
export const clampStart = (start: number, duration: number) => Math.max(0, Math.min(DAY_MINUTES - duration, start));

export function addDaysKey(key: string, n: number) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Monday-first week containing `key`. */
export function weekOf(key: string) {
  const d = parseKey(key);
  const monday = addDaysKey(key, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
}

export function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function formatMinutes(mins: number) {
  const d = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatMinutesShort(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hourLabel(h: number) {
  return new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
}

export interface DayEvent {
  event: SyncedEvent;
  start: number; // minutes from midnight, clipped to the day
  end: number;
}

/** Timed events overlapping `key`, clipped to that day. */
export function timedEventsOn(events: SyncedEvent[], key: string): DayEvent[] {
  const dayStart = parseKey(key);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const out: DayEvent[] = [];
  for (const e of events) {
    if (e.allDay) continue;
    const s = new Date(e.start);
    const en = new Date(e.end);
    if (en <= dayStart || s >= dayEnd) continue;
    const start = s < dayStart ? 0 : minutesOfDay(s);
    const end = en >= dayEnd ? DAY_MINUTES : minutesOfDay(en);
    out.push({ event: e, start, end: Math.max(end, start + SNAP) });
  }
  return out;
}

/** All-day events covering `key` (ICS all-day end dates are exclusive). */
export function allDayEventsOn(events: SyncedEvent[], key: string) {
  return events.filter((e) => e.allDay && e.start.slice(0, 10) <= key && key < e.end.slice(0, 10));
}

export interface Lane {
  lane: number;
  lanes: number;
}

/** Side-by-side columns for overlapping blocks, calendar-app style. */
export function layoutLanes(items: { id: string; start: number; end: number }[]): Map<string, Lane> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, Lane>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    cluster.forEach((c) => result.set(c.id, { lane: c.lane, lanes: laneEnds.length }));
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else laneEnds[lane] = item.end;
    cluster.push({ id: item.id, lane });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}
