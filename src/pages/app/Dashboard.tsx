import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Flame, Inbox, ListChecks, Lock, Smile } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MoodPicker } from '../../components/mood/MoodPicker';
import { GettingStarted } from '../../components/onboarding/Checklist';
import { TaskItem } from '../../components/tasks/TaskItem';
import { AiAllowance, AiButton } from '../../components/ui/Ai';
import { Card, CardTitle } from '../../components/ui/Card';
import { LoadingList } from '../../components/ui/States';
import { useHabitLogs, useHabits, useToggleHabitLog } from '../../hooks/data/habits';
import { useMoods, useSetMood } from '../../hooks/data/moods';
import { useNotes } from '../../hooks/data/notes';
import { useTasks, useToggleTask } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import { useAppActions } from '../../hooks/useAppActions';
import { useUserId } from '../../hooks/useAuth';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useProfile, useToday } from '../../hooks/useProfile';
import { dayIn, greeting, parseKey } from '../../lib/dates';
import { MOODS } from '../../lib/moods';
import { formatMinutes, minutesOfDay } from '../../lib/planner';
import { supabase } from '../../lib/supabase';
import { clip, firstLine } from '../../lib/text';
import { cn } from '../../lib/utils';

interface Briefing {
  headline: string;
  focus: string[];
  heads_up: string[];
}

