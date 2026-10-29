/**
 * Recurring Planner blocks and Atlas plans: pure date logic shared by the
 * server (Atlas tools) and the app (Planner, plan cards). No imports on purpose.
 *
 * Days are 'YYYY-MM-DD' keys in the user's time zone; times are minutes since
 * midnight; weekdays are ISO (1 = Monday … 7 = Sunday).
 */

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** One session in a plan's weekly template. */
export interface PlanSession {
  day: number;
  start: number;
  duration: number;
  title: string;
  details: string;
}

export interface SeriesRow {
  id: string;
  plan_id: string | null;
  title: string;
  details: string;
  days: number[];
  start_min: number;
  duration_min: number;
  start_date: string;
  end_date: string;
}

export interface OccurrenceRow {
  series_id: string;
  day: string;
  done_at: string | null;
  skipped: boolean;
  start_min: number | null;
  duration_min: number | null;
  title: string | null;
  details: string | null;
}

export interface Occurrence {
  series_id: string;
  plan_id: string | null;
  day: string;
  start: number;
  duration: number;
  title: string;
  details: string;
  done: boolean;
  skipped: boolean;
  /** Has a "this one only" change. */
  edited: boolean;
}

export interface Busy {
  day: string;
  start: number;
  end: number;
  title: string;
  kind: 'block' | 'recurring' | 'event';
}

export function addDaysKey(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isoWeekday(day: string): number {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

export const planEndDate = (startDate: string, weeks: number) => addDaysKey(startDate, weeks * 7 - 1);
export const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** Every dated occurrence of the given series between two days (inclusive), with per-day changes applied. */
export function expandSeries(series: SeriesRow[], rows: OccurrenceRow[], from: string, to: string, opts: { withSkipped?: boolean } = {}): Occurrence[] {
  const byKey = new Map(rows.map((r) => [`${r.series_id}:${r.day}`, r]));
  const out: Occurrence[] = [];
  for (const s of series) {
    const lo = s.start_date > from ? s.start_date : from;
    const hi = s.end_date < to ? s.end_date : to;
    for (let d = lo; d <= hi; d = addDaysKey(d, 1)) {
      if (!s.days.includes(isoWeekday(d))) continue;
      const r = byKey.get(`${s.id}:${d}`);
      if (r?.skipped && !opts.withSkipped) continue;
      out.push({
        series_id: s.id,
        plan_id: s.plan_id,
        day: d,
        start: r?.start_min ?? s.start_min,
        duration: r?.duration_min ?? s.duration_min,
        title: r?.title ?? s.title,
        details: r?.details ?? s.details,
        done: !!r?.done_at,
        skipped: !!r?.skipped,
        edited: !!r && (r.start_min != null || r.duration_min != null || r.title != null || r.details != null),
      });
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);
}

/** Sessions with the same time and content become one weekly series on several days. */
export function groupSessions(sessions: PlanSession[]) {
  const groups = new Map<string, { days: number[]; start: number; duration: number; title: string; details: string }>();
  for (const s of sessions) {
    const key = JSON.stringify([s.start, s.duration, s.title, s.details]);
    const g = groups.get(key);
    if (g) {
      if (!g.days.includes(s.day)) g.days.push(s.day);
    } else groups.set(key, { days: [s.day], start: s.start, duration: s.duration, title: s.title, details: s.details });
  }
  return [...groups.values()].map((g) => ({ ...g, days: g.days.sort((a, b) => a - b) }));
}

/** The dated sessions a plan would put on the Planner. */
export function planOccurrences(sessions: PlanSession[], startDate: string, weeks: number) {
  const end = planEndDate(startDate, weeks);
  const out: { day: string; start: number; duration: number; title: string; details: string; session: number }[] = [];
  for (let d = startDate; d <= end; d = addDaysKey(d, 1)) {
    sessions.forEach((s, i) => {
      if (s.day === isoWeekday(d)) out.push({ day: d, start: s.start, duration: s.duration, title: s.title, details: s.details, session: i });
    });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);
}

/** Nearest free start on the same day (15-minute steps, within waking hours), or null. */
export function findFreeSlot(busy: { start: number; end: number }[], start: number, duration: number, earliest = 6 * 60, latest = 22 * 60): number | null {
  const fits = (s: number) => s >= earliest && s + duration <= latest && !busy.some((b) => overlaps({ start: s, end: s + duration }, b));
  for (let step = 0; step <= 16 * 4; step++) {
    for (const s of step === 0 ? [start] : [start + step * 15, start - step * 15]) if (fits(s)) return s;
  }
  return null;
}

export function time12(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Mon 6:00 PM · 45 min · Leg day: squats, lunges" */
export function sessionLine(s: Pick<PlanSession, 'day' | 'start' | 'duration' | 'title' | 'details'>) {
  return `${WEEKDAYS[s.day - 1]} ${time12(s.start)} · ${s.duration} min · ${s.title}${s.details ? `: ${s.details}` : ''}`;
}

export const weeksLabel = (weeks: number) => (weeks === 1 ? '1 week' : `${weeks} weeks`);

/** "Week 2 of 4 · 5 of 12 sessions done" numbers. Skipped sessions don't count. */
export function planProgress(startDate: string, weeks: number, occurrences: Occurrence[], today: string) {
  const counted = occurrences.filter((o) => !o.skipped);
  const elapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
  const week = elapsed < 0 ? 0 : Math.min(weeks, Math.floor(elapsed / 7) + 1);
  return { week, weeks, done: counted.filter((o) => o.done).length, total: counted.length, finished: today > planEndDate(startDate, weeks) };
}
