import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  calendarEvents,
  eventLine,
  habitLine,
  habitStatus,
  openTasks,
  overviewText,
  TASK_COLUMNS,
  taskLine,
  todaysTasks,
  type Ctx,
  type TaskRow,
} from '../../data/context.js';
import { availabilityText, busyBetween, MAX_PLAN_SESSIONS, MAX_PLAN_WEEKS, normalizeSessions, planConflicts, recurringBetween } from '../../data/plans.js';
import { planEndDate, WEEKDAYS } from '../../data/recurrence.js';
import { addDays, dayIn, hhmm, minutesOnDay, parseHhmm } from '../../data/time.js';
import { serviceClient } from '../../supabase.js';

export interface ToolEvent {
  /** Shown to the user under Atlas's reply ("Added task “Call the bank”"). */
  action?: { tool: string; summary: string; ok: boolean; plan_id?: string };
  /** A change that needs the user's explicit confirmation. */
  confirm?: { id: string; summary: string };
}

export interface ToolOutcome {
  /** What the model sees. */
  content: string;
  isError?: boolean;
  events: ToolEvent[];
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const time = z.string().regex(/^\d{1,2}:\d{2}$/, 'use HH:MM');
const ref = z.string().min(2).max(40);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const tagsIn = (text: string) => [...new Set([...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{1,30})/gu)].map((m) => m[1].toLowerCase()))].slice(0, 10);

// ---------------------------------------------------------------------------
// Tool definitions (kept short: every word here is sent on every Atlas call)
// ---------------------------------------------------------------------------
const schemas = {
  get_today: z.object({}),
  list_tasks: z.object({
    filter: z.enum(['open', 'today', 'overdue', 'upcoming', 'completed_recent']).default('open'),
    search: z.string().max(80).optional(),
  }),
  add_task: z.object({
    title: z.string().min(1).max(300),
    due_date: day.optional(),
    due_time: time.optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    tags: z.array(z.string().max(30)).max(5).optional(),
    top_today: z.boolean().optional(),
    estimate_min: z.number().int().min(5).max(480).optional(),
  }),
  update_task: z.object({
    task: ref,
    title: z.string().min(1).max(300).optional(),
    due_date: day.nullable().optional(),
    due_time: time.nullable().optional(),
    priority: z.enum(['high', 'medium', 'low']).nullable().optional(),
    top_today: z.boolean().optional(),
  }),
  complete_task: z.object({ task: ref, done: z.boolean().default(true) }),
  schedule_task: z.object({
    task: ref.optional(),
    title: z.string().min(1).max(300).optional(),
    date: day,
    start: time,
    duration_min: z.number().int().min(15).max(480),
  }),
  unschedule_task: z.object({ task: ref }),
  capture_note: z.object({ text: z.string().min(1).max(4000) }),
  list_notes: z.object({ view: z.enum(['inbox', 'ideas', 'all']).default('inbox'), search: z.string().max(80).optional() }),
  process_note: z.object({
    note: ref,
    action: z.enum(['make_task', 'keep_as_idea', 'keep_as_note', 'archive']),
    task_title: z.string().min(1).max(300).optional(),
    due_date: day.optional(),
  }),
  list_habits: z.object({}),
  log_habit: z.object({ habit: ref, date: day.optional(), done: z.boolean().default(true) }),
  list_goals: z.object({}),
  update_goal: z.object({ goal: ref, add: z.number().optional(), set: z.number().min(0).optional() }),
  get_calendar: z.object({ start_date: day, end_date: day }),
  delete_item: z.object({ kind: z.enum(['task', 'note', 'habit', 'goal']), item: ref }),
  check_availability: z.object({ start_date: day.optional(), weeks: z.number().int().min(1).max(MAX_PLAN_WEEKS).default(4) }),
  create_plan: z.object({
    title: z.string().min(1).max(120),
    summary: z.string().max(300).optional(),
    weeks: z.number().int().min(1).max(MAX_PLAN_WEEKS),
    start_date: day.optional(),
    sessions: z
      .array(
        z.object({
          day: z.string().max(12).describe(WEEKDAYS.join(' | ')),
          start: time,
          duration_min: z.number().int().min(15).max(240),
          title: z.string().min(1).max(80),
          details: z.string().max(160).optional(),
        }),
      )
      .min(1)
      .max(MAX_PLAN_SESSIONS),
  }),
} as const;

