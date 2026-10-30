import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, Flame, Inbox, ListChecks, Lock, Repeat, Smile } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoodPicker } from '../../components/mood/MoodPicker';
import { GettingStarted } from '../../components/onboarding/Checklist';
import { TaskItem } from '../../components/tasks/TaskItem';
import { AiButton } from '../../components/ui/Ai';
import { Card, CardTitle } from '../../components/ui/Card';
import { ErrorState, LoadingList } from '../../components/ui/States';
import { useHabitLogs, useHabits, useToggleHabitLog } from '../../hooks/data/habits';
import { useMoods, useSetMood } from '../../hooks/data/moods';
import { useNotes } from '../../hooks/data/notes';
import { useOccurrenceRows, usePlans, useRecurring, useSeries } from '../../hooks/data/plans';
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
/** A cached briefing plus when it was written, so it can say how fresh it is. */
interface StoredBriefing {
  result: Briefing;
  at: string;
}

/** A query failed and there's nothing real to show: never pretend it's zero. */
const failed = (q: { isError: boolean; data: unknown }) => q.isError && q.data === undefined;
const UNKNOWN = '—';

/** Compact error for a dashboard card: says what didn't load and offers Retry. */
function CardError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return <ErrorState className="!py-3" message={`Couldn’t load ${what}.`} onRetry={onRetry} />;
}

