import { describe, expect, it } from 'vitest';
import { anonClient, hasStack, newUser, serviceClient } from './helpers';

// Runs against the local Supabase stack (npm run supabase:up). Skipped otherwise.
describe.skipIf(!hasStack)('database security (RLS)', () => {
  const tables = ['notes', 'tasks', 'goals', 'milestones', 'habits', 'habit_logs', 'moods', 'focus_sessions', 'calendars', 'calendar_groups', 'atlas_messages'];

  it('isolates every user table', async () => {
    const alice = await newUser('Alice');
    const bob = await newUser('Bob');
    const note = (await alice.client.from('notes').insert({ body: 'private' }).select().single()).data!;
    const goal = (await alice.client.from('goals').insert({ title: 'Read', target: 12 }).select().single()).data!;
    const habit = (await alice.client.from('habits').insert({ name: 'Walk' }).select().single()).data!;
    await alice.client.from('habit_logs').insert({ habit_id: habit.id, day: '2026-10-01' });
    await alice.client.from('moods').insert({ day: '2026-10-01', score: 4 });
    await alice.client.from('tasks').insert({ title: 'x', goal_id: goal.id, source_note_id: note.id });

    for (const t of tables) {
      const { data, error } = await bob.client.from(t).select('*');
      expect(error, t).toBeNull();
      expect(data, t).toEqual([]);
    }
    // Bob can't change or delete Alice's rows, or write rows as Alice.
    expect((await bob.client.from('notes').update({ body: 'pwned' }).eq('id', note.id).select()).data).toEqual([]);
    expect((await bob.client.from('notes').delete().eq('id', note.id).select()).data).toEqual([]);
    expect((await bob.client.from('notes').insert({ body: 'x', user_id: alice.id })).error?.code).toBe('42501');
    // Composite foreign keys stop links to another user's rows.
    expect((await bob.client.from('tasks').insert({ title: 't', goal_id: goal.id })).error?.code).toBe('23503');
    expect((await bob.client.from('habit_logs').insert({ habit_id: habit.id, day: '2026-10-02' })).error).not.toBeNull();
    // Alice still has her note.
    expect((await alice.client.from('notes').select('body').eq('id', note.id).single()).data!.body).toBe('private');
  });

  it('keeps profiles private and limits AI bookkeeping to read-only', async () => {
    const alice = await newUser('Alice');
    const bob = await newUser('Bob');
    expect((await bob.client.from('profiles').select('*')).data!.map((p) => p.id)).toEqual([bob.id]);
    expect((await bob.client.from('profiles').update({ name: 'x' }).eq('id', alice.id).select()).data).toEqual([]);
    expect((await bob.client.from('ai_overrides').insert({ user_id: bob.id, daily_limit: 9999 })).error).not.toBeNull();
    expect((await bob.client.from('ai_daily_usage').insert({ user_id: bob.id, day: '2026-10-01', count: -100 })).error).not.toBeNull();
    expect((await bob.client.from('usage_log').insert({ user_id: bob.id, feature: 'x' })).error).not.toBeNull();
    expect((await bob.client.from('ai_spend_daily').select('*')).error).not.toBeNull();
    for (const fn of ['ai_begin', 'ai_finish', 'ai_status', 'admin_overview', 'admin_set_override']) {
      expect((await bob.client.rpc(fn, {})).error, fn).not.toBeNull();
    }
    expect((await anonClient().from('notes').select('*')).error).not.toBeNull();
  });

  it('isolates plans and recurring blocks, and links them only within one account', async () => {
    const alice = await newUser('Alice');
    const bob = await newUser('Bob');
    const plan = (await alice.client.from('plans').insert({ title: 'Workouts', weeks: 4, sessions: [{ day: 1, start: 1080, duration: 45, title: 'Legs', details: '' }] }).select().single()).data!;
    const series = (
      await alice.client.from('block_series').insert({ plan_id: plan.id, title: 'Legs', days: [1, 3], start_min: 1080, duration_min: 45, start_date: '2026-11-02', end_date: '2026-11-29' }).select().single()
    ).data!;
    expect((await alice.client.from('series_occurrences').insert({ series_id: series.id, day: '2026-11-02', done_at: new Date().toISOString() })).error).toBeNull();

    for (const t of ['plans', 'block_series', 'series_occurrences']) {
      expect((await bob.client.from(t).select('*')).data, t).toEqual([]);
    }
    expect((await bob.client.from('plans').update({ status: 'dismissed' }).eq('id', plan.id).select()).data).toEqual([]);
    expect((await bob.client.from('block_series').insert({ plan_id: plan.id, title: 'x', days: [1], start_min: 0, duration_min: 15, start_date: '2026-11-02', end_date: '2026-11-02' })).error?.code).toBe('23503');
    expect((await bob.client.from('series_occurrences').insert({ series_id: series.id, day: '2026-11-04' })).error).not.toBeNull();

    // Checks keep recurring blocks on the Planner's 15-minute grid and within a year.
    const bad = { title: 'x', start_date: '2026-11-02', end_date: '2026-11-09' };
    expect((await alice.client.from('block_series').insert({ ...bad, days: [8], start_min: 0, duration_min: 15 })).error).not.toBeNull();
    expect((await alice.client.from('block_series').insert({ ...bad, days: [1], start_min: 10, duration_min: 15 })).error).not.toBeNull();
    expect((await alice.client.from('block_series').insert({ ...bad, days: [1], start_min: 1410, duration_min: 60 })).error).not.toBeNull();
    expect((await alice.client.from('block_series').insert({ ...bad, days: [1], start_min: 0, duration_min: 15, end_date: '2028-01-01' })).error).not.toBeNull();

    // Deleting a plan keeps its blocks (unlinked); deleting a series removes its occurrences.
    await alice.client.from('plans').delete().eq('id', plan.id);
    expect((await alice.client.from('block_series').select('plan_id').eq('id', series.id).single()).data!.plan_id).toBeNull();
    await alice.client.from('block_series').delete().eq('id', series.id);
    expect((await alice.client.from('series_occurrences').select('*')).data).toEqual([]);
  });

  it('creates a profile from sign-up metadata', async () => {
    const u = await newUser('Priya');
    expect((await u.client.from('profiles').select('name').single()).data!.name).toBe('Priya');
  });
});

