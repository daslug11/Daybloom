import { ArrowRight, Lock, Mic } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OrbGlyph } from '../../components/atlas/AtlasOrb';
import { NoteCard } from '../../components/notes/NoteCard';
import { TaskItem } from '../../components/tasks/TaskItem';
import { Card } from '../../components/ui/Card';
import { addDays, dayIn } from '../../lib/dates';
import type { Note, Task } from '../../lib/types';
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

function Feature({ id, eyebrow, title, children, preview, flip }: { id: string; eyebrow: string; title: string; children: ReactNode; preview: ReactNode; flip?: boolean }) {
  return (
    <section id={id} className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:gap-12">
      <div className={flip ? 'md:order-2' : undefined}>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{eyebrow}</h2>
        <p className="mt-2 text-lg font-medium text-ink">{title}</p>
        <div className="muted mt-3 max-w-[60ch] space-y-3 text-base leading-relaxed">{children}</div>
      </div>
      <div className={flip ? 'md:order-1' : undefined} aria-label={`${eyebrow} preview`} role="img">
        <div className="pointer-events-none select-none" aria-hidden>
          {preview}
        </div>
      </div>
    </section>
  );
}

const MORE: { id: string; name: string; title: string; body: string }[] = [
  { id: 'habits', name: 'Habits', title: 'Small things, every day', body: 'Tick off a habit once a day and see your streak and a 12-week history grid. ✨ Suggest habits proposes a few that fit your goals.' },
  { id: 'goals', name: 'Goals', title: 'Goals with a number you can move', body: 'A target like “Read 24 books” that you update as you go, with linked tasks and habits. ✨ Make a plan breaks it into milestones.' },
  { id: 'calendars', name: 'Calendars', title: 'See your real schedule', body: 'Turn on sync for any iCal link (Google, Outlook, Apple and more) and its events appear in your Planner and dashboard. Read-only, refreshed every 10 minutes.' },
  { id: 'focus', name: 'Focus timer', title: 'Work in focused blocks', body: '25 minutes of focus and 5 of rest, or your own lengths. Finished blocks are logged against the task you picked.' },
  { id: 'review', name: 'Mood & Weekly Review', title: 'Look back, then adjust', body: 'A one-tap mood check-in and plain numbers for the last 7 days, each with a note on how it’s calculated. ✨ AI summary suggests three changes for next week.' },
];

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
          Get it out of your head. <span className="text-muted">Get it done.</span>
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
                    <div className="striped flex items-center gap-1 rounded-lg border border-line-strong px-2 py-1.5">
                      <Lock size={11} /> Team sync · from your calendar
                    </div>
                    <div className="rounded-lg bg-accent px-2 py-1.5 font-medium text-accent-ink">Send the quarterly report · 1h</div>
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

        <section id="more" aria-labelledby="more-title" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="more-title" className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            And the rest of your week
          </h2>
          <p className="muted mt-2 max-w-[60ch] text-base">Small tools that plug into the same tasks and calendar, so nothing lives in two places.</p>
          <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {MORE.map((m) => (
              <div key={m.id} id={m.id} className="border-t border-line pt-4">
                <h3 className="font-semibold">{m.name}</h3>
                <p className="mt-1 text-sm font-medium text-ink">{m.title}</p>
                <p className="muted mt-2 text-sm leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        <Feature
          id="atlas"
          flip
          eyebrow="Atlas"
          title="An assistant that can actually do things"
          preview={
            <Card className="space-y-3 !p-4 text-sm">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-accent-ink">Move the report to tomorrow at 10 and add “buy candles” to my list.</div>
              <div className="flex gap-2">
                <OrbGlyph size={24} />
                <div className="max-w-[85%] space-y-2">
                  <div className="rounded-2xl rounded-tl-md bg-raised px-3 py-2">Done. The report is now tomorrow at 10:00, and “Buy candles” is on your list. Anything else, Alex?</div>
                  <div className="faint flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-full border border-atlas/30 px-2 py-0.5">✓ Rescheduled task</span>
                    <span className="rounded-full border border-atlas/30 px-2 py-0.5">✓ Added task</span>
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
        <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            { n: 1, title: 'Capture', body: 'Dump everything into your Brain Dump — typed or spoken — without deciding what it is yet.' },
            { n: 2, title: 'Organise', body: 'Process your inbox into tasks, planner blocks, habits and goals. Let ✨ AI help when it’s a lot.' },
            { n: 3, title: 'Do & review', body: 'Work from your dashboard and Planner, focus with the timer, and look back each week.' },
          ].map((s) => (
            <li key={s.n} className="border-t border-line pt-4">
              <span className="faint text-sm font-medium tabular-nums">Step {s.n}</span>
              <h3 className="mt-1 font-semibold">{s.title}</h3>
              <p className="muted mt-1 text-sm">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Questions</h2>
        <div className="mt-8 space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {f.q}
                  <span className="faint transition-transform duration-fast ease-out group-open:rotate-45" aria-hidden>
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
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Ready to clear your head?</h2>
        <Link to="/signup" className="btn-primary mt-5 !px-6 !py-3 text-base">
          Sign up free <ArrowRight size={17} />
        </Link>
      </section>
    </PublicLayout>
  );
}
