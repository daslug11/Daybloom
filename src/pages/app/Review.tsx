import { RefreshCw } from 'lucide-react';
import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { AiButton } from '../../components/ui/Ai';
import { Card, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingList } from '../../components/ui/States';
import { useFocusSessions } from '../../hooks/data/focus';
import { useHabitLogs, useHabits } from '../../hooks/data/habits';
import { useMoods } from '../../hooks/data/moods';
import { useNotes } from '../../hooks/data/notes';
import { useTasks } from '../../hooks/data/tasks';
import { useUserId } from '../../hooks/useAuth';
import { useAi, useAiStatus } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { addDays, dayIn, formatDay, parseKey } from '../../lib/dates';
import { MOODS } from '../../lib/moods';
import { formatDuration } from '../../lib/format';
import { useSavedResult } from '../../lib/savedResult';
import { deltaText, habitDays, habitStartDay, lastDays, meanScore } from '../../lib/stats';

// The chart library is large; load it after the numbers are on screen.
const ReviewChart = lazy(() => import('../../components/review/ReviewChart'));

interface Source {
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Loading / error / retry across the queries a section depends on. */
function from(...qs: Source[]) {
  return {
    loading: qs.some((q) => q.isLoading),
    failed: qs.some((q) => q.error),
    retry: () => qs.forEach((q) => q.error && q.refetch()),
  };
}

/** Shown in place of a number when its data didn't load — never a fake zero. */
function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="text-sm">
      <p className="muted">{what} didn’t load, so it isn’t shown.</p>
      <button className="btn-ghost mt-2 !px-3 !py-1.5 text-xs" onClick={onRetry}>
        <RefreshCw size={13} aria-hidden /> Try again
      </button>
    </div>
  );
}

interface Summary {
  summary: string;
  suggestions: string[];
  cached: boolean;
  /** The stats it was written from, to tell the user when their numbers have moved on. */
  stats: string;
}

const LIST_MAX = 20;