export default function Dashboard() {
  const uid = useUserId();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { today, minutes, tz } = useToday(30_000);
  const tasks = useTasks();
  const { data: allHabits = [] } = useHabits();
  const habits = allHabits.filter((h) => !h.archived_at);
  const { data: logs = [] } = useHabitLogs(today);
  const { data: notes = [] } = useNotes();
  const { data: moods = [] } = useMoods(today);
  const { events, syncing, errorCount, requestError } = useCalendarSync();
  const toggleTask = useToggleTask();
  const toggleHabit = useToggleHabitLog();
  const setMood = useSetMood();
  const { openCapture } = useAppActions();
  const briefingAi = useAi<Briefing>('daily_briefing');

  // Today's briefing, if it was already generated (read from the cache — no AI call).
  const briefing = useQuery({
    queryKey: ['briefing', uid, today],
    queryFn: async () => {
      const { data } = await supabase.from('ai_cache').select('result').eq('feature', 'daily_briefing').eq('cache_key', today).maybeSingle();
      return (data?.result as Briefing | undefined) ?? null;
    },
  });
  const requestBriefing = (force = false) =>
    briefingAi.mutate({ force }, { onSuccess: (r) => qc.setQueryData(['briefing', uid, today], r.result) });

  const all = tasks.data ?? [];
  const top = all.filter((t) => !t.done && !t.parent_id && t.top_date === today);
  const due = all.filter((t) => !t.done && !t.parent_id && t.top_date !== today && t.due_date && t.due_date <= today);
  const doneToday = all.filter((t) => t.done && t.completed_at && dayIn(tz, new Date(t.completed_at)) === today).length;

  const schedule = useMemo(() => {
    const items: { key: string; start: number; end: number; title: string; kind: 'event' | 'task' }[] = [];
    for (const e of events) {
      if (e.allDay) continue;
      const s = new Date(e.start);
      const en = new Date(e.end);
      if (dayIn(tz, s) !== today && dayIn(tz, en) !== today) continue;
      items.push({ key: e.id, start: dayIn(tz, s) === today ? minutesOfDay(s) : 0, end: dayIn(tz, en) === today ? minutesOfDay(en) : 1440, title: e.title, kind: 'event' });
    }
    for (const t of all) {
      if (t.sched_date !== today || t.sched_start == null || t.done) continue;
      items.push({ key: t.id, start: t.sched_start, end: t.sched_start + (t.sched_duration ?? 0), title: t.title, kind: 'task' });
    }
    return items.filter((i) => i.end > minutes - 1).sort((a, b) => a.start - b.start);
  }, [events, all, today, tz, minutes]);
  const allDayToday = events.filter((e) => e.allDay && e.start.slice(0, 10) <= today && today < e.end.slice(0, 10));

  const logSet = new Set(logs.filter((l) => l.day === today).map((l) => l.habit_id));
  const habitsLeft = habits.filter((h) => !logSet.has(h.id));
  const inbox = notes.filter((n) => n.state === 'inbox');
  const mood = moods.find((m) => m.day === today);
  const name = profile?.name || 'there';

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="muted text-sm">{parseKey(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="gradient-text text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting(minutes)}, {name}
          </h1>
          <p className="muted mt-1 text-sm">
            {top.length + due.length} task{top.length + due.length === 1 ? '' : 's'} for today · {schedule.length} thing{schedule.length === 1 ? '' : 's'} still on the schedule · {doneToday} done so far
          </p>
        </div>
        <AiAllowance />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <GettingStarted />

        <Card className="lg:col-span-2" aria-label="Daily briefing">
          <CardTitle
            action={
              briefing.data ? (
                <AiButton size="sm" loading={briefingAi.isPending} onClick={() => requestBriefing(true)} hint="Rewrite today’s briefing">
                  Refresh
                </AiButton>
              ) : null
            }
          >
            ✨ Daily briefing
          </CardTitle>
          {briefing.data ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium">{briefing.data.headline}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {briefing.data.focus.length > 0 && (
                  <div>
                    <p className="faint mb-1 text-xs font-semibold uppercase tracking-wider">Focus on</p>
                    <ul className="list-disc space-y-0.5 pl-5">{briefing.data.focus.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  </div>
                )}
                {briefing.data.heads_up.length > 0 && (
                  <div>
                    <p className="faint mb-1 text-xs font-semibold uppercase tracking-wider">Heads up</p>
                    <ul className="list-disc space-y-0.5 pl-5">{briefing.data.heads_up.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="muted flex-1 text-sm">A short read of your day — schedule, priorities and anything overdue — written from your own data. Generated once a day when you ask.</p>
              <AiButton loading={briefingAi.isPending || briefing.isLoading} onClick={() => requestBriefing()} hint="Summarise today from your tasks, schedule and habits">
                Get today’s briefing
              </AiButton>
            </div>
          )}
        </Card>

        <Card aria-label="Today's schedule">
          <CardTitle icon={<CalendarClock size={16} className="text-blue-600 dark:text-blue-300" />} action={<Link to="/app/planner" className="link text-xs">Planner <ArrowRight size={11} className="inline" /></Link>}>
            Schedule
          </CardTitle>
          {(errorCount > 0 || requestError) && (
            <Link to="/app/calendars" className="mb-3 block rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
              Some calendars didn’t sync — fix on the Calendars page →
            </Link>
          )}
          {allDayToday.length > 0 && <p className="muted mb-2 text-xs">All day: {allDayToday.map((e) => e.title).join(', ')}</p>}
          {syncing && !schedule.length ? (
            <LoadingList rows={2} label="Loading your schedule" />
          ) : schedule.length ? (
            <ul className="space-y-1.5">
              {schedule.slice(0, 6).map((i) => {
                const now = i.start <= minutes && i.end > minutes;
                return (
                  <li key={i.key} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2 text-sm', now ? 'border-violet-400/50 bg-violet-500/10' : 'border-slate-900/5 dark:border-white/5')}>
                    <span className="faint w-20 shrink-0 text-xs tabular-nums">{formatMinutes(i.start)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {i.kind === 'event' && <Lock size={11} className="faint mr-1 inline" aria-label="calendar event" />}
                      {i.title}
                    </span>
                    {now && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">Now</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted text-sm">
              Nothing else scheduled today. <Link to="/app/planner" className="link">Block time</Link> for a task, or <Link to="/app/calendars" className="link">sync a calendar</Link>.
            </p>
          )}
        </Card>

        <Card aria-label="Today's tasks">
          <CardTitle icon={<ListChecks size={16} className="text-violet-600 dark:text-violet-300" />} action={<Link to="/app/tasks" className="link text-xs">All tasks <ArrowRight size={11} className="inline" /></Link>}>
            Top tasks
          </CardTitle>
          {tasks.isLoading ? (
            <LoadingList rows={3} />
          ) : top.length + due.length ? (
            <ul className="space-y-1.5">
              {[...top, ...due].slice(0, 6).map((t) => (
                <li key={t.id}>
                  <TaskItem task={t} today={today} onToggle={toggleTask} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted text-sm">
              Nothing due today. On the <Link to="/app/tasks" className="link">Tasks</Link> page, star (☆) up to three tasks to make them today’s top 3.
            </p>
          )}
        </Card>

        <Card aria-label="Habits due today">
          <CardTitle icon={<Flame size={16} className="text-orange-500" />} action={<Link to="/app/habits" className="link text-xs">Habits <ArrowRight size={11} className="inline" /></Link>}>
            Habits · {habits.length - habitsLeft.length}/{habits.length} today
          </CardTitle>
          {habits.length === 0 ? (
            <p className="muted text-sm">
              No habits yet. <Link to="/app/habits" className="link">Add one</Link> — something small you want to do daily.
            </p>
          ) : habitsLeft.length === 0 ? (
            <p className="text-sm">All done for today. 🎉</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {habitsLeft.map((h) => (
                <button key={h.id} className="chip-off !py-1.5" onClick={() => toggleHabit.mutate({ habit_id: h.id, day: today, done: true })} aria-label={`Mark ${h.name} done today`}>
                  {h.emoji} {h.name}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card aria-label="Brain dump inbox">
          <CardTitle icon={<Inbox size={16} className="text-violet-600 dark:text-violet-300" />} action={<Link to="/app/brain-dump" className="link text-xs">Brain Dump <ArrowRight size={11} className="inline" /></Link>}>
            Inbox · {inbox.length}
          </CardTitle>
          {inbox.length === 0 ? (
            <p className="muted text-sm">
              Empty. Press <kbd className="kbd">N</kbd> or{' '}
              <button className="link" onClick={() => openCapture()}>
                capture a thought
              </button>{' '}
              whenever something’s on your mind.
            </p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                {inbox.slice(0, 3).map((n) => (
                  <li key={n.id} className="truncate">
                    • {clip(firstLine(n.body), 90)}
                  </li>
                ))}
              </ul>
              <Link to="/app/brain-dump?process=1" className="btn-primary mt-3 !py-2">
                Process inbox
              </Link>
            </>
          )}
        </Card>

        <Card aria-label="Mood check-in" className="lg:col-span-2">
          <CardTitle icon={<Smile size={16} className="text-pink-500" />} action={<Link to="/app/mood" className="link text-xs">Mood <ArrowRight size={11} className="inline" /></Link>}>
            {mood ? `Today you’re feeling ${MOODS[mood.score - 1].label.toLowerCase()} ${MOODS[mood.score - 1].emoji}` : 'How are you feeling today?'}
          </CardTitle>
          <div className="max-w-md">
            <MoodPicker size="sm" value={mood?.score} onPick={(score) => setMood.mutate({ day: today, score, note: mood?.note ?? '' })} />
          </div>
        </Card>
      </div>
    </div>
  );
}
