import { Maximize2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { TimerDisplay } from '../../components/focus/TimerDisplay';
import { Card, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { useFocusSessions } from '../../hooks/data/focus';
import { useTasks } from '../../hooks/data/tasks';
import { useToday } from '../../hooks/useProfile';
import { REST_RANGE, WORK_RANGE, useTimer } from '../../hooks/useTimer';
import { parseKey } from '../../lib/dates';
import { formatDuration } from '../../lib/format';
import { focusStats } from '../../lib/stats';
import { cn } from '../../lib/utils';

const PRESETS = [
  { label: 'Classic', work: 25, rest: 5 },
  { label: 'Long', work: 50, rest: 10 },
  { label: 'Short', work: 15, rest: 3 },
];

/** A minutes field you can clear and retype; it's checked and saved on blur or Enter. */
function MinutesInput({ label, value, range, disabled, onCommit }: { label: string; value: number; range: { min: number; max: number }; disabled?: boolean; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const noteId = useId();
  const commit = () => {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    setDraft(null);
    if (!draft.trim() || !Number.isFinite(n)) {
      setNote(`Kept ${value} min — enter a number from ${range.min} to ${range.max}.`);
      return;
    }
    const clamped = Math.min(Math.max(n, range.min), range.max);
    setNote(clamped !== n ? `${clamped < n ? 'Max' : 'Min'} is ${clamped} min.` : null);
    onCommit(clamped);
  };
  return (
    <label>
      <span className="label">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        className="input"
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value.replace(/[^0-9]/g, ''));
          setNote(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        aria-describedby={note ? noteId : undefined}
      />
      {note && (
        <span id={noteId} className="muted mt-1 block text-xs" role="status">
          {note}
        </span>
      )}
    </label>
  );
}

export default function Focus() {
  const { today, tz } = useToday();
  const timer = useTimer();
  const { data: tasks = [] } = useTasks();
  const sessions = useFocusSessions();
  const open = tasks.filter((t) => !t.done).sort((a, b) => (b.top_date === today ? 1 : 0) - (a.top_date === today ? 1 : 0) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  const current = tasks.find((t) => t.id === timer.taskId);

  const stats = useMemo(() => focusStats(sessions.data ?? [], today, tz), [sessions.data, today, tz]);
  const max = Math.max(30, ...stats.week.map((w) => w.minutes));
  const dayName = (d: string) => (d === today ? 'Today' : parseKey(d).toLocaleDateString(undefined, { weekday: 'short' }));
  const taskTitle = (id: string) => tasks.find((t) => t.id === id)?.title ?? 'Deleted task';

  return (
    <div>
      <PageHeader
        title="Focus"
        description="A Pomodoro timer: work in focused blocks with short breaks. Pick what you’re working on and the minutes you actually focus are logged against that task."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col items-center py-8">
          <div className="mb-6 w-full max-w-sm">
            <label className="label" htmlFor="focus-task">
              Working on
            </label>
            <select id="focus-task" className="input" value={timer.taskId ?? ''} onChange={(e) => timer.setTaskId(e.target.value || null)}>
              <option value="">Nothing specific</option>
              {/* Keep the chosen task listed even after it's ticked off elsewhere. */}
              {current?.done && <option value={current.id}>✓ {current.title} (done)</option>}
              {open.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.top_date === today ? '⭐ ' : ''}
                  {t.title}
                </option>
              ))}
            </select>
            {timer.inProgress && timer.mode === 'work' && <p className="muted mt-1.5 text-xs">Switching task mid-block logs the minutes so far to the previous one.</p>}
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
                  disabled={timer.inProgress}
                  onClick={() => timer.setDurations(p.work, p.rest)}
                  className={timer.workMin === p.work && timer.restMin === p.rest ? 'chip-on' : 'chip-off'}
                  aria-pressed={timer.workMin === p.work && timer.restMin === p.rest}
                  aria-label={`${p.label}: ${p.work} min focus, ${p.rest} min break`}
                >
                  {p.label} · {p.work}/{p.rest}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MinutesInput label="Focus (min)" value={timer.workMin} range={WORK_RANGE} disabled={timer.inProgress} onCommit={(n) => timer.setDurations(n, timer.restMin)} />
              <MinutesInput label="Break (min)" value={timer.restMin} range={REST_RANGE} disabled={timer.inProgress} onCommit={(n) => timer.setDurations(timer.workMin, n)} />
            </div>
            <p className="muted mt-2 text-xs">{timer.inProgress ? 'Locked while a block is underway — finish, skip or reset it to change lengths.' : 'Presets are focus/break minutes.'}</p>
          </Card>

          <Card>
            <CardTitle>Focus time</CardTitle>
            {sessions.isLoading ? (
              <div role="status" aria-label="Loading focus time">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="mt-4 h-24" />
              </div>
            ) : sessions.error ? (
              <ErrorState message="Your focus time didn’t load, so it isn’t shown." onRetry={() => sessions.refetch()} className="!py-4" />
            ) : (
              <>
                <p className="text-sm">
                  <strong className="text-2xl font-bold tabular-nums">{formatDuration(stats.today)}</strong> <span className="muted">today</span>
                  <span className="muted"> · {formatDuration(stats.weekTotal)} in the last 7 days</span>
                </p>
                <div
                  className="mt-4 flex h-28 items-end gap-1.5"
                  role="img"
                  aria-label={`Focus minutes per day, last 7 days: ${stats.week.map((w) => `${dayName(w.day)} ${w.minutes} min`).join(', ')}`}
                >
                  {stats.week.map((w) => {
                    const isToday = w.day === today;
                    return (
                      <div key={w.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1" aria-hidden>
                        {w.minutes > 0 && <span className="text-xs tabular-nums text-muted">{w.minutes}</span>}
                        {w.minutes > 0 ? (
                          <div className={cn('w-full rounded-md', isToday ? 'bg-ink' : 'bg-ink/45')} style={{ height: `${Math.max(4, (w.minutes / max) * 64)}px` }} />
                        ) : (
                          <div className="h-px w-full bg-line-strong" />
                        )}
                        <span className={cn('text-xs', isToday ? 'font-semibold text-ink' : 'text-muted')}>{dayName(w.day)}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="muted mt-1 text-xs">Numbers are minutes per day.</p>
                {stats.weekTotal === 0 ? (
                  <p className="muted mt-4 text-sm">Nothing logged in the last 7 days. Start a block and its minutes appear here.</p>
                ) : (
                  <>
                    <h3 className="mt-4 text-xs font-semibold text-ink">By task · last 7 days{stats.otherTaskCount > 0 ? ' (top 5)' : ''}</h3>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {stats.topTasks.map(([id, m]) => (
                        <li key={id} className="flex justify-between gap-2">
                          <span className="truncate">{taskTitle(id)}</span>
                          <span className="muted shrink-0 tabular-nums">{formatDuration(m)}</span>
                        </li>
                      ))}
                      {stats.otherTasks > 0 && (
                        <li className="flex justify-between gap-2">
                          <span className="muted truncate">
                            {stats.otherTaskCount} other task{stats.otherTaskCount === 1 ? '' : 's'}
                          </span>
                          <span className="muted shrink-0 tabular-nums">{formatDuration(stats.otherTasks)}</span>
                        </li>
                      )}
                      {stats.noTask > 0 && (
                        <li className="flex justify-between gap-2">
                          <span className="muted truncate">No task</span>
                          <span className="muted shrink-0 tabular-nums">{formatDuration(stats.noTask)}</span>
                        </li>
                      )}
                    </ul>
                  </>
                )}
                <p className="muted mt-3 text-xs">Minutes the timer actually ran in focus blocks — logged when a block finishes, or when you stop one early and choose Log.</p>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
