import { Check, ChevronDown, FileText, Plus, Timer, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoals } from '../../hooks/data/goals';
import { useNotes } from '../../hooks/data/notes';
import { useAddTasks, useDeleteTask, useTasks, useUpdateTask } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { useTimer } from '../../hooks/useTimer';
import { useToast } from '../../hooks/useToast';
import { minutesFromTime } from '../../lib/quickAdd';
import { formatMinutesShort } from '../../lib/planner';
import { clip, firstLine } from '../../lib/text';
import type { Priority, Task } from '../../lib/types';
import { cn } from '../../lib/utils';
import { AiButton } from '../ui/Ai';
import { Modal } from '../ui/Modal';

interface Props {
  task: Task | null;
  onClose: () => void;
}

const FIELDS = ['title', 'details', 'due_date', 'due_time', 'priority', 'tags', 'estimate_min', 'goal_id', 'sched_date', 'sched_start', 'sched_duration', 'top_date'] as const;
const parseTags = (value: string) => [...new Set(value.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))].slice(0, 20);

/** What changed between the saved task and the draft. An empty title is never saved: the last one is kept. */
function changes(task: Task, draft: Task) {
  const patch: Partial<Task> = {};
  for (const k of FIELDS) {
    if (JSON.stringify(draft[k]) !== JSON.stringify(task[k])) (patch as Record<string, unknown>)[k] = draft[k];
  }
  if ('title' in patch) {
    if (draft.title.trim()) patch.title = draft.title.trim();
    else delete patch.title;
  }
  if (patch.title === task.title) delete patch.title;
  return patch;
}

/**
 * Edit everything about a task: when, priority, time block, goal, steps.
 * Changes save automatically (shortly after typing stops, and on every way of closing), so
 * Escape, × and a tap outside never lose an edit — there's nothing to cancel.
 */
