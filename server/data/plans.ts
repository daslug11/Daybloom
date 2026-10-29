import { calendarEvents, type Ctx } from './context.js';
import {
  addDaysKey,
  expandSeries,
  isoWeekday,
  overlaps,
  planOccurrences,
  WEEKDAYS,
  type Busy,
  type Occurrence,
  type OccurrenceRow,
  type PlanSession,
  type SeriesRow,
} from './recurrence.js';
import { dayIn, hhmm, minutesOnDay, parseHhmm } from './time.js';

export const SERIES_COLUMNS = 'id, plan_id, title, details, days, start_min, duration_min, start_date, end_date';
export const OCCURRENCE_COLUMNS = 'series_id, day, done_at, skipped, start_min, duration_min, title, details';
export const MAX_PLAN_SESSIONS = 14;
export const MAX_PLAN_WEEKS = 12;

/** Recurring-block occurrences between two days. Sessions of a paused plan are hidden from the day it was paused. */
export async function recurringBetween(ctx: Ctx, from: string, to: string): Promise<Occurrence[]> {
  const [{ data: series }, { data: rows }, { data: paused }] = await Promise.all([
    ctx.db.from('block_series').select(SERIES_COLUMNS).lte('start_date', to).gte('end_date', from).limit(200),
    ctx.db.from('series_occurrences').select(OCCURRENCE_COLUMNS).gte('day', from).lte('day', to).limit(2000),
    ctx.db.from('plans').select('id, paused_at').eq('status', 'paused'),
  ]);
  const pausedFrom = new Map((paused ?? []).map((p) => [p.id as string, p.paused_at ? dayIn(ctx.tz, new Date(p.paused_at)) : from]));
  return expandSeries((series ?? []) as SeriesRow[], (rows ?? []) as OccurrenceRow[], from, to).filter(
    (o) => !(o.plan_id && pausedFrom.has(o.plan_id) && o.day >= pausedFrom.get(o.plan_id)!),
  );
}

/** Everything that already takes time between two days: task blocks, recurring blocks, timed calendar events. */
export async function busyBetween(ctx: Ctx, from: string, to: string): Promise<{ busy: Busy[]; calendarErrors: string[] }> {
  const [{ data: blocks }, recurring, cal] = await Promise.all([
    ctx.db.from('tasks').select('title, sched_date, sched_start, sched_duration').gte('sched_date', from).lte('sched_date', to).limit(1000),
    recurringBetween(ctx, from, to),
    calendarEvents(ctx, from, to),
  ]);
  const busy: Busy[] = [];
  for (const b of blocks ?? []) busy.push({ day: b.sched_date, start: b.sched_start, end: b.sched_start + b.sched_duration, title: b.title, kind: 'block' });
  for (const o of recurring) busy.push({ day: o.day, start: o.start, end: o.start + o.duration, title: o.title, kind: 'recurring' });
  for (const e of cal.events) {
    if (e.allDay) continue;
    const endDay = dayIn(ctx.tz, new Date(new Date(e.end).getTime() - 1));
    for (let d = dayIn(ctx.tz, new Date(e.start)); d <= endDay && d <= to; d = addDaysKey(d, 1)) {
      if (d < from) continue;
      const s = minutesOnDay(e.start, d, ctx.tz) ?? 0;
      const en = endDay > d ? 1440 : minutesOnDay(e.end, d, ctx.tz) ?? 1440;
      busy.push({ day: d, start: s, end: en, title: e.title, kind: 'event' });
    }
  }
  return { busy, calendarErrors: cal.errors };
}

/**
 * Busy times summarised by weekday for the model: the same slot on several weeks
 * becomes one line ("18:00-19:00 Yoga (recurring, 4 of 4 weeks)"), so the text stays short.
 */
export function availabilityText(busy: Busy[], startDate: string, weeks: number) {
  const lines: string[] = [];
  for (let wd = 1; wd <= 7; wd++) {
    const slots = new Map<string, { start: number; end: number; title: string; kind: string; days: Set<string> }>();
    for (const b of busy) {
      if (isoWeekday(b.day) !== wd) continue;
      const key = `${b.start}-${b.end}-${b.title}`;
      if (!slots.has(key)) slots.set(key, { start: b.start, end: b.end, title: b.title, kind: b.kind, days: new Set() });
      slots.get(key)!.days.add(b.day);
    }
    const items = [...slots.values()].sort((a, b) => a.start - b.start).slice(0, 8);
    const label = { block: 'task block', recurring: 'recurring', event: 'calendar' } as Record<string, string>;
    lines.push(
      `${WEEKDAYS[wd - 1]}: ${
        items.length
          ? items.map((s) => `${hhmm(s.start)}-${hhmm(Math.min(s.end, 1440))} ${s.title.slice(0, 40)} (${label[s.kind]}, ${s.days.size} of ${weeks} wk${weeks === 1 ? '' : 's'})`).join('; ')
          : 'free'
      }`,
    );
  }
  return `Busy times ${startDate} to ${addDaysKey(startDate, weeks * 7 - 1)} by weekday:\n${lines.join('\n')}`;
}

/** Sessions that would overlap something already in the Planner or calendar. */
export function planConflicts(sessions: PlanSession[], startDate: string, weeks: number, busy: Busy[]) {
  return planOccurrences(sessions, startDate, weeks).flatMap((o) => {
    const hit = busy.find((b) => b.day === o.day && overlaps({ start: o.start, end: o.start + o.duration }, b));
    return hit ? [{ day: o.day, title: o.title, with: hit.title }] : [];
  });
}

const DAY_NAMES: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function parseWeekday(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7) return v;
  return DAY_NAMES[String(v ?? '').trim().slice(0, 3).toLowerCase()] ?? null;
}

/** Cleans sessions from the model: valid weekday, 15-minute grid, 15–240 min, inside the day, no duplicates. */
export function normalizeSessions(raw: unknown): PlanSession[] {
  const out: PlanSession[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const s = (r ?? {}) as Record<string, unknown>;
    const day = parseWeekday(s.day);
    const parsed = typeof s.start === 'number' ? s.start : parseHhmm(String(s.start ?? ''));
    const title = clip(s.title, 80);
    if (!day || parsed == null || !title) continue;
    const start = Math.round(parsed / 15) * 15;
    const duration = Math.min(Math.max(Math.round(Number(s.duration_min ?? s.duration ?? 30) / 15) * 15 || 30, 15), 240);
    if (start + duration > 1440) continue;
    if (out.some((o) => o.day === day && overlaps({ start, end: start + duration }, { start: o.start, end: o.start + o.duration }))) continue;
    out.push({ day, start, duration, title, details: clip(s.details, 160) });
    if (out.length >= MAX_PLAN_SESSIONS) break;
  }
  return out.sort((a, b) => a.day - b.day || a.start - b.start);
}

export const clampWeeks = (v: unknown) => Math.min(Math.max(Math.round(Number(v) || 4), 1), MAX_PLAN_WEEKS);