describe.skipIf(!hasStack)('AI limit functions', () => {
  const begin = (user: string, extra: Record<string, unknown> = {}) =>
    serviceClient().rpc('ai_begin', {
      p_user: user, p_feature: 'test', p_default_limit: 3, p_daily_cap: null, p_monthly_cap: null, p_per_minute: 100, ...extra,
    });

  it('enforces the daily allowance atomically under concurrency', async () => {
    const u = await newUser('Limit');
    const results = await Promise.all(Array.from({ length: 10 }, () => begin(u.id)));
    const ok = results.filter((r) => r.data?.ok);
    expect(ok).toHaveLength(3);
    expect(results.filter((r) => r.data?.reason === 'daily_limit')).toHaveLength(7);
    const status = await serviceClient().rpc('ai_status', { p_user: u.id, p_default_limit: 3, p_daily_cap: null, p_monthly_cap: null });
    expect(status.data).toMatchObject({ limit: 3, used: 3, remaining: 0, paused: false });
  });

  it('refunds failed requests and records cost on success', async () => {
    const u = await newUser('Refund');
    const a = (await begin(u.id)).data;
    await serviceClient().rpc('ai_finish', { p_request_id: a.request_id, p_input: 100, p_output: 50, p_cost: 0.000035, p_ok: false });
    const b = (await begin(u.id)).data;
    expect(b.remaining).toBe(2); // the failed one was given back
    await serviceClient().rpc('ai_finish', { p_request_id: b.request_id, p_input: 1000, p_output: 200, p_cost: 0.0002, p_ok: true });
    const log = (await u.client.from('usage_log').select('*').eq('id', b.request_id).single()).data!;
    expect(log).toMatchObject({ status: 'ok', input_tokens: 1000, output_tokens: 200 });
    // finishing twice is a no-op
    await serviceClient().rpc('ai_finish', { p_request_id: b.request_id, p_input: 0, p_output: 0, p_cost: 9, p_ok: false });
    expect((await u.client.from('usage_log').select('status').eq('id', b.request_id).single()).data!.status).toBe('ok');
  });

  it('rate limits per minute', async () => {
    const u = await newUser('Rate');
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await begin(u.id, { p_default_limit: 100, p_per_minute: 5 })).data);
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results[6]).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(results[6].retry_after).toBeGreaterThan(0);
  });

  it('honors admin overrides and global spend caps', async () => {
    const u = await newUser('Admin');
    await serviceClient().rpc('admin_set_override', { p_user: u.id, p_daily_limit: 1, p_blocked: false });
    expect((await begin(u.id)).data).toMatchObject({ ok: true, limit: 1 });
    expect((await begin(u.id)).data).toMatchObject({ ok: false, reason: 'daily_limit' });
    await serviceClient().rpc('admin_set_override', { p_user: u.id, p_daily_limit: 50, p_blocked: true });
    expect((await begin(u.id)).data).toMatchObject({ ok: false, reason: 'blocked' });
    const v = await newUser('Cap');
    expect((await begin(v.id, { p_daily_cap: 0 })).data).toMatchObject({ ok: false, reason: 'paused_daily' });
    expect((await begin(v.id, { p_monthly_cap: 0 })).data).toMatchObject({ ok: false, reason: 'paused_monthly' });
  });

  it('cascades account deletion to all user data', async () => {
    const u = await newUser('Gone');
    await u.client.from('notes').insert({ body: 'bye' });
    await begin(u.id);
    await serviceClient().auth.admin.deleteUser(u.id);
    const svc = serviceClient();
    for (const t of ['notes', 'usage_log', 'ai_daily_usage']) {
      expect((await svc.from(t).select('*').eq('user_id', u.id)).data, t).toEqual([]);
    }
    expect((await svc.from('profiles').select('*').eq('id', u.id)).data).toEqual([]);
  });
});
