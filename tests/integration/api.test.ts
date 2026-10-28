import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS test helper
import { startMockAnthropic } from '../mock/anthropic.mjs';
import { env, hasStack, newUser, serviceClient } from './helpers';

// Runs the real /api handlers against the local Supabase stack and a mock Anthropic API.
describe.skipIf(!hasStack)('API', () => {
  let mock: { server: import('node:http').Server; port: number };
  let routes: typeof import('../../server/routes').API_ROUTES;

  beforeAll(async () => {
    mock = await startMockAnthropic();
    Object.assign(process.env, {
      SUPABASE_URL: env!.SUPABASE_URL,
      SUPABASE_ANON_KEY: env!.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY,
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DAILY_AI_LIMIT_PER_USER: '20',
      ADMIN_EMAIL: 'boss@test.local',
    });
    routes = (await import('../../server/routes')).API_ROUTES;
  });
  afterAll(() => mock.server.close());
  beforeEach(() => {
    delete process.env.ALLOWED_EMAILS;
    delete process.env.DAILY_SPEND_CAP_USD;
    delete process.env.MONTHLY_SPEND_CAP_USD;
    process.env.DAILY_AI_LIMIT_PER_USER = '20';
  });

  type U = Awaited<ReturnType<typeof newUser>>;
  const token = async (u: U) => (await u.client.auth.getSession()).data.session!.access_token;
  async function call(path: string, u: U | null, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (u) headers.authorization = `Bearer ${await token(u)}`;
    return routes[path](new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  }
  const ai = async (u: U, body: Record<string, unknown>) => {
    const res = await call('/api/ai', u, body);
    return { status: res.status, data: await res.json() };
  };
  async function atlas(u: U, message: string, mode = 'chat') {
    const res = await call('/api/atlas', u, { action: 'chat', message, mode });
    if (res.headers.get('content-type')?.startsWith('application/json')) return { status: res.status, error: await res.json(), events: [] as any[] };
    const text = await res.text();
    return { status: res.status, events: text.trim().split('\n').map((l) => JSON.parse(l)) };
  }
  const stats = async () => (await fetch(`http://127.0.0.1:${mock.port}/__stats`)).json();

  it('requires a session', async () => {
    expect((await call('/api/ai', null)).status).toBe(401);
    expect((await call('/api/atlas', null, { action: 'chat', message: 'hi' })).status).toBe(401);
  });

  it('reports the allowance', async () => {
    const u = await newUser('Status');
    const res = await call('/api/ai', u);
    expect(await res.json()).toMatchObject({ enabled: true, remaining: 20, limit: 20, paused: false });
  });

  it('organizes the inbox into suggestions that point at real notes, and logs cost', async () => {
    const u = await newUser('Organize');
    const { data: notes } = await u.client.from('notes').insert([{ body: 'call the plumber' }, { body: 'idea: herb garden' }, { body: 'felt great after the run' }]).select('id');
    const { status, data } = await ai(u, { feature: 'organize_inbox' });
    expect(status).toBe(200);
    expect(data.remaining).toBe(19);
    expect(data.result.suggestions).toHaveLength(3);
    expect(new Set(data.result.suggestions.map((s: any) => s.note_id))).toEqual(new Set(notes!.map((n) => n.id)));
    const log = (await u.client.from('usage_log').select('*')).data!;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ feature: 'organize_inbox', status: 'ok' });
    expect(log[0].input_tokens).toBeGreaterThan(0);
    expect(Number(log[0].cost_usd)).toBeGreaterThan(0);
  });

  it('serves the daily briefing from cache without using the allowance', async () => {
    const u = await newUser('Brief');
    await u.client.from('tasks').insert({ title: 'Send invoice', due_date: '2026-01-01' });
    const before = (await stats()).calls;
    const first = await ai(u, { feature: 'daily_briefing' });
    expect(first.data).toMatchObject({ cached: false, remaining: 19 });
    const second = await ai(u, { feature: 'daily_briefing' });
    expect(second.data).toMatchObject({ cached: true, remaining: null });
    expect(second.data.result).toEqual(first.data.result);
    expect((await stats()).calls).toBe(before + 1);
    const forced = await ai(u, { feature: 'daily_briefing', force: true });
    expect(forced.data).toMatchObject({ cached: false, remaining: 18 });
  });

  it('runs every one-shot feature with the pinned model and capped tokens', async () => {
    const u = await newUser('Features');
    const note = (await u.client.from('notes').insert({ body: 'Plan a trip to Lisbon. Book flights, find a hotel, ask Sam for tips.' }).select().single()).data!;
    await u.client.from('notes').insert([{ body: 'thinking about running again' }, { body: 'need to run more' }]);
    const task = (await u.client.from('tasks').insert({ title: 'Write the Q4 report', priority: 'high' }).select().single()).data!;
    const goal = (await u.client.from('goals').insert({ title: 'Run a 10k', target: 10, unit: 'km' }).select().single()).data!;
    for (let d = 1; d <= 3; d++) await u.client.from('moods').insert({ day: `2026-10-0${d}`, score: 3 + (d % 2) });
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const cases: [Record<string, unknown>, (r: any) => void][] = [
      [{ feature: 'extract_actions', note_id: note.id }, (r) => expect(r.actions.length).toBeGreaterThan(0)],
      [{ feature: 'summarize', note_id: note.id }, (r) => expect(r.summary).toBeTruthy()],
      [{ feature: 'plan_from_idea', note_id: note.id }, (r) => expect(r.steps.length).toBeGreaterThanOrEqual(2)],
      [{ feature: 'parse_task', text: 'dentist next tuesday 3pm' }, (r) => expect(r.title).toBeTruthy()],
      [{ feature: 'break_down', task_id: task.id }, (r) => expect(r.subtasks.length).toBeGreaterThanOrEqual(2)],
    ];
    for (const [body, check] of cases) {
      const { status, data } = await ai(u, body);
      expect(status, String(body.feature)).toBe(200);
      check(data.result);
    }
    // Next batch on another minute window is unnecessary: per-minute limit is 5, so use a second user.
    const v = await newUser('Features2');
    await v.client.from('tasks').insert([{ title: 'Draft slides' }, { title: 'Email Sam' }]);
    const g2 = (await v.client.from('goals').insert({ title: 'Read 12 books', target: 12, unit: 'books' }).select().single()).data!;
    for (let d = 1; d <= 3; d++) await v.client.from('moods').insert({ day: new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10), score: 4 });
    const more: [Record<string, unknown>, (r: any) => void][] = [
      [{ feature: 'plan_day', date: tomorrow }, (r) => {
        expect(r.blocks.length).toBeGreaterThan(0);
        for (const b of r.blocks) expect(b.start % 15).toBe(0);
      }],
      [{ feature: 'suggest_habits' }, (r) => expect(r.habits.length).toBeGreaterThan(0)],
      [{ feature: 'goal_plan', goal_id: g2.id }, (r) => expect(r.milestones.length).toBeGreaterThanOrEqual(2)],
      [{ feature: 'reflect' }, (r) => expect(r.reflection).toBeTruthy()],
      [{ feature: 'weekly_summary', week_start: '2026-10-26', stats: { tasks_done: 4 } }, (r) => expect(r.suggestions).toHaveLength(3)],
    ];
    for (const [body, check] of more) {
      const { status, data } = await ai(v, body);
      expect(status, String(body.feature)).toBe(200);
      check(data.result);
    }
    expect(goal.id).toBeTruthy();
    const { requests } = await stats();
    for (const r of requests) {
      expect(r.model).toBe('claude-haiku-5-5');
      expect(r.effort).toBe('low');
      expect(r.max_tokens).toBeLessThanOrEqual(1200);
    }
  });

  it('plans only into free time and never before now', async () => {
    const u = await newUser('Planner');
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await u.client.from('tasks').insert([{ title: 'A' }, { title: 'B' }, { title: 'Busy block', sched_date: tomorrow, sched_start: 14 * 60, sched_duration: 60 }]);
    const { data } = await ai(u, { feature: 'plan_day', date: tomorrow });
    // The mock proposes 14:00 and 15:00; 14:00 clashes with the existing block and is dropped.
    expect(data.result.blocks.map((b: any) => b.start)).toEqual([15 * 60]);
  });

  it('rejects unknown features and invalid input politely', async () => {
    const u = await newUser('Bad');
    expect((await ai(u, { feature: 'write_my_novel' })).status).toBe(400);
    expect((await ai(u, { feature: 'organize_inbox' })).data.error).toMatch(/inbox is empty/);
    // A failed precondition does not use the allowance.
    expect((await (await call('/api/ai', u)).json()).remaining).toBe(20);
  });

  describe('Atlas', () => {
    it('adds a task, streams the reply, saves history and counts one request', async () => {
      const u = await newUser('Ada');
      const { events } = await atlas(u, 'add task Buy oat milk');
      const text = events.filter((e) => e.t === 'text').map((e) => e.v).join('');
      expect(events.find((e) => e.t === 'action')).toMatchObject({ tool: 'add_task', ok: true });
      expect(text).toMatch(/Done/);
      expect(events.at(-1)).toMatchObject({ t: 'done', remaining: 19 });
      expect((await u.client.from('tasks').select('title')).data).toEqual([{ title: 'Buy oat milk' }]);
      const history = (await u.client.from('atlas_messages').select('role, content, actions').order('id')).data!;
      expect(history.map((h) => h.role)).toEqual(['user', 'assistant']);
      expect(history[1].actions[0].summary).toMatch(/Buy oat milk/);
      expect((await u.client.from('usage_log').select('*')).data).toHaveLength(1);
    });

    it('completes, schedules, logs habits, captures and processes notes', async () => {
      const u = await newUser('Multi');
      await u.client.from('tasks').insert([{ title: 'Pay rent' }, { title: 'Water plants' }]);
      const habit = (await u.client.from('habits').insert({ name: 'Stretch', emoji: '🧘' }).select().single()).data!;
      await atlas(u, 'complete Pay rent');
      expect((await u.client.from('tasks').select('done').eq('title', 'Pay rent').single()).data!.done).toBe(true);
      await atlas(u, 'schedule Water plants at 16:30');
      const block = (await u.client.from('tasks').select('sched_start, sched_duration').eq('title', 'Water plants').single()).data!;
      expect(block).toEqual({ sched_start: 16 * 60 + 30, sched_duration: 60 });
      await atlas(u, 'log habit Stretch');
      expect((await u.client.from('habit_logs').select('habit_id')).data).toEqual([{ habit_id: habit.id }]);
      await atlas(u, 'capture remember to renew passport');
      const v = await newUser('Multi2');
      await v.client.from('notes').insert({ body: 'learn watercolor' });
      await atlas(v, 'process my inbox');
      expect((await v.client.from('notes').select('state')).data).toEqual([{ state: 'idea' }]);
      expect((await u.client.from('notes').select('state, body')).data).toEqual([{ state: 'inbox', body: 'remember to renew passport' }]);
    });

    it('asks for confirmation before deleting, and only the user can confirm', async () => {
      const u = await newUser('Del');
      await u.client.from('tasks').insert({ title: 'Old errand' });
      const { events } = await atlas(u, 'delete Old errand');
      const confirm = events.find((e) => e.t === 'confirm');
      expect(confirm.summary).toBe('Delete task “Old errand”');
      expect((await u.client.from('tasks').select('id')).data).toHaveLength(1); // not deleted yet
      const other = await newUser('Intruder');
      expect((await call('/api/atlas', other, { action: 'confirm', id: confirm.id, approve: true })).status).toBe(404);
      const res = await call('/api/atlas', u, { action: 'confirm', id: confirm.id, approve: true });
      expect((await res.json()).message).toMatch(/deleted task “Old errand”/);
      expect((await u.client.from('tasks').select('id')).data).toHaveLength(0);
      expect((await call('/api/atlas', u, { action: 'confirm', id: confirm.id, approve: true })).status).toBe(409);
    });

    it("cannot see or touch another user's data", async () => {
      const alice = await newUser('AliceA');
      await alice.client.from('tasks').insert({ title: 'Alice secret task' });
      const bob = await newUser('BobA');
      const { events } = await atlas(bob, 'complete Alice secret task');
      expect(events.filter((e) => e.t === 'text').map((e) => e.v).join('')).toMatch(/couldn't find|didn't work/i);
      expect((await alice.client.from('tasks').select('done').single()).data!.done).toBe(false);
    });

    it('reports tool errors honestly', async () => {
      const u = await newUser('Err');
      const { events } = await atlas(u, 'bad tool please');
      expect(events.filter((e) => e.t === 'text').map((e) => e.v).join('')).toMatch(/didn't work/);
    });

    it('refunds the request when the model call fails', async () => {
      const u = await newUser('Fail');
      const { events } = await atlas(u, 'hello [[fail]]');
      expect(events.find((e) => e.t === 'error')).toBeTruthy();
      expect(events.at(-1)).toMatchObject({ t: 'done', remaining: 20 });
      expect((await (await call('/api/ai', u)).json()).remaining).toBe(20);
    });
  });

  describe('limits', () => {
    it('stops at the daily allowance with a friendly message', async () => {
      process.env.DAILY_AI_LIMIT_PER_USER = '2';
      const u = await newUser('Daily');
      expect((await atlas(u, 'hi')).status).toBe(200);
      expect((await atlas(u, 'hi')).status).toBe(200);
      const third = await atlas(u, 'hi');
      expect(third.status).toBe(429);
      expect(third.error).toMatchObject({ reason: 'daily_limit', remaining: 0 });
      expect(third.error.error).toMatch(/today's ✨ AI allowance/);
    });

    it('rate limits to 5 requests a minute', async () => {
      const u = await newUser('Burst');
      const statuses = [];
      for (let i = 0; i < 6; i++) statuses.push((await atlas(u, 'hi')).status);
      expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    });

    it('pauses AI for everyone when a spend cap is reached', async () => {
      process.env.DAILY_SPEND_CAP_USD = '0';
      const u = await newUser('Cap');
      const res = await atlas(u, 'hi');
      expect(res.status).toBe(503);
      expect(res.error.error).toBe('AI is resting until tomorrow 🌙');
      expect(await (await call('/api/ai', u)).json()).toMatchObject({ enabled: false, paused: true });
    });

    it('limits AI to ALLOWED_EMAILS when set', async () => {
      const u = await newUser('Outsider');
      process.env.ALLOWED_EMAILS = 'someone@else.com, boss@test.local';
      expect((await atlas(u, 'hi')).status).toBe(403);
      process.env.ALLOWED_EMAILS = `someone@else.com,${u.email.toUpperCase()}`;
      expect((await atlas(u, 'hi')).status).toBe(200);
    });

    it('respects admin blocks', async () => {
      const u = await newUser('Blocked');
      await serviceClient().rpc('admin_set_override', { p_user: u.id, p_daily_limit: null, p_blocked: true });
      expect((await ai(u, { feature: 'daily_briefing' })).status).toBe(403);
    });
  });

  describe('admin and account', () => {
    it('only lets ADMIN_EMAIL see usage and change limits', async () => {
      const u = await newUser('Nosy');
      expect((await call('/api/admin', u)).status).toBe(403);
      const boss = await newUser('Boss');
      process.env.ADMIN_EMAIL = boss.email.toUpperCase();
      const res = await call('/api/admin', boss);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total_users).toBeGreaterThan(0);
      expect(data.config.daily_limit_per_user).toBe(20);
      const found = await (await call('/api/admin', boss, { action: 'find_user', email: u.email })).json();
      expect(found.user_id).toBe(u.id);
      expect((await call('/api/admin', boss, { action: 'set_override', user_id: u.id, daily_limit: 3, blocked: false })).status).toBe(200);
      expect(await (await call('/api/ai', u)).json()).toMatchObject({ limit: 3 });
      expect((await call('/api/admin', u, { action: 'set_override', user_id: u.id, daily_limit: 999, blocked: false })).status).toBe(403);
    });

    it('deletes the account and all its data after typed confirmation', async () => {
      const u = await newUser('Leaver');
      await u.client.from('notes').insert({ body: 'bye' });
      expect((await call('/api/account', u, { action: 'delete', confirm: 'nope' })).status).toBe(400);
      expect((await call('/api/account', u, { action: 'delete', confirm: 'DELETE' })).status).toBe(200);
      const svc = serviceClient();
      expect((await svc.auth.admin.getUserById(u.id)).data.user).toBeNull();
      expect((await svc.from('notes').select('id').eq('user_id', u.id)).data).toEqual([]);
    });
  });
});