export function TaskEditor({ task, onClose }: Props) {
  const { today } = useToday();
  const { data: tasks = [] } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: notes = [] } = useNotes();
  const update = useUpdateTask();
  const addTasks = useAddTasks();
  const del = useDeleteTask();
  const breakDown = useAi<{ subtasks: { title: string; estimate_min: number | null }[] }>('break_down');
  const timer = useTimer();
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState<Task | null>(task);
  const [tagsText, setTagsText] = useState(task?.tags.join(', ') ?? '');
  const [newStep, setNewStep] = useState('');
  const [proposed, setProposed] = useState<{ title: string; estimate_min: number | null; keep: boolean }[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Estimate, tags, goal, Planner block and notes sit behind "More details" unless one is already set.
  const filledExtras = (t: Task | null) => (t ? [t.estimate_min, t.tags.length, t.goal_id, t.sched_date, t.details.trim()].filter(Boolean).length : 0);
  const [more, setMore] = useState(() => filledExtras(task) > 0);

  // Start a fresh draft only when a different task opens — not when this one's saved copy
  // updates (each autosave does that), or the field being typed in would be reset.
  useEffect(() => {
    setDraft(task);
    setTagsText(task?.tags.join(', ') ?? '');
    setProposed(null);
    setConfirmDelete(false);
    setMore(filledExtras(task) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  // Autosave: the latest saved task and draft live in refs so a pending save and close always see them.
  const latest = useRef({ task, draft });
  latest.current = { task, draft };
  const flush = () => {
    const { task: t, draft: d } = latest.current;
    if (!t || !d || d.id !== t.id) return;
    const patch = changes(t, d);
    if (Object.keys(patch).length) update.mutate({ id: t.id, patch });
  };
  useEffect(() => {
    if (!draft || draft.id !== task?.id) return;
    const handle = window.setTimeout(flush, 600);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  if (!task || !draft) return null;
  const steps = tasks.filter((t) => t.parent_id === task.id).sort((a, b) => a.sort - b.sort);
  const note = task.source_note_id ? notes.find((n) => n.id === task.source_note_id) : null;
  const extras = filledExtras(draft);
  const set = (patch: Partial<Task>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  /** Every way out (Close, Escape, ×, backdrop, Focus) saves first. */
  const close = () => {
    flush();
    if (!draft.title.trim()) toast(`A task needs a title, so it’s still “${task.title}”.`);
    onClose();
  };

  const scheduled = draft.sched_date != null;
  const toggleSchedule = (on: boolean) =>
    on ? set({ sched_date: draft.due_date && draft.due_date >= today ? draft.due_date : today, sched_start: 9 * 60, sched_duration: Math.max(15, Math.round((draft.estimate_min ?? 60) / 15) * 15) }) : set({ sched_date: null, sched_start: null, sched_duration: null });

  return (
    <Modal open onClose={close} title="Task" description="Changes save automatically." className="max-w-xl">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="task-title">
            Title
          </label>
          <input
            id="task-title"
            className="input text-base font-medium"
            value={draft.title}
            maxLength={300}
            onChange={(e) => set({ title: e.target.value })}
            aria-invalid={!draft.title.trim()}
            aria-describedby={draft.title.trim() ? undefined : 'task-title-error'}
          />
          {!draft.title.trim() && (
            <p id="task-title-error" className="mt-1 text-xs text-danger">
              A task needs a title. Until it has one, “{task.title}” is kept.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="col-span-1">
            <span className="label">Due date</span>
            <input type="date" className="input" value={draft.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || null })} />
          </label>
          <label>
            <span className="label">Time</span>
            <input type="time" className="input" value={draft.due_time?.slice(0, 5) ?? ''} onChange={(e) => set({ due_time: e.target.value || null })} disabled={!draft.due_date} />
          </label>
          <label>
            <span className="label">Priority</span>
            <select className="input" value={draft.priority ?? ''} onChange={(e) => set({ priority: (e.target.value || null) as Priority | null })}>
              <option value="">None</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-ink" checked={draft.top_date === today} onChange={(e) => set({ top_date: e.target.checked ? today : null })} />
          ⭐ One of today’s top 3
        </label>

        {/* Steps */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="label !mb-0">Steps {steps.length > 0 && `(${steps.filter((s) => s.done).length}/${steps.length})`}</span>
            <AiButton
              size="sm"
              loading={breakDown.isPending}
              onClick={() => breakDown.mutate({ task_id: task.id }, { onSuccess: (r) => setProposed(r.result.subtasks.map((s) => ({ ...s, keep: true }))) })}
              hint="Split this task into small steps"
            >
              Break it down
            </AiButton>
          </div>
          <ul className="space-y-1">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => update.mutate({ id: s.id, patch: { done: !s.done, completed_at: s.done ? null : new Date().toISOString() } })}
                  className={cn('hit flex h-4 w-4 shrink-0 items-center justify-center rounded border', s.done ? 'border-ink/40 bg-accent text-accent-ink' : 'border-control')}
                  aria-label={s.done ? `Mark step “${s.title}” not done` : `Complete step “${s.title}”`}
                >
                  {s.done && <Check size={10} strokeWidth={3} />}
                </button>
                <span className={cn('flex-1', s.done && 'faint line-through')}>{s.title}</span>
                <button className="icon-btn h-7 w-7" onClick={() => del.mutate(s.id)} aria-label={`Delete step “${s.title}”`}>
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
          {proposed && (
            <div className="mt-2 rounded-xl border border-ink/40 bg-ink/[0.03] p-3">
              <p className="mb-2 text-xs font-semibold">✨ Suggested steps — untick any you don’t want</p>
              {proposed.map((p, i) => (
                <label key={i} className="flex items-center gap-2 py-0.5 text-sm">
                  <input type="checkbox" className="accent-ink" checked={p.keep} onChange={(e) => setProposed(proposed.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} />
                  <input className="min-w-0 flex-1 bg-transparent outline-none" value={p.title} onChange={(e) => setProposed(proposed.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  {p.estimate_min && <span className="faint text-xs">{p.estimate_min}m</span>}
                </label>
              ))}
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-primary !px-3 !py-1.5"
                  onClick={() => {
                    const keep = proposed.filter((p) => p.keep && p.title.trim());
                    addTasks.mutate(keep.map((p, i) => ({ title: p.title.trim(), estimate_min: p.estimate_min, parent_id: task.id, goal_id: task.goal_id, sort: Date.now() / 1000 + i })));
                    setProposed(null);
                  }}
                >
                  Add {proposed.filter((p) => p.keep).length} steps
                </button>
                <button className="btn-ghost !px-3 !py-1.5" onClick={() => setProposed(null)}>
                  Discard
                </button>
              </div>
            </div>
          )}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newStep.trim()) return;
              addTasks.mutate([{ title: newStep.trim(), parent_id: task.id, goal_id: task.goal_id }]);
              setNewStep('');
            }}
          >
            <input className="input !py-1.5" placeholder="Add a step" value={newStep} onChange={(e) => setNewStep(e.target.value)} aria-label="New step" />
            <button className="btn-ghost !px-3" aria-label="Add step" disabled={!newStep.trim()}>
              <Plus size={15} />
            </button>
          </form>
        </div>

        <div className="border-t border-line pt-3">
          <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink" onClick={() => setMore((v) => !v)} aria-expanded={more}>
            <ChevronDown size={15} className={cn('transition-transform duration-fast', more && 'rotate-180')} aria-hidden /> More details
            {!more && extras > 0 && <span className="faint font-normal">· {extras} set</span>}
          </button>
          {more && (
            <div className="mt-3 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                <span className="label">Estimate (min)</span>
                <input type="number" min={5} max={1440} step={5} className="input" value={draft.estimate_min ?? ''} onChange={(e) => set({ estimate_min: e.target.value ? Math.max(1, Math.min(1440, Number(e.target.value))) : null })} />
              </label>
              <label>
                <span className="label">Tags</span>
                <input
                  className="input"
                  placeholder="work, errands"
                  value={tagsText}
                  onChange={(e) => {
                    setTagsText(e.target.value);
                    set({ tags: parseTags(e.target.value) });
                  }}
                />
              </label>
              <label>
                <span className="label">Goal</span>
                <select className="input" value={draft.goal_id ?? ''} onChange={(e) => set({ goal_id: e.target.value || null })}>
                  <option value="">Not linked</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.emoji} {g.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-control border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="accent-ink" checked={scheduled} onChange={(e) => toggleSchedule(e.target.checked)} />
                Block time for it in the Planner
              </label>
              {scheduled && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label>
                    <span className="label">Day</span>
                    <input type="date" className="input" value={draft.sched_date ?? ''} onChange={(e) => e.target.value && set({ sched_date: e.target.value })} />
                  </label>
                  <label>
                    <span className="label">Start</span>
                    <input
                      type="time"
                      step={900}
                      className="input"
                      value={formatMinutesShort(draft.sched_start ?? 540)}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const start = Math.min(Math.round(minutesFromTime(e.target.value) / 15) * 15, 1425);
                        set({ sched_start: start, sched_duration: Math.min(draft.sched_duration ?? 60, 1440 - start) });
                      }}
                    />
                  </label>
                  <label>
                    <span className="label">Length</span>
                    <select className="input" value={draft.sched_duration ?? 60} onChange={(e) => set({ sched_duration: Math.min(Number(e.target.value), 1440 - (draft.sched_start ?? 0)) })}>
                      {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                        <option key={m} value={m}>
                          {m < 60 ? `${m} min` : `${m / 60} h`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="label" htmlFor="task-details">
                Notes
              </label>
              <textarea id="task-details" rows={3} maxLength={5000} className="input resize-y" value={draft.details} onChange={(e) => set({ details: e.target.value })} placeholder="Links, context, anything useful." />
            </div>
            </div>
          )}
        </div>

        {note && (
          <p className="muted flex items-start gap-1.5 text-xs">
            <FileText size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Created from your note: “{clip(firstLine(note.body, 200), 120)}”{' '}
              <button className="link" onClick={() => navigate(`/app/brain-dump?view=${note.state === 'archived' ? 'archive' : 'all'}&note=${note.id}`)}>
                Open note
              </button>
            </span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {confirmDelete ? (
            <>
              <span className="text-sm">Delete this task{steps.length ? ` and its ${steps.length} steps` : ''}?</span>
              <button
                className="btn-danger !px-3 !py-1.5"
                onClick={() => {
                  del.mutate(task.id);
                  onClose();
                }}
              >
                Delete
              </button>
              <button className="btn-ghost !px-3 !py-1.5" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost !px-3" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Delete
              </button>
              <button
                className="btn-ghost !px-3"
                onClick={() => {
                  timer.setTaskId(task.id);
                  close();
                  navigate('/app/focus');
                }}
              >
                <Timer size={15} /> Focus on this
              </button>
              <button className="btn-primary ml-auto" onClick={close}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
