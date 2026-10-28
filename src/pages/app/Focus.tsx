import { Maximize2 } from 'lucide-react';
import { useMemo } from 'react';
import { TimerDisplay } from '../../components/focus/TimerDisplay';
import { Card, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { useFocusSessions } from '../../hooks/data/focus';
import { useTasks } from '../../hooks/data/tasks';
import { useToday } from '../../hooks/useProfile';
import { useTimer } from '../../hooks/useTimer';
import { addDays, dayIn, parseKey } from '../../lib/dates';
import { formatDuration } from '../../lib/quickAdd';

const PRESETS = [
  { label: 'Classic', work: 25, rest: 5 },
  { label: 'Long', work: 50, rest: 10 },
  { label: 'Short', work: 15, rest: 3 },
];

export default function Focus() {
  const { today, tz } = useToday();
  const timer = useTimer();
  const { data: tasks = [] } = useTasks();
  const sessions = useFocusSessions();
  const open = tasks.filter((t) => !t.done).sort((a, b) => (b.top_date === today ? 1 : 0) - (a.top_date === today ? 1 : 0) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  const current = tasks.find((t) => t.id === timer.taskId);

  const stats = useMemo(() => {
    const byDay = new Map<string, number>();
    const byTask = new Map<string, number>();
    const weekStart = addDays(today, -6);
    for (const s of sessions.data ?? []) {
      const d = dayIn(tz, new Date(s.started_at));
      byDay.set(d, (byDay.get(d) ?? 0) + s.minutes);
      if (d >= weekStart && s.task_id) byTask.set(s.task_id, (byTask.get(s.task_id) ?? 0) + s.minutes);
    }
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      return { day: d, minutes: byDay.get(d) ?? 0 };
    });
    const topTasks = [...byTask.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { today: byDay.get(today) ?? 0, week, weekTotal: week.reduce((s, w) => s + w.minutes, 0), topTasks };
  }, [sessions.data, today, tz]);
  const max = Math.max(30, ...stats.week.map((w) => w.minutes));

  return (
    <div>
      <PageHeader
        title="Focus"
        description="A Pomodoro timer: work in focused blocks with short breaks. Pick what you’re working on and the minutes are logged against that task when a block finishes."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col items-center py-8">
          <div className="mb-6 w-full max-w-sm">
            <label className="label" htmlFor="focus-task">
              Working on
            </label>
            <select id="focus-task" className="input" value={timer.taskId ?? ''} onChange={(e) => timer.setTaskId(e.target.value || null)}>
              <option value="">Nothing specific</option>
              {open.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.top_date === today ? '⭐ ' : ''}
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <TimerDisplay taskTitle={current?.title} />
          <button className="btn-ghost mt-6" onClick={() => timer.setFullscreen(true)}>
            <Maximize2 size={15} /> Full screen
          </button>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Length</CardTitle>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  disabled={timer.running}
                  onClick={() => timer.setDurations(p.work, p.rest)}
                  className={timer.workMin === p.work && timer.restMin === p.rest ? 'chip-on' : 'chip-off'}
                  aria-pressed={timer.workMin === p.work && timer.restMin === p.rest}
                >
                  {p.label} · {p.work}/{p.rest}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">Focus (min)</span>
                <input type="number" min={1} max={180} disabled={timer.running} className="input" value={timer.workMin} onChange={(e) => timer.setDurations(Number(e.target.value) || 1, timer.restMin)} />
              </label>
              <label>
                <span className="label">Break (min)</span>
                <input type="number" min={1} max={60} disabled={timer.running} className="input" value={timer.restMin} onChange={(e) => timer.setDurations(timer.workMin, Number(e.target.value) || 1)} />
              </label>
            </div>
            {timer.running && <p className="faint mt-2 text-xs">Pause the timer to change lengths.</p>}
          </Card>

          <Card>
            <CardTitle>Focus time</CardTitle>
            <p className="text-sm">
              <strong className="text-2xl font-bold tabular-nums">{formatDuration(stats.today)}</strong> <span className="muted">today</span>
              <span className="muted"> · {formatDuration(stats.weekTotal)} in the last 7 days</span>
            </p>
            <div className="mt-4 flex h-24 items-end gap-1.5" role="img" aria-label={`Focus minutes per day: ${stats.week.map((w) => `${w.minutes}`).join(', ')}`}>
              {stats.week.map((w) => (
                <div key={w.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-md bg-violet-500" style={{ height: `${Math.max(3, (w.minutes / max) * 72)}px`, opacity: w.minutes ? 1 : 0.2 }} title={`${w.minutes} min`} />
                  <span className="faint text-[10px]">{parseKey(w.day).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                </div>
              ))}
            </div>
            {stats.topTasks.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {stats.topTasks.map(([id, m]) => (
                  <li key={id} className="flex justify-between gap-2">
                    <span className="truncate">{tasks.find((t) => t.id === id)?.title ?? 'Deleted task'}</span>
                    <span className="faint shrink-0 tabular-nums">{formatDuration(m)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="faint mt-3 text-xs">Only finished focus blocks are logged.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
