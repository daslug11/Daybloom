import { ArrowRight, Lock, Mic } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OrbGlyph } from '../../components/atlas/AtlasOrb';
import { SyncRow } from '../../components/calendars/SyncToggle';
import { TypeBadge } from '../../components/calendars/TypeBadge';
import { TimerView } from '../../components/focus/TimerDisplay';
import { GoalCard } from '../../components/goals/GoalCard';
import { HabitCard } from '../../components/habits/HabitCard';
import { NoteCard } from '../../components/notes/NoteCard';
import { TaskItem } from '../../components/tasks/TaskItem';
import { Card } from '../../components/ui/Card';
import { addDays, dayIn } from '../../lib/dates';
import type { Goal, Habit, Milestone, Note, Task } from '../../lib/types';
import { PublicLayout } from './PublicLayout';

// Sample data for the previews below. These are the same components the app uses, fed with example content.
const today = dayIn(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', new Date());
const iso = new Date(Date.now() - 3 * 60_000).toISOString();
const note: Note = {
  id: 'n',
  body: 'Plan Sam’s birthday #family\n- [x] Ask Jo about Saturday\n- [ ] Book the restaurant\n- [ ] Order the cake',
  state: 'inbox',
  pinned: false,
  tags: ['family'],
  processed_at: null,
  created_at: iso,
  updated_at: iso,
};
const task = (t: Partial<Task> & { id: string; title: string }): Task => ({
  details: '',
  done: false,
  completed_at: null,
  priority: null,
  tags: [],
  due_date: null,
  due_time: null,
  estimate_min: null,
  top_date: null,
  sched_date: null,
  sched_start: null,
  sched_duration: null,
  goal_id: null,
  milestone_id: null,
  parent_id: null,
  source_note_id: null,
  sort: 0,
  created_at: iso,
  ...t,
});
const tasks = [
  task({ id: 't1', title: 'Send the quarterly report', priority: 'high', due_date: today, due_time: '15:00', top_date: today }),
  task({ id: 't2', title: 'Book the restaurant', due_date: addDays(today, 1), tags: ['family'], source_note_id: 'n' }),
  task({ id: 't3', title: 'Renew car insurance', done: true, completed_at: iso }),
];
const habit: Habit = { id: 'h', name: 'Read 20 minutes', emoji: '📚', goal_id: null, source_note_id: null, archived_at: null, sort: 0, created_at: iso };
const habitDays = new Set(Array.from({ length: 84 }, (_, i) => addDays(today, -i)).filter((_, i) => i < 9 || (i * 7) % 5 < 3));
const goal: Goal = { id: 'g', title: 'Read 24 books', emoji: '📚', target: 24, current: 9, unit: 'books', due_date: null, source_note_id: null, completed_at: null, sort: 0, created_at: iso };
const milestones: Milestone[] = [
  { id: 'm1', goal_id: 'g', title: 'Finish 6 by March', done: true, sort: 0 },
  { id: 'm2', goal_id: 'g', title: 'Join a book club', done: false, sort: 1 },
];

function Feature({ id, eyebrow, title, children, preview, flip }: { id: string; eyebrow: string; title: string; children: ReactNode; preview: ReactNode; flip?: boolean }) {
  return (
    <section id={id} className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:gap-12">
      <div className={flip ? 'md:order-2' : undefined}>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        <div className="muted mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
      </div>
      <div className={flip ? 'md:order-1' : undefined} aria-label={`${eyebrow} preview`} role="img">
        <div className="pointer-events-none select-none" aria-hidden>
          {preview}
        </div>
      </div>
    </section>
  );
}

const FAQ: { q: string; a: ReactNode }[] = [
  { q: 'Is Daybloom free?', a: 'Yes. Everything — notes, tasks, planner, habits, goals, calendars, focus timer, mood and weekly review — is free to use.' },
  {
    q: 'How do the ✨ AI features work, and why is there a daily limit?',
    a: 'AI only runs when you press a ✨ button or talk to Atlas — never in the background. Each press uses one from your daily allowance, shown as “✨ N left today” at the top of the app. The allowance resets at midnight UTC. Results that haven’t changed (like today’s briefing) are reused for free. There is also an overall budget for the whole site; if it’s reached, AI rests until the next day while everything else keeps working.',
  },
  {
    q: 'What happens to my data?',
    a: (
      <>
        Your data is stored in a database protected so that only your account can read it. When you use an AI feature, only the bits that feature needs (for example, the note you asked about) are sent to our AI provider to produce the answer. We don’t sell your data or use it for ads. You can export everything as JSON or delete your account and all data from Settings at any time. Details in the{' '}
        <Link to="/privacy" className="link">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  { q: 'Does it sync my Google or Outlook calendar?', a: 'Yes, read-only. Paste your calendar’s secret iCal (ICS) address and events show in your Planner and dashboard so you can plan around them. Daybloom never changes your calendar.' },
  { q: 'Does voice mode work in every browser?', a: 'Speaking to Atlas uses your browser’s speech recognition, which works in Chrome, Edge and Safari. In other browsers you can type in voice mode instead. Replies are read aloud with a voice from your device.' },
  { q: 'Can I use it on my phone?', a: 'Yes. Daybloom works in any modern mobile browser, with a tab bar for the main pages.' },
];

export default function Landing() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
          Get it out of your head. <span className="gradient-text">Get it done.</span>
        </h1>
        <p className="muted mx-auto mt-5 max-w-2xl text-lg">
          Daybloom is a personal organiser built around a Brain Dump: capture every thought in one place, then turn it into tasks, time on your calendar, habits and goals. An assistant called Atlas can help — by chat or by voice.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/signup" className="btn-primary !px-6 !py-3 text-base">
            Sign up free <ArrowRight size={17} />
          </Link>
          <Link to="/login" className="btn-ghost !px-6 !py-3 text-base">
            Log in
          </Link>
        </div>
        <p className="faint mt-4 text-sm">Free. No card needed. Export or delete your data any time.</p>
      </section>

      <div id="features">
        <Feature
          id="brain-dump"
          eyebrow="Brain Dump"
          title="One inbox for everything on your mind"
          preview={<NoteCard note={note} showState links="Linked: 1 task" />}
        >
          <p>Press N anywhere, tap +, or just talk. Notes support checklists, #tags, pinning and search.</p>
          <p>
            When you have a minute, <strong>Process inbox</strong> walks through each note: make it a task, block time for it, add it to a goal, keep it as an idea or archive it. Converted items link back to the note they came from.
          </p>
          <p>✨ AI can sort your inbox, pull out action items, summarise your week of notes or turn an idea into a plan — only when you ask.</p>
        </Feature>

        <Feature
          id="tasks"
          flip
          eyebrow="Tasks & Planner"
          title="Type it like you’d say it"
          preview={
            <div className="space-y-2">
              {tasks.map((t) => (
                <TaskItem key={t.id} task={t} today={today} />
              ))}
              <Card className="!p-3">
                <div className="flex gap-3 text-xs">
                  <span className="faint w-12 pt-1 tabular-nums">2 PM</span>
                  <div className="flex-1 space-y-1.5">
                    <div className="striped flex items-center gap-1 rounded-lg border border-slate-400/30 px-2 py-1.5">
                      <Lock size={11} /> Team sync · from your calendar
                    </div>
                    <div className="rounded-lg bg-violet-600 px-2 py-1.5 font-medium text-white">Send the quarterly report · 1h</div>
                  </div>
                </div>
              </Card>
            </div>
          }
        >
          <p>“Send report friday 3pm !high #work” becomes a task with a due date, time, priority and tag. Star up to three tasks as today’s top 3.</p>
          <p>The Planner is a week view in 15-minute steps. Drag tasks onto it to block time; your synced calendar events show alongside, locked.</p>
          <p>✨ Plan my day suggests blocks for your open tasks in your free time. You accept or discard each one. ✨ Break it down splits a big task into steps.</p>
        </Feature>

        <Feature id="habits" eyebrow="Habits" title="Small things, every day" preview={<HabitCard habit={habit} today={today} days={habitDays} streak={9} />}>
          <p>Tick off a habit once a day. You see your current streak and a 12-week history grid — nothing more complicated than that.</p>
          <p>✨ Suggest habits proposes a few that fit the goals you’ve set.</p>
        </Feature>

        <Feature id="goals" flip eyebrow="Goals" title="Goals with a number you can move" preview={<GoalCard goal={goal} milestones={milestones} openTasks={3} habits={1} />}>
          <p>A goal has a target — “Read 24 books”, “Run 100 km” — and you update progress as you go. Link tasks and habits to it.</p>
          <p>✨ Make a plan breaks a goal into milestones and first tasks you can edit before adding.</p>
        </Feature>

        <Feature
          id="calendars"
          eyebrow="Calendars"
          title="See your real schedule"
          preview={
            <Card className="!p-0">
              <div className="flex items-center gap-3 p-4 pb-2">
                <span className="text-2xl">💼</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Work calendar</p>
                  <p className="faint truncate text-xs">calendar.google.com/…/basic.ics</p>
                </div>
                <TypeBadge type="google" />
              </div>
              <SyncRow enabled status={{ state: 'ok', count: 14, fetchedAt: new Date().toISOString() }} onToggle={() => {}} />
            </Card>
          }
        >
          <p>Keep all your calendar links in one place, grouped your way. Turn on sync for any iCal link (Google, Outlook, Apple, and more) and its events appear in your Planner and dashboard.</p>
          <p>Sync is read-only and refreshes every 10 minutes.</p>
        </Feature>

        <Feature id="focus" flip eyebrow="Focus timer" title="Work in focused blocks" preview={<div className="flex justify-center"><TimerView mode="work" remaining={17 * 60 + 42} total={25 * 60} running taskTitle="Send the quarterly report" size={220} /></div>}>
          <p>A Pomodoro timer: 25 minutes of focus, 5 of rest (or your own lengths). Pick a task and finished blocks are logged against it, so you see where your time went.</p>
        </Feature>

        <Feature
          id="review"
          eyebrow="Mood & Weekly Review"
          title="Look back, then adjust"
          preview={
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Tasks completed', value: '18', sub: '▲ 4 vs the 7 days before' },
                { label: 'Habit consistency', value: '76%', sub: '16 of 21 habit-days' },
                { label: 'Average mood', value: '3.9/5', sub: '🙂 from 6 check-ins' },
                { label: 'Focus time', value: '6h 15m', sub: 'From finished blocks' },
              ].map((t) => (
                <Card key={t.label} className="!p-4">
                  <p className="muted text-[11px] font-semibold uppercase tracking-wider">{t.label}</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{t.value}</p>
                  <p className="muted text-xs">{t.sub}</p>
                </Card>
              ))}
            </div>
          }
        >
          <p>A one-tap daily mood check-in and a weekly chart. The Weekly Review shows plain numbers for the last 7 days, each with a note on how it’s calculated.</p>
          <p>✨ AI summary writes a short review with three specific suggestions for next week. ✨ Reflect looks for patterns in your mood notes.</p>
        </Feature>

        <Feature
          id="atlas"
          flip
          eyebrow="Atlas"
          title="An assistant that can actually do things"
          preview={
            <Card className="space-y-3 !p-4 text-sm">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-violet-600 px-3 py-2 text-white">Move the report to tomorrow at 10 and add “buy candles” to my list.</div>
              <div className="flex gap-2">
                <OrbGlyph size={24} />
                <div className="max-w-[85%] space-y-2">
                  <div className="rounded-2xl rounded-tl-md bg-slate-900/5 px-3 py-2 dark:bg-white/[0.06]">Done. The report is now tomorrow at 10:00, and “Buy candles” is on your list. Anything else, Alex?</div>
                  <div className="faint flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full border border-cyan-500/30 px-2 py-0.5">✓ Rescheduled task</span>
                    <span className="rounded-full border border-cyan-500/30 px-2 py-0.5">✓ Added task</span>
                  </div>
                </div>
              </div>
            </Card>
          }
        >
          <p>Atlas is a calm, slightly dry assistant built into Daybloom. Ask what’s on today, add or move tasks, capture notes, log habits or update goals. It tells you exactly what it changed, and asks before deleting anything.</p>
          <p>
            <Mic size={14} className="mr-1 inline" />
            Open voice mode for a full-screen, hands-free view: speak your request and Atlas answers out loud. Each Atlas reply uses one from your daily ✨ allowance.
          </p>
        </Feature>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { n: 1, title: 'Capture', body: 'Dump everything into your Brain Dump — typed or spoken — without deciding what it is yet.' },
            { n: 2, title: 'Organise', body: 'Process your inbox into tasks, planner blocks, habits and goals. Let ✨ AI help when it’s a lot.' },
            { n: 3, title: 'Do & review', body: 'Work from your dashboard and Planner, focus with the timer, and look back each week.' },
          ].map((s) => (
            <li key={s.n}>
              <Card className="h-full">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">{s.n}</span>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="muted mt-1 text-sm">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Questions</h2>
        <div className="mt-8 space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="glass group p-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {f.q}
                  <span className="faint transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </span>
              </summary>
              <div className="muted mt-3 text-sm leading-relaxed">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 text-center sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight">Ready to clear your head?</h2>
        <Link to="/signup" className="btn-primary mt-5 !px-6 !py-3 text-base">
          Sign up free <ArrowRight size={17} />
        </Link>
      </section>
    </PublicLayout>
  );
}
