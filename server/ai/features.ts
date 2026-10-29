import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AuthedRequest } from '../auth.js';
import {
  calendarEvents,
  habitStatus,
  loadCtx,
  openTasks,
  overviewText,
  TASK_COLUMNS,
  taskLine,
  type Ctx,
  type TaskRow,
} from '../data/context.js';
import { addDays, dayIn, hhmm, minutesOnDay, parseHhmm, weekStart } from '../data/time.js';
import { HttpError } from '../http.js';
import { cached, runStructured, type AiResult } from './run.js';

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const date = z.string().describe('YYYY-MM-DD');
// Structured outputs can't enforce enums or array sizes, so schemas stay lenient
// and the results are normalized in code below.
const priority = z.string().describe('high | medium | low');
const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(String(value).toLowerCase() as T) ? (String(value).toLowerCase() as T) : fallback;
const prio = (v: unknown) => (v == null ? null : oneOf(v, ['high', 'medium', 'low'] as const, 'medium'));
const minutes = (v: unknown) => (typeof v === 'number' && v > 0 && v <= 600 ? Math.round(v) : null);
const cleanTitle = (v: unknown, n = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

function system(ctx: Ctx, job: string) {
  return [
    `You help ${ctx.name} with Daybloom, a personal planner. ${job}`,
    `Today is ${ctx.now.weekday} ${ctx.now.day}, time zone ${ctx.tz}. Dates are YYYY-MM-DD.`,
    'Be concise and concrete. Use the user\'s own words. Never invent facts not in the data.',
  ].join('\n');
}

async function noteById(ctx: Ctx, id: unknown) {
  if (typeof id !== 'string') throw new HttpError(400, 'Missing note.');
  const { data } = await ctx.db.from('notes').select('id, body, updated_at').eq('id', id).maybeSingle();
  if (!data) throw new HttpError(404, 'That note no longer exists.');
  return data;
}

async function taskById(ctx: Ctx, id: unknown): Promise<TaskRow & { details: string }> {
  if (typeof id !== 'string') throw new HttpError(400, 'Missing task.');
  const { data } = await ctx.db.from('tasks').select(`${TASK_COLUMNS}, details`).eq('id', id).maybeSingle();
  if (!data) throw new HttpError(404, 'That task no longer exists.');
  return data as TaskRow & { details: string };
}

async function recentNotes(ctx: Ctx, days: number, limit: number, clipTo: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await ctx.db
    .from('notes')
    .select('id, body, created_at, updated_at')
    .neq('state', 'archived')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  const notes = data ?? [];
  const text = notes.map((n) => `${ctx.refs.ref('N', n.id)} (${dayIn(ctx.tz, new Date(n.created_at))}): ${clip(n.body.replace(/\s+/g, ' '), clipTo)}`).join('\n');
  const key = hash(notes.map((n) => n.id + n.updated_at).join('|'));
  return { notes, text, key };
}

// ---------------------------------------------------------------------------
// Brain dump
// ---------------------------------------------------------------------------
const OrganizeOut = z.object({
  suggestions: z.array(
    z.object({
      note: z.string().describe('note ref like N1'),
      kind: z.string().describe('task | reminder | idea | journal | reference'),
      title: z.string().describe('short task or idea title, ≤ 80 chars'),
      due_date: date.nullable().describe('only for reminders/tasks with a clear date'),
      reason: z.string().describe('≤ 12 words'),
    }),
  ),
});

async function organizeInbox(auth: AuthedRequest) {
  const ctx = await loadCtx(auth);
  const { data } = await ctx.db.from('notes').select('id, body').eq('state', 'inbox').order('created_at').limit(25);
  if (!data?.length) throw new HttpError(400, 'Your inbox is empty — nothing to organize.');
  const list = data.map((n) => `${ctx.refs.ref('N', n.id)}: ${clip(n.body.replace(/\s+/g, ' '), 400)}`).join('\n');
  const { result, remaining } = await runStructured(auth, 'organize_inbox', {
    system: system(ctx, 'Sort brain-dump notes. kind: task = something to do; reminder = a task tied to a date/time; idea = something to maybe pursue later; journal = feelings/reflection; reference = info to keep.'),
    prompt: `Classify each inbox note exactly once.\n${list}`,
    schema: OrganizeOut,
  });
  const seen = new Set<string>();
  const suggestions = result.suggestions
    .map((s) => ({
      note_id: ctx.refs.resolve('N', s.note),
      kind: oneOf(s.kind, ['task', 'reminder', 'idea', 'journal', 'reference'] as const, 'idea'),
      title: cleanTitle(s.title, 120),
      due_date: isDay(s.due_date) ? s.due_date : null,
      reason: cleanTitle(s.reason, 120),
    }))
    .filter((s) => s.note_id && !seen.has(s.note_id) && seen.add(s.note_id));
  return { result: { suggestions }, remaining, cached: false };
}

const ExtractOut = z.object({
  actions: z.array(z.object({ title: z.string(), due_date: date.nullable(), priority: priority.nullable() })).describe('at most 12'),
});

async function extractActions(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  const note = await noteById(ctx, input.note_id);
  const { result, remaining } = await runStructured(auth, 'extract_actions', {
    system: system(ctx, 'Pull concrete to-dos out of a messy note. Each title starts with a verb. Skip vague wishes. Only set a date or priority if the note says so.'),
    prompt: clip(note.body, 6000),
    schema: ExtractOut,
  });
  const actions = result.actions
    .slice(0, 12)
    .map((a) => ({ title: cleanTitle(a.title, 300), due_date: isDay(a.due_date) ? a.due_date : null, priority: prio(a.priority) }))
    .filter((a) => a.title);
  return { result: { actions }, remaining, cached: false };
}

const SummaryOut = z.object({ summary: z.string().describe('2-3 sentences'), key_points: z.array(z.string()).describe('at most 6') });

async function summarize(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  if (input.scope === 'week') {
    const notes = await recentNotes(ctx, 7, 40, 300);
    if (!notes.notes.length) throw new HttpError(400, 'No notes from the last 7 days to summarize.');
    return cached(auth, 'summarize_week', notes.key, !!input.force, () =>
      runStructured(auth, 'summarize', {
        system: system(ctx, "Summarize the user's notes from the past week: what they were thinking about and what's unresolved."),
        prompt: notes.text,
        schema: SummaryOut,
      }),
    );
  }
  const note = await noteById(ctx, input.note_id);
  return cached(auth, 'summarize_note', hash(note.id + note.updated_at), !!input.force, () =>
    runStructured(auth, 'summarize', {
      system: system(ctx, 'Condense a long note. Keep decisions, numbers, names and open questions.'),
      prompt: clip(note.body, 12000),
      schema: SummaryOut,
    }),
  );
}

const PatternsOut = z.object({
  themes: z.array(z.object({ theme: z.string(), evidence: z.string().describe('which notes, briefly'), suggestion: z.string() })).describe('at most 4'),
});

async function findPatterns(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  const notes = await recentNotes(ctx, 30, 50, 250);
  if (notes.notes.length < 3) throw new HttpError(400, 'Capture a few more notes first — patterns need at least 3 notes from the last 30 days.');
  return cached(auth, 'find_patterns', notes.key, !!input.force, () =>
    runStructured(auth, 'find_patterns', {
      system: system(ctx, 'Spot recurring themes across recent notes (topics that keep coming back, repeated worries, stalled ideas). Only report themes that appear in at least two notes.'),
      prompt: notes.text,
      schema: PatternsOut,
    }),
  );
}

const PlanOut = z.object({
  title: z.string().describe('goal-style title for the idea'),
  steps: z.array(z.object({ title: z.string(), estimate_min: z.number().nullable() })).describe('3 to 8 steps'),
});

async function planFromIdea(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  const note = await noteById(ctx, input.note_id);
  const { result, remaining } = await runStructured(auth, 'plan_from_idea', {
    system: system(ctx, 'Turn an idea into a short, realistic step-by-step plan. First step should be doable today. Steps start with a verb.'),
    prompt: clip(note.body, 4000),
    schema: PlanOut,
  });
  const steps = result.steps.slice(0, 8).map((s) => ({ title: cleanTitle(s.title, 300), estimate_min: minutes(s.estimate_min) })).filter((s) => s.title);
  return { result: { title: cleanTitle(result.title, 200), steps }, remaining, cached: false };
}

// ---------------------------------------------------------------------------
// Tasks & planning
// ---------------------------------------------------------------------------
const ParseOut = z.object({
  title: z.string(),
  due_date: date.nullable(),
  due_time: z.string().nullable().describe('HH:MM 24h'),
  priority: priority.nullable(),
  tags: z.array(z.string()),
  estimate_min: z.number().nullable(),
});

async function parseTask(auth: AuthedRequest, input: Record<string, unknown>) {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text || text.length > 500) throw new HttpError(400, 'Type what you want to add (up to 500 characters).');
  const ctx = await loadCtx(auth);
  const { result, remaining } = await runStructured(auth, 'parse_task', {
    system: system(ctx, 'Turn a quick-add sentence into a task. Resolve relative dates ("next Friday") against today. Leave fields null when not stated.'),
    prompt: text,
    schema: ParseOut,
    maxTokens: 500,
  });
  return {
    result: {
      title: cleanTitle(result.title, 300) || text.slice(0, 300),
      due_date: isDay(result.due_date) ? result.due_date : null,
      due_time: result.due_time && parseHhmm(result.due_time) != null ? hhmm(parseHhmm(result.due_time)!) : null,
      priority: prio(result.priority),
      tags: result.tags.slice(0, 5).map((t) => t.replace(/^#/, '').toLowerCase().trim()).filter(Boolean),
      estimate_min: minutes(result.estimate_min),
    },
    remaining,
    cached: false,
  };
}

const BreakdownOut = z.object({ subtasks: z.array(z.object({ title: z.string(), estimate_min: z.number().nullable() })).describe('2 to 8 subtasks') });

async function breakDown(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  const task = await taskById(ctx, input.task_id);
  const { result, remaining } = await runStructured(auth, 'break_down', {
    system: system(ctx, 'Break a task into small, concrete subtasks (each 5–60 minutes), in order. Start each with a verb.'),
    prompt: `Task: ${task.title}${task.details ? `\nDetails: ${clip(task.details, 1500)}` : ''}`,
    schema: BreakdownOut,
  });
  const subtasks = result.subtasks.slice(0, 8).map((s) => ({ title: cleanTitle(s.title, 300), estimate_min: minutes(s.estimate_min) })).filter((s) => s.title);
  return { result: { subtasks }, remaining, cached: false };
}

const PlanBlocksOut = z.object({
  blocks: z.array(
    z.object({
      task: z.string().describe('task ref like T1'),
      date: date,
      start: z.string().describe('HH:MM 24h'),
      duration_min: z.number(),
      reason: z.string().describe('≤ 10 words'),
    }),
  ),
});

interface Fixed {
  date: string;
  start: number;
  end: number;
}

/** ✨ Plan my day / week: proposes ghost blocks the user can accept. Never writes. */
async function planBlocks(auth: AuthedRequest, input: Record<string, unknown>, scope: 'day' | 'week') {
  const ctx = await loadCtx(auth);
  const first = scope === 'day' ? (isDay(input.date) ? input.date : ctx.now.day) : weekStart(isDay(input.date) ? input.date : ctx.now.day);
  const days = scope === 'day' ? [first] : Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const last = days[days.length - 1];
  const startHour = Math.min(Math.max(Number(input.day_start ?? 8), 5), 12);
  const endHour = Math.min(Math.max(Number(input.day_end ?? 18), 13), 23);

  const [candidates, scheduled, cal] = await Promise.all([
    ctx.db
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('done', false)
      .is('sched_date', null)
      .or(`top_date.gte.${ctx.now.day},due_date.lte.${addDays(last, 3)},priority.eq.high,due_date.is.null`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(25),
    ctx.db.from('tasks').select('id, title, sched_date, sched_start, sched_duration').gte('sched_date', first).lte('sched_date', last),
    calendarEvents(ctx, first, last),
  ]);
  const tasks = (candidates.data ?? []) as TaskRow[];
  if (!tasks.length) throw new HttpError(400, 'No unscheduled open tasks to plan. Add some tasks first.');

  const fixed: Fixed[] = [];
  for (const b of scheduled.data ?? []) fixed.push({ date: b.sched_date, start: b.sched_start, end: b.sched_start + b.sched_duration });
  for (const e of cal.events) {
    if (e.allDay) continue;
    for (const d of days) {
      const s = minutesOnDay(e.start, d, ctx.tz);
      if (s == null) continue;
      const endDay = dayIn(ctx.tz, new Date(e.end));
      if (endDay < d) continue;
      const en = endDay > d ? 1440 : minutesOnDay(e.end, d, ctx.tz) ?? 1440;
      fixed.push({ date: d, start: s, end: en });
    }
  }
  const busy = days
    .map((d) => {
      const items = fixed.filter((f) => f.date === d).sort((a, b) => a.start - b.start);
      return `${d}: ${items.length ? items.map((f) => `${hhmm(f.start)}-${hhmm(Math.min(f.end, 1440))}`).join(', ') : 'free'}`;
    })
    .join('\n');
  const notBefore = days.includes(ctx.now.day) ? Math.ceil((ctx.now.minutes + 5) / 15) * 15 : 0;

  const { result, remaining } = await runStructured(auth, scope === 'day' ? 'plan_day' : 'plan_week', {
    system: system(
      ctx,
      `Time-block tasks into free time between ${hhmm(startHour * 60)} and ${hhmm(endHour * 60)}. Never overlap busy times. Start times on 15-minute marks. Do important and due-soon work first; use estimates when given (else 30–60 min). Leave small gaps. It's fine to leave tasks unscheduled.`,
    ),
    prompt: [
      `Plan ${scope === 'day' ? `the day ${first}` : `the week ${first} to ${last}`}.`,
      notBefore ? `It is now ${ctx.now.time} on ${ctx.now.day}; nothing earlier than ${hhmm(notBefore)} today.` : '',
      `Busy times:\n${busy}`,
      `Tasks:\n${tasks.map((t) => '- ' + taskLine(ctx, t)).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n'),
    schema: PlanBlocksOut,
  });

  // Validate: real task, inside the range, on the grid, no overlaps with busy time or each other.
  const accepted: { task_id: string; title: string; date: string; start: number; duration: number; reason: string }[] = [];
  const taken = [...fixed];
  const usedTasks = new Set<string>();
  for (const b of result.blocks) {
    const taskId = ctx.refs.resolve('T', b.task);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || usedTasks.has(task.id) || !days.includes(b.date)) continue;
    const startRaw = parseHhmm(b.start);
    if (startRaw == null) continue;
    const start = Math.round(startRaw / 15) * 15;
    const duration = Math.min(Math.max(Math.round((b.duration_min || 30) / 15) * 15, 15), 240);
    if (b.date === ctx.now.day && start < notBefore) continue;
    if (start + duration > 1440) continue;
    if (taken.some((f) => f.date === b.date && start < f.end && f.start < start + duration)) continue;
    taken.push({ date: b.date, start, end: start + duration });
    usedTasks.add(task.id);
    accepted.push({ task_id: task.id, title: task.title, date: b.date, start, duration, reason: clip(b.reason, 80) });
  }
  return { result: { blocks: accepted }, remaining, cached: false };
}

// ---------------------------------------------------------------------------
// Habits & goals
// ---------------------------------------------------------------------------
const HabitSuggestOut = z.object({
  habits: z.array(z.object({ name: z.string(), emoji: z.string(), why: z.string().describe('≤ 15 words'), goal: z.string().nullable().describe('goal ref like G1') })).describe('at most 4'),
});

async function suggestHabits(auth: AuthedRequest) {
  const ctx = await loadCtx(auth);
  const [{ data: goals }, habits, profile] = await Promise.all([
    ctx.db.from('goals').select('id, title, target, current, unit').is('completed_at', null).limit(10),
    habitStatus(ctx),
    ctx.db.from('profiles').select('focus_areas').single(),
  ]);
  if (!goals?.length) throw new HttpError(400, 'Add a goal first — habit suggestions are based on your goals.');
  const { result, remaining } = await runStructured(auth, 'suggest_habits', {
    system: system(ctx, 'Suggest small daily habits (doable in under 20 minutes) that move the user toward their goals. Don\'t repeat existing habits.'),
    prompt: [
      `Goals:\n${goals.map((g) => `${ctx.refs.ref('G', g.id)} ${g.title} (${g.current}/${g.target} ${g.unit})`).join('\n')}`,
      `Existing habits: ${habits.map((h) => h.name).join(', ') || 'none'}`,
      profile.data?.focus_areas?.length ? `Wants help with: ${profile.data.focus_areas.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: HabitSuggestOut,
  });
  return {
    result: {
      habits: result.habits
        .slice(0, 4)
        .map((h) => ({ name: cleanTitle(h.name, 120), emoji: [...(h.emoji ?? '')][0] ?? '✅', why: cleanTitle(h.why, 160), goal_id: ctx.refs.resolve('G', h.goal) }))
        .filter((h) => h.name),
    },
    remaining,
    cached: false,
  };
}

const GoalPlanOut = z.object({
  milestones: z
    .array(z.object({ title: z.string(), tasks: z.array(z.object({ title: z.string(), due_in_days: z.number().nullable() })).describe('up to 4') }))
    .describe('2 to 5 milestones'),
});

async function goalPlan(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  if (typeof input.goal_id !== 'string') throw new HttpError(400, 'Missing goal.');
  const { data: goal } = await ctx.db.from('goals').select('id, title, target, current, unit, due_date').eq('id', input.goal_id).maybeSingle();
  if (!goal) throw new HttpError(404, 'That goal no longer exists.');
  const { result, remaining } = await runStructured(auth, 'goal_plan', {
    system: system(ctx, 'Plan a goal as 2–5 milestones, each with up to 4 concrete next tasks. due_in_days counts from today.'),
    prompt: `Goal: ${goal.title}. Progress ${goal.current}/${goal.target} ${goal.unit}.${goal.due_date ? ` Deadline ${goal.due_date}.` : ''}`,
    schema: GoalPlanOut,
  });
  const milestones = result.milestones
    .slice(0, 5)
    .map((m) => ({
      title: cleanTitle(m.title, 200),
      tasks: m.tasks
        .slice(0, 4)
        .map((t) => ({
          title: cleanTitle(t.title, 300),
          due_date: typeof t.due_in_days === 'number' && t.due_in_days >= 0 && t.due_in_days < 730 ? addDays(ctx.now.day, Math.round(t.due_in_days)) : null,
        }))
        .filter((t) => t.title),
    }))
    .filter((m) => m.title);
  return { result: { milestones }, remaining, cached: false };
}

// ---------------------------------------------------------------------------
// Dashboard, mood & review
// ---------------------------------------------------------------------------
const BriefingOut = z.object({
  headline: z.string().describe('one sentence on the shape of the day'),
  focus: z.array(z.string()).describe('up to 3 things to focus on'),
  heads_up: z.array(z.string()).describe('up to 3 conflicts, overdue items, things to prepare'),
});

async function dailyBriefing(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  return cached(auth, 'daily_briefing', ctx.now.day, !!input.force, async () => {
    const overview = await overviewText(ctx);
    const r = await runStructured(auth, 'daily_briefing', {
      system: system(ctx, 'Write a short morning briefing from the user\'s data. Refer to tasks and events by name, not ref. If the day is empty, say so kindly and suggest one useful thing.'),
      prompt: overview,
      schema: BriefingOut,
    });
    return { ...r, result: { headline: r.result.headline, focus: r.result.focus.slice(0, 3), heads_up: r.result.heads_up.slice(0, 3) } };
  });
}

const ReflectOut = z.object({ reflection: z.string().describe('2-3 warm, specific sentences'), suggestion: z.string().describe('one small idea') });

async function reflect(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  const since = addDays(ctx.now.day, -13);
  const { data: moods } = await ctx.db.from('moods').select('day, score, note').gte('day', since).order('day');
  if (!moods || moods.length < 3) throw new HttpError(400, 'Check in on at least 3 days first so there is something to reflect on.');
  const habits = await habitStatus(ctx);
  const key = hash(moods.map((m) => `${m.day}${m.score}${m.note}`).join('|'));
  return cached(auth, 'reflect', key, !!input.force, () =>
    runStructured(auth, 'reflect', {
      system: system(ctx, 'Reflect on the user\'s mood check-ins like a thoughtful friend: notice trends and links to habits. Not medical advice; no diagnosis.'),
      prompt: [
        `Mood (1-5) last 14 days:\n${moods.map((m) => `${m.day}: ${m.score}${m.note ? ` — ${clip(m.note, 160)}` : ''}`).join('\n')}`,
        habits.length ? `Habits last 7 days: ${habits.map((h) => `${h.name} ${h.last7}/7`).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      schema: ReflectOut,
    }),
  );
}

const WeeklyOut = z.object({ summary: z.string().describe('3-4 sentences'), suggestions: z.array(z.string()).describe('exactly 3') });

async function weeklySummary(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  const stats = input.stats;
  if (!stats || typeof stats !== 'object') throw new HttpError(400, 'Missing weekly stats.');
  const statsText = JSON.stringify(stats).slice(0, 3000);
  const week = isDay(input.week_start) ? input.week_start : weekStart(ctx.now.day);
  return cached(auth, 'weekly_summary', `${week}:${hash(statsText)}`, !!input.force, async () => {
    const r = await runStructured(auth, 'weekly_summary', {
      system: system(ctx, 'Write a weekly review from these stats: what went well, what slipped, and exactly 3 specific, small suggestions for next week.'),
      prompt: `Week starting ${week}:\n${statsText}`,
      schema: WeeklyOut,
    });
    return { ...r, result: { summary: r.result.summary, suggestions: r.result.suggestions.slice(0, 3) } };
  });
}

// ---------------------------------------------------------------------------
export const FEATURES = {
  organize_inbox: (a: AuthedRequest) => organizeInbox(a),
  extract_actions: extractActions,
  summarize: async (a: AuthedRequest, i: Record<string, unknown>) => {
    const r = await summarize(a, i);
    return { ...r, result: { summary: r.result.summary, key_points: r.result.key_points.slice(0, 6) } };
  },
  find_patterns: async (a: AuthedRequest, i: Record<string, unknown>) => {
    const r = await findPatterns(a, i);
    return { ...r, result: { themes: r.result.themes.slice(0, 4) } };
  },
  plan_from_idea: planFromIdea,
  parse_task: parseTask,
  break_down: breakDown,
  plan_day: (a: AuthedRequest, i: Record<string, unknown>) => planBlocks(a, i, 'day'),
  plan_week: (a: AuthedRequest, i: Record<string, unknown>) => planBlocks(a, i, 'week'),
  suggest_habits: (a: AuthedRequest) => suggestHabits(a),
  goal_plan: goalPlan,
  daily_briefing: dailyBriefing,
  reflect,
  weekly_summary: weeklySummary,
} satisfies Record<string, (auth: AuthedRequest, input: Record<string, unknown>) => Promise<AiResult<unknown>>>;

export type FeatureName = keyof typeof FEATURES;

// Re-exported for tests.
export { openTasks };