export type ToolName = keyof typeof schemas;

const descriptions: Record<ToolName, string> = {
  get_today: "Full snapshot of today: top 3, due/overdue tasks, schedule incl. synced calendar events, habits, inbox, mood.",
  list_tasks: 'List tasks with refs (T1…). Use before acting on a task you only know by name.',
  add_task: 'Create a task. top_today marks it as one of today\'s top 3.',
  update_task: 'Edit a task (null clears a field).',
  complete_task: 'Mark a task done (or not done with done=false).',
  schedule_task: 'Time-block an existing task (task) or a new one (title) on the Planner.',
  unschedule_task: 'Remove a task\'s time block (keeps the task).',
  capture_note: 'Save a note to the brain dump inbox.',
  list_notes: 'List brain dump notes with refs (N1…).',
  process_note: 'Process a brain dump note: make it a task (keeps a link), keep as idea, keep as note, or archive.',
  list_habits: 'List habits with refs (H1…), today\'s status and streaks.',
  log_habit: 'Log a habit as done (or undo with done=false) for a date (default today).',
  list_goals: 'List goals with refs (G1…) and progress.',
  update_goal: 'Change goal progress: add to it, or set it.',
  get_calendar: 'Synced calendar events, task blocks and recurring blocks between two dates (max 14 days).',
  delete_item: 'Ask the user to confirm deleting a task, note, habit or goal. Nothing is deleted until they press Confirm.',
  check_availability: 'Busy times (task blocks, recurring blocks, calendar events) by weekday for a period. Call before create_plan. start_date defaults to tomorrow.',
  create_plan:
    'Draft a weekly plan (workouts, study, meal prep, reading, project…) as a card the user can edit and add to their Planner. Each session repeats weekly on its day for `weeks` weeks. Nothing is scheduled until the user adds it.',
};

function toJsonSchema(s: z.ZodObject): Anthropic.Tool.InputSchema {
  const js = z.toJSONSchema(s, { io: 'input' }) as Record<string, unknown>;
  delete js.$schema;
  return js as Anthropic.Tool.InputSchema;
}

export const ATLAS_TOOLS: Anthropic.Tool[] = (Object.keys(schemas) as ToolName[]).map((name) => ({
  name,
  description: descriptions[name],
  input_schema: toJsonSchema(schemas[name]),
  eager_input_streaming: true,
}));

// ---------------------------------------------------------------------------
// Execution — always through ctx.db (the user's RLS-scoped client)
// ---------------------------------------------------------------------------
type Exec<N extends ToolName> = (ctx: Ctx, input: z.infer<(typeof schemas)[N]>) => Promise<ToolOutcome>;

const ok = (content: string, summary?: string, tool = ''): ToolOutcome => ({
  content,
  events: summary ? [{ action: { tool, summary, ok: true } }] : [],
});
const fail = (content: string): ToolOutcome => ({ content, isError: true, events: [] });

async function resolveTask(ctx: Ctx, value: string): Promise<TaskRow | null> {
  const id = ctx.refs.resolve('T', value);
  if (!id) return null;
  const { data } = await ctx.db.from('tasks').select(TASK_COLUMNS).eq('id', id).maybeSingle();
  return (data as TaskRow) ?? null;
}

const UNKNOWN = (kind: string) => `Unknown ${kind} reference. List ${kind}s first to get valid refs.`;

const planStart = (ctx: Ctx, d?: string) => (d && d > ctx.now.day ? d : addDays(ctx.now.day, 1));

