/**
 * Shared counting rules for the numbers on Habits, Focus, Mood and the Weekly Review.
 * Every page that shows the same kind of number uses the same function, so they can't disagree.
 */
import { addDays, dayIn } from './dates';

/** How a habit streak is counted (shown next to every streak). */
export const STREAK_RULE = 'Days in a row you’ve done it, ending today — or ending yesterday if you haven’t logged today yet.';

/**
 * The first day a habit "counts" from: the day it was created, or an earlier logged day
 * (history can be imported or ticked in before the habit existed).
 */
export function habitStartDay(createdDay: string, logDays: Iterable<string>) {
  let start = createdDay;
  for (const d of logDays) if (d < start) start = d;
  return start;
}

/**
 * Habit-days in `days`: a day can be counted once the habit has started; today only once
 * it's done (the day isn't over, so it can't be a miss yet). Future days never count.
 */
export function habitDays({ start, logDays, days, today }: { start: string; logDays: Set<string>; days: string[]; today: string }) {
  let done = 0;
  let possible = 0;
  for (const d of days) {
    if (d < start || d > today) continue;
    const hit = logDays.has(d);
    if (d === today && !hit) continue;
    possible++;
    if (hit) done++;
  }
  return { done, possible };
}

/** The last `n` day keys ending with `today`, oldest first. */
export function lastDays(today: string, n = 7) {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

/**
 * "5 of the last 7 days", or — for a habit younger than a week — "2 of 3 days since you started".
 * Uses `habitDays`, so it matches the Weekly Review.
 */
export function habitWeekLabel(start: string, logDays: Set<string>, today: string) {
  const days = lastDays(today, 7);
  const { done, possible } = habitDays({ start, logDays, days, today });
  if (start <= days[0]) return `${done} of the last 7 days`;
  if (!possible) return 'Started today';
  return `${done} of ${possible} day${possible === 1 ? '' : 's'} since you started`;
}

/** Mean of 1–5 scores, or null when there are none (never a fake 0). */
export function meanScore(scores: number[]) {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

export interface FocusSessionLike {
  task_id: string | null;
  started_at: string;
  minutes: number;
}

/**
 * Focus minutes for the 7 days ending today, by day and by task. `noTask` holds the minutes
 * logged without a task, so the per-task rows plus `noTask` add up to `weekTotal`.
 */
export function focusStats(sessions: FocusSessionLike[], today: string, tz: string | undefined, top = 5) {
  const days = lastDays(today, 7);
  const byDay = new Map<string, number>();
  const byTask = new Map<string, number>();
  let noTask = 0;
  for (const s of sessions) {
    const d = dayIn(tz, new Date(s.started_at));
    if (d < days[0] || d > today) continue;
    byDay.set(d, (byDay.get(d) ?? 0) + s.minutes);
    if (s.task_id) byTask.set(s.task_id, (byTask.get(s.task_id) ?? 0) + s.minutes);
    else noTask += s.minutes;
  }
  const week = days.map((day) => ({ day, minutes: byDay.get(day) ?? 0 }));
  const ranked = [...byTask.entries()].sort((a, b) => b[1] - a[1]);
  const topTasks = ranked.slice(0, top);
  const otherTasks = ranked.slice(top).reduce((a, [, m]) => a + m, 0);
  return {
    today: byDay.get(today) ?? 0,
    week,
    weekTotal: week.reduce((a, w) => a + w.minutes, 0),
    topTasks,
    otherTasks,
    otherTaskCount: Math.max(0, ranked.length - top),
    noTask,
  };
}

/** "3 more than the 7 days before" / "2 fewer than …" / "Same as …" for a count delta. */
export function deltaText(delta: number, what = 'the 7 days before') {
  if (delta === 0) return `Same as ${what}`;
  return `${Math.abs(delta)} ${delta > 0 ? 'more' : 'fewer'} than ${what}`;
}