export default function Dashboard() {
  const uid = useUserId();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { today, minutes, tz } = useToday(30_000);
  const navigate = useNavigate();
  const tasks = useTasks();
  const habitsQ = useHabits();
  const habits = (habitsQ.data ?? []).filter((h) => !h.archived_at);
  const logsQ = useHabitLogs(today);
  const logs = logsQ.data ?? [];
  const notesQ = useNotes();
  const notes = notesQ.data ?? [];
  const moodsQ = useMoods(today);
  const moods = moodsQ.data ?? [];
  // The schedule is built from these too; if one fails the schedule would be silently incomplete.
  const plansQ = usePlans();
  const seriesQ = useSeries();
  const occurrencesQ = useOccurrenceRows();
  const { events, syncing, errorCount, requestError, sync } = useCalendarSync();
  const toggleTask = useToggleTask();
  const toggleHabit = useToggleHabitLog();
  const setMood = useSetMood();
  const { openCapture } = useAppActions();
  const briefingAi = useAi<Briefing>('daily_briefing');
  const recurring = useRecurring(today, today);

  // Today's briefing, if it was already generated (read from the cache — no AI call).
  const briefing = useQuery({
    queryKey: ['briefing', uid, today],
    queryFn: async (): Promise<StoredBriefing | null> => {
      const { data } = await supabase.from('ai_cache').select('result, created_at').eq('feature', 'daily_briefing').eq('cache_key', today).maybeSingle();
      return data ? { result: data.result as Briefing, at: data.created_at as string } : null;
    },
  });
  const requestBriefing = (force = false) =>
    briefingAi.mutate({ force }, { onSuccess: (r) => qc.setQueryData<StoredBriefing>(['briefing', uid, today], { result: r.result, at: new Date().toISOString() }) });

  const all = tasks.data ?? [];
  const top = all.filter((t) => !t.done && !t.parent_id && t.top_date === today);
  const due = all.filter((t) => !t.done && !t.parent_id && t.top_date !== today && t.due_date && t.due_date <= today);
  const doneToday = all.filter((t) => t.done && t.completed_at && dayIn(tz, new Date(t.completed_at)) === today).length;

  const schedule = useMemo(() => {
    const items: { key: string; start: number; end: number; title: string; kind: 'event' | 'task' | 'repeat' }[] = [];
    for (const o of recurring) {
      if (!o.done) items.push({ key: `${o.series_id}:${o.day}`, start: o.start, end: o.start + o.duration, title: o.title, kind: 'repeat' });
    }
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
  }, [events, all, today, tz, minutes, recurring]);
  const allDayToday = events.filter((e) => e.allDay && e.start.slice(0, 10) <= today && today < e.end.slice(0, 10));

  const logSet = new Set(logs.filter((l) => l.day === today).map((l) => l.habit_id));
  const habitsLeft = habits.filter((h) => !logSet.has(h.id));
  const inbox = notes.filter((n) => n.state === 'inbox');
  const mood = moods.find((m) => m.day === today);
  const name = profile?.name || 'there';

  const tasksFailed = failed(tasks);
  const notesFailed = failed(notesQ);
  const habitsFailed = failed(habitsQ) || failed(logsQ);
  const moodFailed = failed(moodsQ);
  const recurringFailed = failed(plansQ) || failed(seriesQ) || failed(occurrencesQ);
  // The calendar feed request itself failing means events are missing, so the count would be wrong.
  const scheduleFailed = tasksFailed || recurringFailed || !!requestError;
  const retrySchedule = () => {
    for (const q of [tasks, plansQ, seriesQ, occurrencesQ]) if (q.isError) q.refetch();
    if (requestError) sync();
  };
  const taskCount = top.length + due.length;
  const plural = (n: number, failedToLoad: boolean) => (n === 1 && !failedToLoad ? '' : 's');

  // Has anything the briefing was written from changed since? Then say so, rather than let it contradict the live counts.
  const briefingAt = briefing.data?.at ?? '';
  const changedSinceBriefing =
    !!briefingAt &&
    (all.some((t) => t.created_at > briefingAt || (t.completed_at ?? '') > briefingAt) || notes.some((n) => n.created_at > briefingAt || (n.processed_at ?? '') > briefingAt));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="muted text-sm">{parseKey(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="page-title">
            {greeting(minutes)}, {name}
          </h1>
          <p className="muted mt-1 text-sm">
            {tasksFailed ? UNKNOWN : taskCount} task{plural(taskCount, tasksFailed)} for today · {scheduleFailed ? UNKNOWN : schedule.length} thing{plural(schedule.length, scheduleFailed)} still on the
            schedule · {tasksFailed ? UNKNOWN : doneToday} done so far
            {(tasksFailed || scheduleFailed) && <span className="sr-only"> (a dash means that number couldn’t be loaded)</span>}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GettingStarted />

        <Card aria-label="Today's tasks">
          <CardTitle icon={<ListChecks size={16} className="text-muted" />} action={<Link to="/app/tasks" className="link text-xs">All tasks <ArrowRight size={11} className="inline" /></Link>}>
            Top tasks
          </CardTitle>
          {tasks.isLoading ? (
            <LoadingList rows={3} />
          ) : tasksFailed ? (
            <CardError what="your tasks" onRetry={() => tasks.refetch()} />
          ) : taskCount ? (
            <ul className="-my-2.5 divide-y divide-line">
              {[...top, ...due].slice(0, 6).map((t) => (
                <li key={t.id}>
                  <TaskItem flat task={t} today={today} onToggle={toggleTask} onOpen={(x) => navigate(`/app/tasks?task=${x.id}`)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted text-sm">
              Nothing due today. On the <Link to="/app/tasks" className="link">Tasks</Link> page, star (☆) up to three tasks to make them today’s top 3.
            </p>
          )}
        </Card>

        <Card aria-label="Brain dump inbox">
          <CardTitle icon={<Inbox size={16} className="text-muted" />} action={<Link to="/app/brain-dump" className="link text-xs">Brain Dump <ArrowRight size={11} className="inline" /></Link>}>
            Inbox · {notesFailed ? UNKNOWN : inbox.length}
          </CardTitle>
          {notesQ.isLoading ? (
            <LoadingList rows={2} label="Loading your inbox" />
          ) : notesFailed ? (
            <CardError what="your inbox" onRetry={() => notesQ.refetch()} />
          ) : inbox.length === 0 ? (
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
              {inbox.length > 3 && <p className="faint mt-1 text-xs">and {inbox.length - 3} more</p>}
              <Link to="/app/brain-dump?process=1" className="btn-primary mt-3 !py-2">
                Process inbox
              </Link>
            </>
          )}
        </Card>

        {briefing.data ? (
          <Card className="lg:col-span-2" aria-label="Daily briefing">
            <CardTitle
              action={
                <AiButton size="sm" loading={briefingAi.isPending} onClick={() => requestBriefing(true)} hint="Rewrite today’s briefing">
                  Refresh
                </AiButton>
              }
            >
              ✨ Daily briefing
            </CardTitle>
            <p className="faint -mt-2 mb-3 text-xs">
              Written at {new Date(briefing.data.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} from your data.
              {changedSinceBriefing && ' Your tasks or inbox have changed since, so parts may be out of date.'}
            </p>
            <div className={cn('space-y-3 text-sm', changedSinceBriefing && 'opacity-70')}>
              <p className="font-medium">{briefing.data.result.headline}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {briefing.data.result.focus.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Focus on</h3>
                    <ul className="list-disc space-y-0.5 pl-5">{briefing.data.result.focus.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  </div>
                )}
                {briefing.data.result.heads_up.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Heads up</h3>
                    <ul className="list-disc space-y-0.5 pl-5">{briefing.data.result.heads_up.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <section aria-label="Daily briefing" className="flex flex-col items-start gap-3 rounded-card border border-dashed border-line-strong px-5 py-4 sm:flex-row sm:items-center lg:col-span-2">
            <p className="muted text-sm sm:flex-1">
              <span className="font-medium text-ink">✨ Daily briefing.</span> A short read of your day — schedule, priorities and anything overdue — written from your own data when you ask.
            </p>
            <AiButton size="sm" loading={briefingAi.isPending || briefing.isLoading} onClick={() => requestBriefing()} hint="Summarise today from your tasks, schedule and habits">
              Get today’s briefing
            </AiButton>
          </section>
        )}

        <Card aria-label="Today's schedule">
          <CardTitle icon={<CalendarClock size={16} className="text-muted" />} action={<Link to="/app/planner" className="link text-xs">Planner <ArrowRight size={11} className="inline" /></Link>}>
            Schedule
          </CardTitle>
          {(errorCount > 0 || requestError) && (
            <Link to="/app/calendars" className="mb-3 block rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              Some calendars didn’t sync — fix on the Calendars page →
            </Link>
          )}
          {allDayToday.length > 0 && <p className="muted mb-2 text-xs">All day: {allDayToday.map((e) => e.title).join(', ')}</p>}
          {tasksFailed || recurringFailed ? (
            <CardError what="everything on your schedule" onRetry={retrySchedule} />
          ) : syncing && !schedule.length ? (
            <LoadingList rows={2} label="Loading your schedule" />
          ) : schedule.length ? (
            <ul className="-my-2 divide-y divide-line">
              {schedule.slice(0, 6).map((i) => {
                const now = i.start <= minutes && i.end > minutes;
                return (
                  <li key={i.key} className={cn('flex items-center gap-3 py-2 text-sm', now && 'font-medium')}>
                    <span className="faint w-20 shrink-0 text-xs tabular-nums">{formatMinutes(i.start)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {i.kind === 'event' && <Lock size={11} className="faint mr-1 inline" aria-label="calendar event" />}
                      {i.kind === 'repeat' && <Repeat size={11} className="faint mr-1 inline" aria-label="repeating block" />}
                      {i.title}
                    </span>
                    {now && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink">Now</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted text-sm">
              Nothing more scheduled today. <Link to="/app/planner" className="link">Block time</Link> for a task, or <Link to="/app/calendars" className="link">sync a calendar</Link>.
            </p>
          )}
        </Card>

        <Card aria-label="Habits due today">
          <CardTitle icon={<Flame size={16} className="text-muted" />} action={<Link to="/app/habits" className="link text-xs">Habits <ArrowRight size={11} className="inline" /></Link>}>
            Habits · {habitsFailed ? UNKNOWN : `${habits.length - habitsLeft.length}/${habits.length}`} today
          </CardTitle>
          {habitsQ.isLoading || logsQ.isLoading ? (
            <LoadingList rows={1} label="Loading your habits" />
          ) : habitsFailed ? (
            <CardError
              what="your habits"
              onRetry={() => {
                if (habitsQ.isError) habitsQ.refetch();
                if (logsQ.isError) logsQ.refetch();
              }}
            />
          ) : habits.length === 0 ? (
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

        <Card aria-label="Mood check-in" className="lg:col-span-2">
          <CardTitle icon={<Smile size={16} className="text-muted" />} action={<Link to="/app/mood" className="link text-xs">Mood <ArrowRight size={11} className="inline" /></Link>}>
            {moodFailed ? 'Mood' : mood ? `Today you’re feeling ${MOODS[mood.score - 1].label.toLowerCase()} ${MOODS[mood.score - 1].emoji}` : 'How are you feeling today?'}
          </CardTitle>
          {moodFailed ? (
            <CardError what="today’s check-in" onRetry={() => moodsQ.refetch()} />
          ) : (
            <div className="max-w-md">
              <MoodPicker size="sm" value={mood?.score} onPick={(score) => setMood.mutate({ day: today, score, note: mood?.note ?? '' })} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