const executors: { [N in ToolName]: Exec<N> } = {
  async get_today(ctx) {
    return ok(await overviewText(ctx));
  },

  async list_tasks(ctx, input) {
    let rows: TaskRow[];
    const day = ctx.now.day;
    if (input.filter === 'today') rows = await todaysTasks(ctx);
    else if (input.filter === 'completed_recent') {
      const { data } = await ctx.db.from('tasks').select(TASK_COLUMNS).eq('done', true).order('completed_at', { ascending: false }).limit(15);
      rows = (data ?? []) as TaskRow[];
    } else {
      rows = await openTasks(ctx, { query: input.search, upcomingDays: input.filter === 'upcoming' ? 14 : undefined, limit: 30 });
      if (input.filter === 'overdue') rows = rows.filter((t) => t.due_date && t.due_date < day);
    }
    if (input.search && input.filter === 'today') rows = rows.filter((t) => t.title.toLowerCase().includes(input.search!.toLowerCase()));
    return ok(rows.length ? rows.map((t) => taskLine(ctx, t)).join('\n') : 'No matching tasks.');
  },

  async add_task(ctx, input) {
    const { data, error } = await ctx.db
      .from('tasks')
      .insert({
        title: input.title.trim(),
        due_date: input.due_date ?? null,
        due_time: input.due_time ?? null,
        priority: input.priority ?? null,
        tags: (input.tags ?? []).map((t) => t.replace(/^#/, '').toLowerCase()),
        top_date: input.top_today ? ctx.now.day : null,
        estimate_min: input.estimate_min ?? null,
      })
      .select(TASK_COLUMNS)
      .single();
    if (error) return fail(`Could not add the task: ${error.message}`);
    const when = input.due_date ? ` for ${input.due_date}${input.due_time ? ' ' + input.due_time : ''}` : '';
    return ok(`Added ${taskLine(ctx, data as TaskRow)}`, `Added task “${input.title.trim()}”${when}`, 'add_task');
  },

  async update_task(ctx, input) {
    const task = await resolveTask(ctx, input.task);
    if (!task) return fail(UNKNOWN('task'));
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.due_date !== undefined) patch.due_date = input.due_date;
    if (input.due_time !== undefined) patch.due_time = input.due_time;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.top_today !== undefined) patch.top_date = input.top_today ? ctx.now.day : null;
    if (!Object.keys(patch).length) return fail('Nothing to change.');
    const { data, error } = await ctx.db.from('tasks').update(patch).eq('id', task.id).select(TASK_COLUMNS).single();
    if (error) return fail(`Could not update the task: ${error.message}`);
    return ok(`Updated ${taskLine(ctx, data as TaskRow)}`, `Updated task “${(data as TaskRow).title}”`, 'update_task');
  },

  async complete_task(ctx, input) {
    const task = await resolveTask(ctx, input.task);
    if (!task) return fail(UNKNOWN('task'));
    const { error } = await ctx.db
      .from('tasks')
      .update({ done: input.done, completed_at: input.done ? new Date().toISOString() : null })
      .eq('id', task.id);
    if (error) return fail(`Could not update the task: ${error.message}`);
    return ok(
      `${input.done ? 'Completed' : 'Reopened'} "${task.title}".`,
      `${input.done ? 'Completed' : 'Reopened'} “${task.title}”`,
      'complete_task',
    );
  },

  async schedule_task(ctx, input) {
    const startRaw = parseHhmm(input.start);
    if (startRaw == null) return fail('Invalid start time.');
    const start = Math.round(startRaw / 15) * 15;
    const duration = Math.round(input.duration_min / 15) * 15 || 15;
    if (start + duration > 1440) return fail('That block would run past midnight.');
    let task: TaskRow | null = null;
    if (input.task) {
      task = await resolveTask(ctx, input.task);
      if (!task) return fail(UNKNOWN('task'));
    } else if (!input.title) return fail('Give either a task ref or a title.');

    const { data: sameDay } = await ctx.db
      .from('tasks')
      .select('id, title, sched_start, sched_duration')
      .eq('sched_date', input.date)
      .neq('id', task?.id ?? '00000000-0000-0000-0000-000000000000');
    const clash = (sameDay ?? []).filter((b) => start < b.sched_start + b.sched_duration && b.sched_start < start + duration);
    const sched = { sched_date: input.date, sched_start: start, sched_duration: duration };
    let title: string;
    if (task) {
      const { error } = await ctx.db.from('tasks').update(sched).eq('id', task.id);
      if (error) return fail(`Could not schedule: ${error.message}`);
      title = task.title;
    } else {
      const { error } = await ctx.db.from('tasks').insert({ title: input.title!.trim(), ...sched });
      if (error) return fail(`Could not schedule: ${error.message}`);
      title = input.title!.trim();
    }
    const range = `${input.date} ${hhmm(start)}–${hhmm(start + duration)}`;
    const note = clash.length ? ` Note: overlaps ${clash.map((c) => `"${c.title}"`).join(', ')}.` : '';
    return ok(`Scheduled "${title}" ${range}.${note}`, `Scheduled “${title}” ${range}`, 'schedule_task');
  },

  async unschedule_task(ctx, input) {
    const task = await resolveTask(ctx, input.task);
    if (!task) return fail(UNKNOWN('task'));
    await ctx.db.from('tasks').update({ sched_date: null, sched_start: null, sched_duration: null }).eq('id', task.id);
    return ok(`Removed the time block for "${task.title}".`, `Unscheduled “${task.title}”`, 'unschedule_task');
  },

  async capture_note(ctx, input) {
    const { data, error } = await ctx.db.from('notes').insert({ body: input.text.trim(), tags: tagsIn(input.text) }).select('id').single();
    if (error) return fail(`Could not save the note: ${error.message}`);
    return ok(`Saved to the inbox as ${ctx.refs.ref('N', data.id)}.`, `Captured a note: “${clip(input.text.trim(), 60)}”`, 'capture_note');
  },

  async list_notes(ctx, input) {
    let q = ctx.db.from('notes').select('id, body, state, pinned, created_at');
    q = input.view === 'inbox' ? q.eq('state', 'inbox') : input.view === 'ideas' ? q.eq('state', 'idea') : q.neq('state', 'archived');
    if (input.search) q = q.ilike('body', `%${input.search.replace(/[%_]/g, ' ')}%`);
    const { data } = await q.order('created_at', { ascending: false }).limit(15);
    if (!data?.length) return ok('No matching notes.');
    return ok(data.map((n) => `${ctx.refs.ref('N', n.id)} [${n.state}${n.pinned ? ', pinned' : ''}] ${clip(n.body.replace(/\s+/g, ' '), 160)}`).join('\n'));
  },

  async process_note(ctx, input) {
    const id = ctx.refs.resolve('N', input.note);
    if (!id) return fail(UNKNOWN('note'));
    const { data: note } = await ctx.db.from('notes').select('id, body').eq('id', id).maybeSingle();
    if (!note) return fail('That note no longer exists.');
    const processed = new Date().toISOString();
    if (input.action === 'make_task') {
      const title = (input.task_title ?? note.body.split('\n')[0]).trim().slice(0, 300);
      const { error } = await ctx.db.from('tasks').insert({ title, due_date: input.due_date ?? null, source_note_id: note.id });
      if (error) return fail(`Could not create the task: ${error.message}`);
      await ctx.db.from('notes').update({ state: 'archived', processed_at: processed }).eq('id', note.id);
      return ok(`Created task "${title}" from the note and archived the note (linked).`, `Turned a note into task “${title}”`, 'process_note');
    }
    const state = input.action === 'keep_as_idea' ? 'idea' : input.action === 'keep_as_note' ? 'note' : 'archived';
    await ctx.db.from('notes').update({ state, processed_at: processed }).eq('id', note.id);
    const label = state === 'idea' ? 'Kept as an idea' : state === 'note' ? 'Kept as a note' : 'Archived';
    return ok(`${label}.`, `${label}: “${clip(note.body.replace(/\s+/g, ' '), 50)}”`, 'process_note');
  },

  async list_habits(ctx) {
    const habits = await habitStatus(ctx);
    return ok(habits.length ? habits.map((h) => habitLine(ctx, h)).join('\n') : 'No habits set up yet.');
  },

  async log_habit(ctx, input) {
    const id = ctx.refs.resolve('H', input.habit);
    if (!id) return fail(UNKNOWN('habit'));
    const { data: habit } = await ctx.db.from('habits').select('id, name, emoji').eq('id', id).maybeSingle();
    if (!habit) return fail('That habit no longer exists.');
    const d = input.date ?? ctx.now.day;
    if (d > ctx.now.day) return fail("Can't log a habit for a future date.");
    if (input.done) {
      const { error } = await ctx.db.from('habit_logs').upsert({ habit_id: habit.id, day: d }, { onConflict: 'habit_id,day', ignoreDuplicates: true });
      if (error) return fail(`Could not log it: ${error.message}`);
    } else {
      await ctx.db.from('habit_logs').delete().eq('habit_id', habit.id).eq('day', d);
    }
    const when = d === ctx.now.day ? 'today' : d;
    return ok(
      `${input.done ? 'Logged' : 'Unlogged'} ${habit.name} for ${when}.`,
      `${input.done ? 'Logged' : 'Unlogged'} ${habit.emoji} ${habit.name} for ${when}`,
      'log_habit',
    );
  },

  async list_goals(ctx) {
    const { data } = await ctx.db.from('goals').select('id, title, emoji, target, current, unit, due_date, completed_at').order('sort').limit(20);
    if (!data?.length) return ok('No goals yet.');
    return ok(
      data
        .map((g) => {
          const pct = Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100));
          return `${ctx.refs.ref('G', g.id)} ${g.emoji} ${g.title}: ${g.current}/${g.target} ${g.unit} (${pct}%)${g.due_date ? ` due ${g.due_date}` : ''}${g.completed_at ? ' · completed' : ''}`;
        })
        .join('\n'),
    );
  },

  async update_goal(ctx, input) {
    const id = ctx.refs.resolve('G', input.goal);
    if (!id) return fail(UNKNOWN('goal'));
    const { data: goal } = await ctx.db.from('goals').select('id, title, target, current, unit, completed_at').eq('id', id).maybeSingle();
    if (!goal) return fail('That goal no longer exists.');
    if (input.add === undefined && input.set === undefined) return fail('Give add or set.');
    const next = Math.max(0, input.set ?? Number(goal.current) + (input.add ?? 0));
    const reached = next >= Number(goal.target);
    await ctx.db
      .from('goals')
      .update({ current: next, completed_at: reached ? goal.completed_at ?? new Date().toISOString() : null })
      .eq('id', goal.id);
    return ok(
      `"${goal.title}" is now ${next}/${goal.target} ${goal.unit}${reached ? ' — target reached!' : ''}.`,
      `Updated goal “${goal.title}” to ${next}/${goal.target} ${goal.unit}`,
      'update_goal',
    );
  },

  async get_calendar(ctx, input) {
    if (input.end_date < input.start_date) return fail('end_date is before start_date.');
    const end = input.end_date > addDays(input.start_date, 13) ? addDays(input.start_date, 13) : input.end_date;
    const [{ events, errors }, { data: blocks }, recurring] = await Promise.all([
      calendarEvents(ctx, input.start_date, end),
      ctx.db.from('tasks').select('title, sched_date, sched_start, sched_duration').gte('sched_date', input.start_date).lte('sched_date', end).order('sched_date').order('sched_start'),
      recurringBetween(ctx, input.start_date, end),
    ]);
    const lines: string[] = [];
    for (let d = input.start_date; d <= end; d = addDays(d, 1)) {
      const items = [
        ...events
          .filter((e) =>
            e.allDay
              ? e.start <= d && d < e.end
              : dayIn(ctx.tz, new Date(e.start)) <= d && d <= dayIn(ctx.tz, new Date(new Date(e.end).getTime() - 1)),
          )
          .map((e) => ({ s: e.allDay ? -1 : minutesOnDay(e.start, d, ctx.tz) ?? 0, line: eventLine(ctx, e, d) })),
        ...(blocks ?? [])
          .filter((b) => b.sched_date === d)
          .map((b) => ({ s: b.sched_start as number, line: `${hhmm(b.sched_start)}-${hhmm(b.sched_start + b.sched_duration)} ${b.title} (task block)` })),
        ...recurring
          .filter((o) => o.day === d)
          .map((o) => ({ s: o.start, line: `${hhmm(o.start)}-${hhmm(o.start + o.duration)} ${o.title} (recurring block${o.done ? ', done' : ''})` })),
      ].sort((a, b) => a.s - b.s);
      lines.push(`${d}: ${items.length ? items.map((i) => i.line).join('; ') : 'nothing'}`);
    }
    if (errors.length) lines.push(`(Some calendars failed to sync: ${errors.join('; ')})`);
    return ok(lines.join('\n'));
  },

  async delete_item(ctx, input) {
    const kindRef = { task: 'T', note: 'N', habit: 'H', goal: 'G' } as const;
    const table = { task: 'tasks', note: 'notes', habit: 'habits', goal: 'goals' }[input.kind];
    const id = ctx.refs.resolve(kindRef[input.kind], input.item);
    if (!id) return fail(UNKNOWN(input.kind));
    const label = input.kind === 'note' ? 'body' : input.kind === 'habit' ? 'name' : 'title';
    const { data } = await ctx.db.from(table).select(`id, ${label}`).eq('id', id).maybeSingle();
    if (!data) return fail(`That ${input.kind} no longer exists.`);
    const name = clip(String((data as Record<string, unknown>)[label]).replace(/\s+/g, ' '), 60);
    const summary = `Delete ${input.kind} “${name}”`;
    const { data: pending, error } = await serviceClient()
      .from('atlas_pending_actions')
      .insert({ user_id: ctx.userId, kind: 'delete', payload: { table, id, kind: input.kind, name }, summary })
      .select('id')
      .single();
    if (error) return fail('Could not prepare the deletion.');
    return {
      content: `Waiting for the user to press Confirm on: ${summary}. Nothing is deleted yet — tell them you've asked for confirmation.`,
      events: [{ confirm: { id: pending.id, summary } }],
    };
  },

  async check_availability(ctx, input) {
    const start = planStart(ctx, input.start_date);
    const { busy, calendarErrors } = await busyBetween(ctx, start, planEndDate(start, input.weeks));
    const note = calendarErrors.length ? `\n(Some calendars failed to sync, so there may be more busy times.)` : '';
    return ok(availabilityText(busy, start, input.weeks) + note);
  },

  async create_plan(ctx, input) {
    const sessions = normalizeSessions(input.sessions);
    if (!sessions.length) return fail('No valid sessions (check days and HH:MM times).');
    const start = planStart(ctx, input.start_date);
    const title = input.title.trim();
    const { data, error } = await ctx.db
      .from('plans')
      .insert({ title, summary: (input.summary ?? '').trim(), request: (ctx.request ?? '').slice(0, 1000), weeks: input.weeks, start_date: start, sessions })
      .select('id')
      .single();
    if (error) return fail(`Could not save the plan: ${error.message}`);
    const { busy } = await busyBetween(ctx, start, planEndDate(start, input.weeks));
    const conflicts = planConflicts(sessions, start, input.weeks, busy);
    const clashNote = conflicts.length
      ? `${conflicts.length} session${conflicts.length === 1 ? '' : 's'} overlap existing items (e.g. ${conflicts[0].day} "${conflicts[0].title}" vs "${conflicts[0].with}"); the user can skip or shift them when adding.`
      : 'No conflicts with their Planner or calendar.';
    return {
      content: `Drafted plan "${title}": ${sessions.length} session${sessions.length === 1 ? '' : 's'} a week for ${input.weeks} week${input.weeks === 1 ? '' : 's'} from ${start}. ${clashNote} The user sees it as a card listing every session with Add to Planner / Edit buttons — don't repeat the sessions; reply with one short sentence.`,
      events: [{ action: { tool: 'create_plan', summary: `Drafted plan “${title}”`, ok: true, plan_id: data.id } }],
    };
  },
};

export async function runTool(ctx: Ctx, name: string, rawInput: unknown): Promise<ToolOutcome> {
  if (!Object.hasOwn(executors, name)) return fail(`Unknown tool ${name}.`);
  const parsed = schemas[name as ToolName].safeParse(rawInput ?? {});
  if (!parsed.success) {
    return fail(`Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'} ${i.message}`).join('; ')}`);
  }
  try {
    return await (executors[name as ToolName] as Exec<ToolName>)(ctx, parsed.data as never);
  } catch (err) {
    console.error('[atlas tool]', name, err);
    return fail('That action failed unexpectedly.');
  }
}

/** Runs a confirmed pending action. Called without any AI involvement. */
export async function executePending(ctx: Ctx, payload: { table: string; id: string; kind: string; name: string }) {
  const allowed = ['tasks', 'notes', 'habits', 'goals'];
  if (!allowed.includes(payload.table)) throw new Error('bad pending action');
  const { data, error } = await ctx.db.from(payload.table).delete().eq('id', payload.id).select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}
