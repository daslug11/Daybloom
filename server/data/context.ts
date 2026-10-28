import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthedRequest } from '../auth.js';
import { syncUserCalendars } from '../calendar/sync.js';
import type { SyncedEvent } from '../calendar/types.js';
import { RefMap } from './refs.js';
import { addDays, dayIn, hhmm, minutesOnDay, nowIn, safeTimeZone } from './time.js';

export interface Ctx {
  db: SupabaseClient;
  userId: string;
  refs: RefMap;
  tz: string;
  name: string;
  now: ReturnType<typeof nowIn>;
}

export interface TaskRow {
  id: string;
  title: string;
  done: boolean;
  priority: 'high' | 'medium' | 'low' | null;
  tags: string[];
  due_date: string | null;
  due_time: string | null;
  top_date: string | null;
  sched_date: string | null;
  sched_start: number | null;
  sched_duration: number | null;
  estimate_min: number | null;
  goal_id: string | null;
  completed_at: string | null;
}

export const TASK_COLUMNS =
  'id, title, done, priority, tags, due_date, due_time, top_date, sched_date, sched_start, sched_duration, estimate_min, goal_id, completed_at';

export async function loadCtx(auth: AuthedRequest): Promise<Ctx> {
  const { data } = await auth.db.from('profiles').select('name, timezone').single();
  const tz = safeTimeZone(data?.timezone);
  return { db: auth.db, userId: auth.user.id, refs: new RefMap(), tz, name: data?.name?.trim() || 'there', now: nowIn(tz) };
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function taskLine(ctx: Ctx, t: TaskRow): string {
  const bits = [`${ctx.refs.ref('T', t.id)} "${clip(t.title, 120)}"`];
  if (t.done) bits.push('done');
  if (t.due_date) bits.push(`due ${t.due_date}${t.due_time ? ' ' + t.due_time.slice(0, 5) : ''}`);
  if (t.priority) bits.push(t.priority);
  if (t.tags?.length) bits.push(t.tags.map((x) => '#' + x).join(' '));
  if (t.top_date === ctx.now.day) bits.push('top-3 today');
  if (t.sched_date && t.sched_start != null && t.sched_duration) {
    bits.push(`block ${t.sched_date} ${hhmm(t.sched_start)}-${hhmm(t.sched_start + t.sched_duration)}`);
  }
  if (t.estimate_min) bits.push(`~${t.estimate_min}m`);
  return bits.join(' · ');
}

/** Open tasks that matter today: top 3, due/overdue, scheduled today. */
export async function todaysTasks(ctx: Ctx): Promise<TaskRow[]> {
  const day = ctx.now.day;
  const { data } = await ctx.db
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('done', false)
    .is('parent_id', null)
    .or(`top_date.eq.${day},due_date.lte.${day},sched_date.eq.${day}`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(30);
  return (data ?? []) as TaskRow[];
}

export async function openTasks(ctx: Ctx, opts: { query?: string; limit?: number; upcomingDays?: number } = {}): Promise<TaskRow[]> {
  let q = ctx.db.from('tasks').select(TASK_COLUMNS).eq('done', false);
  if (opts.query) q = q.ilike('title', `%${opts.query.replace(/[%_,()]/g, ' ').trim()}%`);
  if (opts.upcomingDays != null) q = q.lte('due_date', addDays(ctx.now.day, opts.upcomingDays)).gte('due_date', ctx.now.day);
  const { data } = await q.order('due_date', { ascending: true, nullsFirst: false }).order('created_at').limit(opts.limit ?? 25);
  return (data ?? []) as TaskRow[];
}

export interface HabitStatus {
  id: string;
  name: string;
  emoji: string;
  doneToday: boolean;
  streak: number;
  last7: number;
}

export async function habitStatus(ctx: Ctx): Promise<HabitStatus[]> {
  const since = addDays(ctx.now.day, -60);
  const [{ data: habits }, { data: logs }] = await Promise.all([
    ctx.db.from('habits').select('id, name, emoji').is('archived_at', null).order('sort').limit(30),
    ctx.db.from('habit_logs').select('habit_id, day').gte('day', since),
  ]);
  const byHabit = new Map<string, Set<string>>();
  for (const l of logs ?? []) {
    if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, new Set());
    byHabit.get(l.habit_id)!.add(l.day);
  }
  return (habits ?? []).map((h) => {
    const days = byHabit.get(h.id) ?? new Set<string>();
    let streak = 0;
    let d = days.has(ctx.now.day) ? ctx.now.day : addDays(ctx.now.day, -1);
    while (days.has(d)) {
      streak++;
      d = addDays(d, -1);
    }
    let last7 = 0;
    for (let i = 0; i < 7; i++) if (days.has(addDays(ctx.now.day, -i))) last7++;
    return { id: h.id, name: h.name, emoji: h.emoji, doneToday: days.has(ctx.now.day), streak, last7 };
  });
}

export function habitLine(ctx: Ctx, h: HabitStatus) {
  return `${ctx.refs.ref('H', h.id)} ${h.emoji} ${h.name} — ${h.doneToday ? 'done today' : 'not done today'} · streak ${h.streak} · ${h.last7}/7 last week`;
}

export async function inboxCount(ctx: Ctx) {
  const { count } = await ctx.db.from('notes').select('id', { count: 'exact', head: true }).eq('state', 'inbox');
  return count ?? 0;
}

/** Synced calendar events between two days (inclusive), in the user's zone. Never throws. */
export async function calendarEvents(ctx: Ctx, fromDay: string, toDay: string): Promise<{ events: SyncedEvent[]; errors: string[] }> {
  try {
    const from = new Date(`${fromDay}T00:00:00Z`);
    from.setUTCHours(from.getUTCHours() - 14);
    const to = new Date(`${toDay}T23:59:59Z`);
    to.setUTCHours(to.getUTCHours() + 14);
    const res = await Promise.race([
      syncUserCalendars(ctx.db, { from: from.toISOString(), to: to.toISOString() }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    const events = res.results.flatMap((r) => r.events).filter((e) => {
      const startDay = e.allDay ? e.start : dayIn(ctx.tz, new Date(e.start));
      const endDay = e.allDay ? addDays(e.end, -1) : dayIn(ctx.tz, new Date(e.end));
      return endDay >= fromDay && startDay <= toDay;
    });
    const errors = res.results.filter((r) => !r.ok).map((r) => r.error ?? 'sync failed');
    return { events, errors };
  } catch {
    return { events: [], errors: ['Calendar sync timed out.'] };
  }
}

export function eventLine(ctx: Ctx, e: SyncedEvent, day: string) {
  if (e.allDay) return `all day: ${clip(e.title, 80)} (calendar)`;
  const s = minutesOnDay(e.start, day, ctx.tz) ?? 0;
  const endDay = dayIn(ctx.tz, new Date(e.end));
  const en = endDay > day ? 1440 : minutesOnDay(e.end, day, ctx.tz) ?? 1440;
  return `${hhmm(s)}-${hhmm(Math.min(en, 1440))} ${clip(e.title, 80)} (calendar, fixed)`;
}

/** Compact text snapshot of the user's day, used by Atlas and the daily briefing. */
export async function overviewText(ctx: Ctx, opts: { events?: boolean } = {}): Promise<string> {
  const day = ctx.now.day;
  const [tasks, habits, inbox, mood, cal] = await Promise.all([
    todaysTasks(ctx),
    habitStatus(ctx),
    inboxCount(ctx),
    ctx.db.from('moods').select('score').eq('day', day).maybeSingle(),
    opts.events === false ? Promise.resolve({ events: [] as SyncedEvent[], errors: [] as string[] }) : calendarEvents(ctx, day, day),
  ]);
  const top = tasks.filter((t) => t.top_date === day);
  const due = tasks.filter((t) => t.top_date !== day && t.due_date && t.due_date <= day);
  const blocks = tasks
    .filter((t) => t.sched_date === day && t.sched_start != null)
    .map((t) => ({ start: t.sched_start!, line: `${hhmm(t.sched_start!)}-${hhmm(t.sched_start! + t.sched_duration!)} ${ctx.refs.ref('T', t.id)} "${clip(t.title, 80)}" (task block)` }));
  const events = cal.events.map((e) => ({ start: e.allDay ? -1 : minutesOnDay(e.start, day, ctx.tz) ?? 0, line: eventLine(ctx, e, day) }));
  const schedule = [...blocks, ...events].sort((a, b) => a.start - b.start).map((x) => x.line);

  const lines = [
    `Now: ${ctx.now.weekday} ${day} ${ctx.now.time} (${ctx.tz})`,
    `Top 3 today: ${top.length ? '\n' + top.map((t) => '- ' + taskLine(ctx, t)).join('\n') : 'none picked'}`,
    `Due or overdue: ${due.length ? '\n' + due.map((t) => '- ' + taskLine(ctx, t)).join('\n') : 'nothing'}`,
    `Schedule today: ${schedule.length ? '\n' + schedule.map((s) => '- ' + s).join('\n') : 'nothing scheduled'}`,
    `Habits: ${habits.length ? '\n' + habits.map((h) => '- ' + habitLine(ctx, h)).join('\n') : 'none set up'}`,
    `Brain dump inbox: ${inbox} unprocessed note${inbox === 1 ? '' : 's'}`,
    `Mood today: ${mood.data ? `${mood.data.score}/5` : 'not checked in'}`,
  ];
  if (cal.errors.length) lines.push(`(Calendar sync problems: ${cal.errors.length})`);
  return lines.join('\n');
}
