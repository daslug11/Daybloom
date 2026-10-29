// Realistic demo accounts for screenshots and design scans (local stack only).
// Maya is a student a few weeks into using Daybloom: a full inbox, tasks for
// today, a timetable plan, habits with history, goals, moods and an Atlas chat.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export const PASSWORD = 'bloom-visual-pass-1';

export function localAdmin() {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
  if (!env.SUPABASE_URL?.includes('localhost')) throw new Error('Visual seeding only runs against the local stack.');
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

/** Deletes any previous account with this email, then creates it fresh. */
export async function freshUser(admin, email, name, profile = {}) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const old = list.users.find((u) => u.email === email);
  if (old) await admin.auth.admin.deleteUser(old.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name } });
  if (error) throw error;
  must(await admin.from('profiles').update({ timezone: 'UTC', ...profile }).eq('id', data.user.id), 'profile');
  return data.user.id;
}

const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const isoWeekday = (d) => ((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

export async function seedMaya(admin, email = 'maya@visual.local') {
  const now = new Date().toISOString();
  const uid = await freshUser(admin, email, 'Maya', { onboarded_at: now, tour_completed_at: now, focus_areas: ['Study', 'Fitness', 'Side project'] });
  const ins = async (table, rows) => must(await admin.from(table).insert(rows.map((r) => ({ user_id: uid, ...r })), { defaultToNull: false }).select('*'), table);

  const [readGoal, runGoal] = await ins('goals', [
    { title: 'Read 12 books this year', emoji: '📚', target: 12, current: 7, unit: 'books', due_date: day(60) },
    { title: 'Run a 10K', emoji: '🏃', target: 10, current: 6.5, unit: 'km', due_date: day(40) },
  ]);
  await ins('milestones', [
    { goal_id: runGoal.id, title: 'Run 5K without stopping', done: true },
    { goal_id: runGoal.id, title: 'Run 8K', done: false },
    { goal_id: readGoal.id, title: 'Finish "Atomic Habits"', done: true },
  ]);

  const notes = await ins('notes', [
    { body: 'Email Prof. Okafor about the lab report extension', state: 'inbox', created_at: ago(25) },
    { body: 'Groceries for the week\n- [ ] oats\n- [x] bananas\n- [ ] coffee\n- [ ] rice', state: 'inbox', tags: [], created_at: ago(90) },
    { body: 'Idea: a study group for the stats exam #study', state: 'inbox', tags: ['study'], created_at: ago(240) },
    { body: 'Ask Sam if the bike is still for sale', state: 'inbox', created_at: ago(60 * 26) },
    { body: 'Portfolio site: try a single-page layout with a big project list #sideproject', state: 'idea', tags: ['sideproject'], pinned: true, created_at: ago(60 * 50), processed_at: ago(60 * 48) },
    { body: 'Books to read next: The Midnight Library, Project Hail Mary', state: 'note', created_at: ago(60 * 80), processed_at: ago(60 * 79) },
    { body: 'Pay phone bill', state: 'archived', created_at: ago(60 * 120), processed_at: ago(60 * 100) },
  ]);

  const today = day(0);
  await ins('tasks', [
    { title: 'Finish the stats problem set', priority: 'high', due_date: today, due_time: '17:00', top_date: today, tags: ['study'], sched_date: today, sched_start: 14 * 60, sched_duration: 90 },
    { title: 'Read chapter 4 for seminar', priority: 'medium', due_date: today, top_date: today, tags: ['study'] },
    { title: 'Email Prof. Okafor about the extension', top_date: today, source_note_id: notes[0].id },
    { title: 'Book a dentist appointment', due_date: day(-2), priority: 'low' },
    { title: 'Update CV with the new internship', due_date: day(3), tags: ['career'], estimate_min: 60 },
    { title: 'Plan the portfolio homepage', goal_id: null, due_date: day(6), tags: ['sideproject'] },
    { title: 'Return library books', due_date: day(1) },
    { title: 'Submit housing form', done: true, completed_at: ago(60 * 5) },
    { title: 'Buy a birthday card for Jo', done: true, completed_at: ago(60 * 30) },
    { title: 'Laundry', done: true, completed_at: ago(60 * 52) },
  ]);

  const habits = await ins('habits', [
    { name: 'Read 20 minutes', emoji: '📚', goal_id: readGoal.id },
    { name: 'Drink water', emoji: '💧' },
    { name: 'Stretch', emoji: '🧘' },
  ]);
  const logs = [];
  for (let i = 1; i < 60; i++) {
    if (i % 7 !== 3) logs.push({ habit_id: habits[0].id, day: day(-i) });
    if (i % 3 !== 0) logs.push({ habit_id: habits[1].id, day: day(-i) });
    if (i < 12 && i % 2 === 0) logs.push({ habit_id: habits[2].id, day: day(-i) });
  }
  logs.push({ habit_id: habits[1].id, day: today });
  await ins('habit_logs', logs);

  await ins(
    'moods',
    [4, 3, 4, 5, 2, 3, 4, 4, 3, 5, 4, 4].map((score, i) => ({ day: day(-i - 1), score, note: i === 4 ? 'Exam stress' : '' })),
  );
  await ins('focus_sessions', [
    { started_at: ago(60 * 3), minutes: 25 },
    { started_at: ago(60 * 3.5), minutes: 25 },
    { started_at: ago(60 * 27), minutes: 50 },
    { started_at: ago(60 * 75), minutes: 25 },
  ]);

  const [uni] = await ins('calendar_groups', [{ name: 'University', color: 1 }, { name: 'Personal', color: 4 }]);
  await ins('calendars', [
    { name: 'Lecture timetable', url: 'https://calendar.google.com/calendar/ical/example/basic.ics', emoji: '🎓', color: 1, group_id: uni.id, pinned: true },
    { name: 'Society events', url: 'https://outlook.office365.com/owa/calendar/example/calendar.ics', emoji: '🎭', color: 3, group_id: uni.id },
    { name: 'Office hours (Calendly)', url: 'https://calendly.com/example-prof/office-hours', emoji: '🗓️', color: 5 },
  ]);

  // An active workout plan with one session done, and a draft study plan from Atlas.
  const start = day(-3);
  const [plan, draft] = await ins('plans', [
    {
      title: '4-week workout plan',
      summary: 'Three sessions a week around lectures.',
      request: 'Make me a 4-week workout plan. Mon, Wed and Fri at 7am, 45 minutes',
      weeks: 4,
      start_date: start,
      status: 'active',
      added_at: ago(60 * 24 * 3),
      sessions: [
        { day: 1, start: 420, duration: 45, title: 'Leg day', details: 'squats, lunges, calf raises' },
        { day: 3, start: 420, duration: 45, title: 'Upper body', details: 'push-ups, rows, shoulder press' },
        { day: 5, start: 420, duration: 45, title: 'Full body & core', details: 'deadlifts, planks, burpees' },
      ],
    },
    {
      title: 'Stats exam revision',
      summary: 'Two focused revision blocks a week before the exam.',
      request: 'Study schedule for my stats exam, Tue and Thu evenings',
      weeks: 3,
      start_date: day(1),
      status: 'draft',
      sessions: [
        { day: 2, start: 19 * 60, duration: 60, title: 'Probability', details: 'past paper questions 1–10' },
        { day: 4, start: 19 * 60, duration: 60, title: 'Regression', details: 'lecture notes + practice set' },
      ],
    },
  ]);
  const series = await ins(
    'block_series',
    plan.sessions.map((s) => ({ plan_id: plan.id, title: s.title, details: s.details, days: [s.day], start_min: s.start, duration_min: s.duration, start_date: start, end_date: day(-3 + 27) })),
  );
  for (let d = 0; d < 3; d++) {
    const key = day(-3 + d);
    const s = series.find((x) => x.days[0] === isoWeekday(key));
    if (s) await ins('series_occurrences', [{ series_id: s.id, day: key, done_at: ago(60 * 24 * (3 - d)) }]);
  }

  await ins('atlas_messages', [
    { role: 'user', content: "What's on today?", created_at: ago(30) },
    {
      role: 'assistant',
      content: "Good afternoon, Maya. You've the stats problem set blocked from two until half three, and chapter 4 to read. Your inbox has four notes waiting — shall we sort them later?",
      actions: [],
      created_at: ago(29),
    },
    { role: 'user', content: 'Make me a study schedule for my stats exam, Tue and Thu evenings', created_at: ago(20) },
    {
      role: 'assistant',
      content: "Here's a three-week revision plan, two evenings a week. Add it to your Planner whenever you're ready.",
      actions: [{ tool: 'create_plan', summary: 'Drafted plan “Stats exam revision”', ok: true, plan_id: draft.id }],
      created_at: ago(19),
    },
  ]);

  // Today's ✨ briefing, as if generated earlier (stored in the cache, so no AI call).
  await admin.from('ai_cache').insert({
    user_id: uid,
    feature: 'daily_briefing',
    cache_key: today,
    result: {
      headline: 'A study-heavy day: the problem set is the one that matters.',
      focus: ['Stats problem set (due 5 pm)', 'Read chapter 4 before seminar', 'Email Prof. Okafor'],
      heads_up: ['Dentist booking is 2 days overdue', '4 notes waiting in your inbox'],
    },
  });
  return uid;
}

export async function seedAll(admin) {
  const maya = await seedMaya(admin);
  const fresh = await freshUser(admin, 'newbie@visual.local', '');
  const boss = await seedMaya(admin, 'boss-e2e@e2e.local');
  return { maya, fresh, boss };
}