export default function Review() {
  const { today, tz } = useToday();
  const uid = useUserId();
  const tasks = useTasks();
  const habits = useHabits();
  const logs = useHabitLogs(today);
  const moods = useMoods(today);
  const sessions = useFocusSessions();
  const notes = useNotes();
  const summary = useAi<{ summary: string; suggestions: string[] }>('weekly_summary');
  const { data: aiStatus } = useAiStatus();
  const start = addDays(today, -6);
  const prevStart = addDays(today, -13);
  const [ai, setAi] = useSavedResult<Summary>(['weekly_summary', uid, start]);
  const days = lastDays(today, 7);

  const src = {
    tasks: from(tasks),
    habits: from(habits, logs),
    moods: from(moods),
    focus: from(sessions),
    notes: from(notes),
    all: from(tasks, habits, logs, moods, sessions, notes),
  };

  const s = useMemo(() => {
    const all = tasks.data ?? [];
    const doneOn = (t: (typeof all)[number]) => (t.completed_at ? dayIn(tz, new Date(t.completed_at)) : null);
    const done = all.filter((t) => t.done && !t.parent_id && (doneOn(t) ?? '') >= start);
    const donePrev = all.filter((t) => t.done && !t.parent_id && (doneOn(t) ?? '') >= prevStart && (doneOn(t) ?? '') < start);
    const overdue = all.filter((t) => !t.done && !t.parent_id && t.due_date && t.due_date < today);

    // One rule for the tile, the per-habit list and the chart (see habitDays).
    const logDays = new Map<string, Set<string>>();
    for (const l of logs.data ?? []) {
      if (!logDays.has(l.habit_id)) logDays.set(l.habit_id, new Set());
      logDays.get(l.habit_id)!.add(l.day);
    }
    const perHabit = (habits.data ?? []).map((h) => {
      const set = logDays.get(h.id) ?? new Set<string>();
      const first = habitStartDay(dayIn(tz, new Date(h.created_at)), set);
      return { habit: h, set, first, ...habitDays({ start: first, logDays: set, days, today }) };
    });
    const hits = perHabit.reduce((a, h) => a + h.done, 0);
    const possible = perHabit.reduce((a, h) => a + h.possible, 0);

    const weekMoods = (moods.data ?? []).filter((m) => m.day >= start && m.day <= today);
    const avgMood = meanScore(weekMoods.map((m) => m.score));
    const focusMin = (sessions.data ?? []).filter((x) => dayIn(tz, new Date(x.started_at)) >= start).reduce((a, x) => a + x.minutes, 0);
    const captured = (notes.data ?? []).filter((n) => dayIn(tz, new Date(n.created_at)) >= start).length;
    const processed = (notes.data ?? []).filter((n) => n.processed_at && dayIn(tz, new Date(n.processed_at)) >= start).length;
    const perDay = days.map((d) => ({
      key: d,
      day: d === today ? 'Today' : parseKey(d).toLocaleDateString(undefined, { weekday: 'short' }),
      Tasks: done.filter((t) => doneOn(t) === d).length,
      Habits: perHabit.reduce((a, h) => a + habitDays({ start: h.first, logDays: h.set, days: [d], today }).done, 0),
    }));
    return { done, donePrev, overdue, perHabit, consistency: possible ? Math.round((hits / possible) * 100) : null, hits, possible, avgMood, moodCount: weekMoods.length, focusMin, captured, processed, perDay };
  }, [tasks.data, logs.data, habits.data, moods.data, sessions.data, notes.data, start, prevStart, today, tz]); // eslint-disable-line react-hooks/exhaustive-deps

  const delta = s.done.length - s.donePrev.length;
  const range = `${parseKey(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parseKey(today).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  const statsForAi = {
    tasks_completed: s.done.length,
    tasks_completed_previous_week: s.donePrev.length,
    completed_titles: s.done.slice(0, 15).map((t) => t.title),
    still_overdue: s.overdue.slice(0, 10).map((t) => t.title),
    habit_consistency_percent: s.consistency,
    habits: s.perHabit.map((h) => `${h.habit.name}: ${h.done}/${h.possible}`),
    average_mood_1_to_5: s.avgMood !== null ? Number(s.avgMood.toFixed(1)) : null,
    mood_check_ins: s.moodCount,
    focus_minutes: s.focusMin,
    notes_captured: s.captured,
    notes_processed: s.processed,
  };
  const statsKey = JSON.stringify(statsForAi);
  const ready = !src.all.loading && !src.all.failed;
  const outOfActions = !!aiStatus?.enabled && aiStatus.remaining <= 0;
  const runSummary = (force: boolean) =>
    summary.mutate({ week_start: start, stats: statsForAi, force }, { onSuccess: (r) => setAi({ ...r.result, cached: r.cached, stats: statsKey }) });

  const roundedMood = s.avgMood !== null ? MOODS.find((m) => m.value === Math.round(s.avgMood!)) : undefined;
  const tiles: { label: string; src: ReturnType<typeof from>; value: string; sub: ReactNode; how: string }[] = [
    {
      label: 'Tasks completed',
      src: src.tasks,
      value: String(s.done.length),
      sub: (
        <>
          {delta !== 0 && <span aria-hidden>{delta > 0 ? '▲ ' : '▼ '}</span>}
          {deltaText(delta)}
        </>
      ),
      how: 'Tasks (not steps) you marked done in the last 7 days.',
    },
    {
      label: 'Habit consistency',
      src: src.habits,
      value: s.consistency == null ? '—' : `${s.consistency}%`,
      sub: s.possible ? `${s.hits} of ${s.possible} habit-days` : (habits.data ?? []).length ? 'Nothing to count yet' : 'No habits yet',
      how: 'Days you did each habit ÷ days it could have been done in the last 7 days, from the day it started. Today counts once it’s done.',
    },
    {
      label: 'Average mood',
      src: src.moods,
      value: s.avgMood !== null ? `${s.avgMood.toFixed(1)}/5` : '—',
      sub: s.moodCount ? (
        <>
          {roundedMood && <span aria-hidden>{roundedMood.emoji} </span>}
          {roundedMood ? `About “${roundedMood.label}”, ` : ''}from {s.moodCount} check-in{s.moodCount === 1 ? '' : 's'}
        </>
      ) : (
        'No check-ins in the last 7 days'
      ),
      how: 'Mean of your daily mood check-ins (1 = Rough, 5 = Amazing). Skipped days aren’t counted.',
    },
    {
      label: 'Focus time',
      src: src.focus,
      value: formatDuration(s.focusMin),
      sub: 'From the Focus timer',
      how: 'Minutes the Focus timer actually ran in the last 7 days, as logged.',
    },
  ];

  const initialLoad = src.all.loading && !tasks.data && !habits.data;
  return (
    <div>
      <PageHeader title="Weekly Review" description={`${range}. A plain look at your last 7 days — what got done, what slipped — so you can adjust next week.`} />
      {initialLoad ? (
        <LoadingList />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label} className="!p-4">
                <p className="muted text-xs font-medium">{t.label}</p>
                {t.src.loading ? (
                  <div className="mt-2 h-9 w-16 animate-pulse rounded-control bg-raised" role="status" aria-label={`Loading ${t.label.toLowerCase()}`} />
                ) : t.src.failed ? (
                  <div className="mt-2">
                    <Failed what="This number" onRetry={t.src.retry} />
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-3xl font-extrabold tabular-nums">{t.value}</p>
                    <p className="muted mt-0.5 text-xs">{t.sub}</p>
                  </>
                )}
                <p className="muted mt-2 text-xs leading-snug">{t.how}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardTitle
              action={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {outOfActions && ready && !ai && (
                    <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" disabled={summary.isPending} onClick={() => runSummary(false)}>
                      Show saved summary
                    </button>
                  )}
                  <AiButton
                    size="sm"
                    loading={summary.isPending}
                    disabled={!ready}
                    onClick={() => runSummary(!!ai)}
                    hint={ai ? 'Writes a fresh summary — always uses an action' : 'A short written review and 3 suggestions for next week'}
                  >
                    {ai ? 'Regenerate' : 'AI summary'}
                  </AiButton>
                </div>
              }
            >
              ✨ Summary & suggestions
            </CardTitle>
            <div aria-live="polite">
              {ai ? (
                <div className="space-y-3 rounded-card border border-atlas/30 bg-atlas/[0.04] p-4 text-sm">
                  <p className="leading-relaxed">{ai.summary}</p>
                  <ol className="list-decimal space-y-1 pl-5">
                    {ai.suggestions.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ol>
                  <p className="muted text-xs">
                    {ai.cached ? 'Saved summary — no action used.' : 'Used 1 ✨ action.'}
                    {ai.stats !== statsKey ? ' Your numbers have changed since this was written.' : ''} Regenerate always uses 1 action.
                  </p>
                </div>
              ) : (
                <p className="muted text-sm">
                  {!ready
                    ? src.all.failed
                      ? 'Some of your numbers didn’t load, so the summary is off until they do — it would be written from wrong numbers.'
                      : 'Waiting for all your numbers to load…'
                    : `Get a short written review of these numbers and three specific suggestions for next week. Uses 1 ✨ action${aiStatus?.enabled ? ` (${aiStatus.remaining} left today)` : ''} — free if nothing changed since your last summary.`}
                </p>
              )}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Day by day</CardTitle>
              {src.tasks.loading || src.habits.loading ? (
                <div className="h-52 animate-pulse rounded-control bg-raised" role="status" aria-label="Loading chart" />
              ) : src.tasks.failed || src.habits.failed ? (
                <Failed what="The chart" onRetry={() => (src.tasks.retry(), src.habits.retry())} />
              ) : (
                <>
                  <div
                    className="h-52"
                    role="img"
                    aria-label={`Tasks completed and habits done per day, last 7 days: ${s.perDay.map((d) => `${d.day}${d.key === today ? ' so far' : ''}: ${d.Tasks} task${d.Tasks === 1 ? '' : 's'}, ${d.Habits} habit${d.Habits === 1 ? '' : 's'}`).join('; ')}`}
                  >
                    <Suspense fallback={null}>
                      <ReviewChart data={s.perDay} />
                    </Suspense>
                  </div>
                  <p className="muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ink" aria-hidden /> Tasks done
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-faint" aria-hidden /> Habits done
                    </span>
                    <span>Today counts so far.</span>
                  </p>
                </>
              )}
              <p className="muted mt-1 text-xs">
                {src.notes.loading ? (
                  'Brain Dump: loading…'
                ) : src.notes.failed ? (
                  <>
                    Brain Dump counts didn’t load.{' '}
                    <button className="underline underline-offset-2 hover:text-ink" onClick={src.notes.retry}>
                      Try again
                    </button>
                  </>
                ) : (
                  `Brain Dump, last 7 days: ${s.captured} captured, ${s.processed} processed (turned into something or archived).`
                )}
              </p>
            </Card>
            <Card>
              <CardTitle>Habits, last 7 days</CardTitle>
              {src.habits.loading ? (
                <LoadingList rows={3} label="Loading habits" />
              ) : src.habits.failed ? (
                <Failed what="Your habits" onRetry={src.habits.retry} />
              ) : s.perHabit.length ? (
                <>
                  <ul className="space-y-2 text-sm">
                    {s.perHabit.map(({ habit, done, possible }) => (
                      <li key={habit.id} className="flex items-center gap-3">
                        <span className="w-40 truncate">
                          <span aria-hidden>{habit.emoji}</span> {habit.name}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                          <div className="h-full bg-accent" style={{ width: possible ? `${(done / possible) * 100}%` : 0 }} />
                        </div>
                        <span className="muted w-20 shrink-0 text-right text-xs tabular-nums">
                          {possible ? `${done} of ${possible} days` : 'Starts today'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="muted mt-3 text-xs">Counted from the day each habit started; today counts once it’s done.</p>
                </>
              ) : (
                <p className="muted text-sm">No habits yet.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Done in the last 7 days{src.tasks.loading || src.tasks.failed ? '' : ` (${s.done.length})`}</CardTitle>
              {src.tasks.loading ? (
                <LoadingList rows={3} label="Loading tasks" />
              ) : src.tasks.failed ? (
                <Failed what="Your tasks" onRetry={src.tasks.retry} />
              ) : s.done.length ? (
                <ul className="space-y-1 text-sm">
                  {s.done.slice(0, LIST_MAX).map((t) => (
                    <li key={t.id} className="flex gap-2">
                      <span className="text-success" aria-hidden>
                        ✓
                      </span>
                      {t.title}
                    </li>
                  ))}
                  {s.done.length > LIST_MAX && <li className="muted text-xs">…and {s.done.length - LIST_MAX} more</li>}
                </ul>
              ) : (
                <p className="muted text-sm">Nothing completed in the last 7 days.</p>
              )}
            </Card>
            <Card>
              <CardTitle>Still overdue{src.tasks.loading || src.tasks.failed ? '' : ` (${s.overdue.length})`}</CardTitle>
              <p className="muted -mt-2 mb-3 text-xs">Open tasks whose due date has passed — from any week, not just the last 7 days.</p>
              {src.tasks.loading ? (
                <LoadingList rows={3} label="Loading tasks" />
              ) : src.tasks.failed ? (
                <Failed what="Your tasks" onRetry={src.tasks.retry} />
              ) : s.overdue.length ? (
                <ul className="space-y-1 text-sm">
                  {s.overdue.slice(0, LIST_MAX).map((t) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <span className="truncate">{t.title}</span>
                      <span className="muted shrink-0 text-xs">due {formatDay(t.due_date!, today)}</span>
                    </li>
                  ))}
                  {s.overdue.length > LIST_MAX && <li className="muted text-xs">…and {s.overdue.length - LIST_MAX} more</li>}
                </ul>
              ) : (
                <p className="muted text-sm">Nothing overdue. 👏</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
