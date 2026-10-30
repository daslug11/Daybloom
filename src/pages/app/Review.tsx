import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AiButton } from '../../components/ui/Ai';
import { Card, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/States';
import { useFocusSessions } from '../../hooks/data/focus';
import { useHabitLogs, useHabits } from '../../hooks/data/habits';
import { useMoods } from '../../hooks/data/moods';
import { useNotes } from '../../hooks/data/notes';
import { useTasks } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { addDays, dayIn, parseKey } from '../../lib/dates';
import { MOODS } from '../../lib/moods';
import { formatDuration } from '../../lib/quickAdd';

export default function Review() {
  const { today, tz } = useToday();
  const tasks = useTasks();
  const { data: habits = [] } = useHabits();
  const logs = useHabitLogs(today);
  const { data: moods = [] } = useMoods(today);
  const { data: sessions = [] } = useFocusSessions();
  const { data: notes = [] } = useNotes();
  const summary = useAi<{ summary: string; suggestions: string[] }>('weekly_summary');
  const [ai, setAi] = useState<{ summary: string; suggestions: string[]; cached: boolean } | null>(null);
  const start = addDays(today, -6);
  const prevStart = addDays(today, -13);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const s = useMemo(() => {
    const all = tasks.data ?? [];
    const doneOn = (t: (typeof all)[number]) => (t.completed_at ? dayIn(tz, new Date(t.completed_at)) : null);
    const done = all.filter((t) => t.done && !t.parent_id && (doneOn(t) ?? '') >= start);
    const donePrev = all.filter((t) => t.done && !t.parent_id && (doneOn(t) ?? '') >= prevStart && (doneOn(t) ?? '') < start);
    const overdue = all.filter((t) => !t.done && !t.parent_id && t.due_date && t.due_date < today);

    // Habit consistency: only count days on/after the habit was created.
    let possible = 0;
    let hits = 0;
    const logSet = new Set((logs.data ?? []).map((l) => `${l.habit_id}:${l.day}`));
    const perHabit = habits.map((h) => {
      const created = dayIn(tz, new Date(h.created_at));
      const eligible = days.filter((d) => d >= created);
      const n = eligible.filter((d) => logSet.has(`${h.id}:${d}`)).length;
      possible += eligible.length;
      hits += n;
      return { habit: h, n, of: eligible.length };
    });
    const weekMoods = moods.filter((m) => m.day >= start && m.day <= today);
    const avgMood = weekMoods.length ? weekMoods.reduce((a, m) => a + m.score, 0) / weekMoods.length : null;
    const focusMin = sessions.filter((x) => dayIn(tz, new Date(x.started_at)) >= start).reduce((a, x) => a + x.minutes, 0);
    const captured = notes.filter((n) => dayIn(tz, new Date(n.created_at)) >= start).length;
    const processed = notes.filter((n) => n.processed_at && dayIn(tz, new Date(n.processed_at)) >= start).length;
    const perDay = days.map((d) => ({
      day: parseKey(d).toLocaleDateString(undefined, { weekday: 'short' }),
      Tasks: done.filter((t) => doneOn(t) === d).length,
      Habits: habits.filter((h) => logSet.has(`${h.id}:${d}`)).length,
    }));
    return { done, donePrev, overdue, perHabit, consistency: possible ? Math.round((hits / possible) * 100) : null, hits, possible, avgMood, moodCount: weekMoods.length, focusMin, captured, processed, perDay };
  }, [tasks.data, logs.data, habits, moods, sessions, notes, start, prevStart, today, tz]); // eslint-disable-line react-hooks/exhaustive-deps

  const delta = s.done.length - s.donePrev.length;
  const range = `${parseKey(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parseKey(today).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  const statsForAi = {
    tasks_completed: s.done.length,
    tasks_completed_previous_week: s.donePrev.length,
    completed_titles: s.done.slice(0, 15).map((t) => t.title),
    still_overdue: s.overdue.slice(0, 10).map((t) => t.title),
    habit_consistency_percent: s.consistency,
    habits: s.perHabit.map((h) => `${h.habit.name}: ${h.n}/${h.of}`),
    average_mood_1_to_5: s.avgMood ? Number(s.avgMood.toFixed(1)) : null,
    mood_check_ins: s.moodCount,
    focus_minutes: s.focusMin,
    notes_captured: s.captured,
    notes_processed: s.processed,
  };

  const tiles = [
    {
      label: 'Tasks completed',
      value: String(s.done.length),
      sub: delta === 0 ? 'Same as the 7 days before' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} vs the 7 days before`,
      how: 'Tasks (not steps) you marked done in the last 7 days.',
    },
    {
      label: 'Habit consistency',
      value: s.consistency == null ? '—' : `${s.consistency}%`,
      sub: s.possible ? `${s.hits} of ${s.possible} habit-days` : 'No habits yet',
      how: 'Days you did each habit ÷ days each habit existed this week.',
    },
    {
      label: 'Average mood',
      value: s.avgMood ? `${s.avgMood.toFixed(1)}/5` : '—',
      sub: s.moodCount ? `${MOODS[Math.round(s.avgMood!) - 1].emoji} from ${s.moodCount} check-in${s.moodCount === 1 ? '' : 's'}` : 'No check-ins this week',
      how: 'Mean of your daily mood check-ins (1 = rough, 5 = amazing).',
    },
    {
      label: 'Focus time',
      value: formatDuration(s.focusMin),
      sub: 'From finished Pomodoro blocks',
      how: 'Minutes logged by focus sessions that ran to the end.',
    },
  ];

  const loading = tasks.isLoading || logs.isLoading;
  return (
    <div>
      <PageHeader title="Weekly Review" description={`${range}. A plain look at your last 7 days — what got done, what slipped — so you can adjust next week.`} />
      <QueryState isLoading={loading} error={tasks.error} onRetry={() => tasks.refetch()} />
      {!loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label} className="!p-4">
                <p className="muted text-xs font-medium">{t.label}</p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums">{t.value}</p>
                <p className="muted mt-0.5 text-xs">{t.sub}</p>
                <p className="faint mt-2 text-xs leading-snug">{t.how}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardTitle
              action={
                <AiButton
                  size="sm"
                  loading={summary.isPending}
                  onClick={() => summary.mutate({ week_start: start, stats: statsForAi, force: !!ai }, { onSuccess: (r) => setAi({ ...r.result, cached: r.cached }) })}
                  hint="A short written review and 3 suggestions for next week"
                >
                  {ai ? 'Regenerate' : 'AI summary'}
                </AiButton>
              }
            >
              ✨ Summary & suggestions
            </CardTitle>
            {ai ? (
              <div className="space-y-3 text-sm">
                <p className="leading-relaxed">{ai.summary}</p>
                <ol className="list-decimal space-y-1 pl-5">
                  {ai.suggestions.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="muted text-sm">Get a short written review of these numbers and three specific suggestions for next week. Uses one AI action (free if nothing changed since last time).</p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Day by day</CardTitle>
              <div className="h-52" role="img" aria-label="Tasks completed and habits done per day this week">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.perDay} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgb(var(--ink) / 0.05)' }} contentStyle={{ background: 'rgb(var(--overlay))', border: '1px solid rgb(var(--line-strong))', borderRadius: 10, fontSize: 12, color: 'rgb(var(--ink))' }} />
                    <Bar dataKey="Tasks" fill="rgb(var(--ink))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="Habits" fill="rgb(var(--faint))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="faint mt-2 text-xs">
                Dark bars: tasks completed · Light bars: habits done · Brain Dump: {s.captured} captured, {s.processed} processed
              </p>
            </Card>
            <Card>
              <CardTitle>Habits this week</CardTitle>
              {s.perHabit.length ? (
                <ul className="space-y-2 text-sm">
                  {s.perHabit.map(({ habit, n, of }) => (
                    <li key={habit.id} className="flex items-center gap-3">
                      <span className="w-40 truncate">
                        {habit.emoji} {habit.name}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                        <div className="h-full bg-accent" style={{ width: of ? `${(n / of) * 100}%` : 0 }} />
                      </div>
                      <span className="faint w-10 text-right tabular-nums">
                        {n}/{of}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted text-sm">No habits yet.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Done this week ({s.done.length})</CardTitle>
              {s.done.length ? (
                <ul className="space-y-1 text-sm">
                  {s.done.slice(0, 20).map((t) => (
                    <li key={t.id} className="flex gap-2">
                      <span className="text-success" aria-hidden>
                        ✓
                      </span>
                      {t.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted text-sm">Nothing completed in the last 7 days.</p>
              )}
            </Card>
            <Card>
              <CardTitle>Still overdue ({s.overdue.length})</CardTitle>
              {s.overdue.length ? (
                <ul className="space-y-1 text-sm">
                  {s.overdue.slice(0, 20).map((t) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <span className="truncate">{t.title}</span>
                      <span className="faint shrink-0 text-xs">due {t.due_date}</span>
                    </li>
                  ))}
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
