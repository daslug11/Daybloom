import { dateKey, parseKey } from './dates';
import type { SyncedEvent } from '../../server/calendar/types';

export const DAY_MINUTES = 24 * 60;
export const SNAP = 15;

export const snap = (mins: number) => Math.round(mins / SNAP) * SNAP;
export const clampStart = (start: number, duration: number) => Math.max(0, Math.min(DAY_MINUTES - duration, start));

/** The 15-minute slot that contains `mins` (the slot you point at, not the nearest edge). */
export const slotFloor = (mins: number) => Math.floor(mins / SNAP) * SNAP;

export interface TimeBlock {
  date: string;
  start: number;
  duration: number;
}

/** Shortest and longest a block can be. */
export const MIN_DURATION = SNAP;

/** A block moved by `minutes` (snapped, kept inside the day). */
export function moveBlock(b: TimeBlock, minutes: number, date = b.date): TimeBlock {
  return { date, duration: b.duration, start: clampStart(b.start + snap(minutes), b.duration) };
}

/** A block whose end moved by `minutes` (snapped, at least 15 minutes, ends by midnight). */
export function resizeBlock(b: TimeBlock, minutes: number): TimeBlock {
  return { ...b, duration: Math.max(MIN_DURATION, Math.min(DAY_MINUTES - b.start, b.duration + snap(minutes))) };
}

export const sameBlock = (a: TimeBlock | null | undefined, b: TimeBlock | null | undefined) =>
  !!a && !!b && a.date === b.date && a.start === b.start && a.duration === b.duration;

/**
 * Keyboard editing of a block: ↑/↓ move 15 minutes, Shift+↑/↓ change the length,
 * ←/→ move a day. Returns null for keys it doesn't handle.
 */
export function nudgeBlock(b: TimeBlock, key: string, shift: boolean): TimeBlock | null {
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const dir = key === 'ArrowUp' ? -1 : 1;
    return shift ? resizeBlock(b, dir * SNAP) : moveBlock(b, dir * SNAP);
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') return { ...b, date: addDaysKey(b.date, key === 'ArrowLeft' ? -1 : 1) };
  return null;
}

/**
 * Auto-scroll speed (px per frame) while dragging near the top or bottom edge of a scroller:
 * 0 outside the edge zone, growing with how deep the pointer is in it.
 */
export function edgeScrollSpeed(y: number, top: number, bottom: number, zone = 48, max = 18) {
  if (y < top + zone) return -Math.ceil(max * Math.min(1, (top + zone - y) / zone));
  if (y > bottom - zone) return Math.ceil(max * Math.min(1, (y - (bottom - zone)) / zone));
  return 0;
}

/** Parses an <input type="time"> value ("14:05") to minutes, snapped to 15. */
export function parseTimeInput(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins < DAY_MINUTES ? Math.min(snap(mins), DAY_MINUTES - SNAP) : null;
}

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

/** "Tue 3 Nov" style day label in the user's locale. */
export function dayLabel(key: string) {
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "2:15 PM – 3:00 PM" in the user's locale. */
export function rangeLabel(start: number, duration: number) {
  return `${formatMinutes(start)} – ${formatMinutes((start + duration) % DAY_MINUTES)}`;
}

/** Short weekday name (ISO 1 = Monday … 7 = Sunday) in the user's locale. */
export function weekdayShort(isoDay: number) {
  return new Date(2024, 0, isoDay).toLocaleDateString(undefined, { weekday: 'short' });
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
