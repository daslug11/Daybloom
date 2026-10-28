import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useAddGoal, useAddMilestones } from '../../hooks/data/goals';
import { useAddNote, useNotes, useUpdateNote } from '../../hooks/data/notes';
import { useAddTasks } from '../../hooks/data/tasks';
import { useToast } from '../../hooks/useToast';
import { clip, firstLine } from '../../lib/text';
import type { Note, Priority } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';

// ---------------------------------------------------------------------------
// ✨ Organize inbox
// ---------------------------------------------------------------------------
export type SuggestionKind = 'task' | 'reminder' | 'idea' | 'journal' | 'reference';
export interface Suggestion {
  note_id: string;
  kind: SuggestionKind;
  title: string;
  due_date: string | null;
  reason: string;
}

const KIND_LABEL: Record<SuggestionKind, string> = { task: '✅ Task', reminder: '⏰ Reminder', idea: '💡 Idea', journal: '📓 Journal', reference: '📄 Reference' };

export function OrganizePanel({ suggestions, onClose }: { suggestions: Suggestion[]; onClose: () => void }) {
  const { data: notes = [] } = useNotes();
  const addTasks = useAddTasks();
  const updateNote = useUpdateNote();
  const toast = useToast();
  const [items, setItems] = useState(suggestions.map((s) => ({ ...s, status: 'open' as 'open' | 'done' | 'dismissed' })));
  const byId = new Map(notes.map((n) => [n.id, n]));

  const accept = (i: number) => {
    const s = items[i];
    const now = new Date().toISOString();
    if (s.kind === 'task' || s.kind === 'reminder') {
      addTasks.mutate([{ title: s.title.trim() || 'Untitled task', due_date: s.due_date, source_note_id: s.note_id }]);
      updateNote.mutate({ id: s.note_id, patch: { state: 'archived', processed_at: now } });
    } else {
      updateNote.mutate({ id: s.note_id, patch: { state: s.kind === 'idea' ? 'idea' : 'note', processed_at: now } });
    }
    setItems((list) => list.map((x, j) => (j === i ? { ...x, status: 'done' } : x)));
  };
  const open = items.map((s, i) => ({ s, i })).filter(({ s }) => s.status === 'open' && byId.get(s.note_id)?.state === 'inbox');

  return (
    <Modal open onClose={onClose} title="✨ Suggested organization" description="Edit anything that’s off, then accept. Tasks keep a link to their note; the note is archived." className="max-w-2xl">
      {open.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-semibold">All sorted.</p>
          <button className="btn-primary mt-4" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {open.map(({ s, i }) => {
              const note = byId.get(s.note_id)!;
              return (
                <li key={s.note_id} className="rounded-2xl border border-slate-900/10 p-3 dark:border-white/10">
                  <p className="muted text-xs">“{clip(note.body.replace(/\s+/g, ' '), 140)}”</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`kind-${i}`}>
                      Type
                    </label>
                    <select
                      id={`kind-${i}`}
                      className="input !w-auto !py-1.5"
                      value={s.kind}
                      onChange={(e) => setItems((list) => list.map((x, j) => (j === i ? { ...x, kind: e.target.value as SuggestionKind } : x)))}
                    >
                      {Object.entries(KIND_LABEL).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {(s.kind === 'task' || s.kind === 'reminder') && (
                      <>
                        <label className="sr-only" htmlFor={`title-${i}`}>
                          Task title
                        </label>
                        <input
                          id={`title-${i}`}
                          className="input !py-1.5 min-w-[160px] flex-1"
                          value={s.title}
                          onChange={(e) => setItems((list) => list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                        />
                        <input
                          type="date"
                          aria-label="Due date"
                          className="input !w-auto !py-1.5"
                          value={s.due_date ?? ''}
                          onChange={(e) => setItems((list) => list.map((x, j) => (j === i ? { ...x, due_date: e.target.value || null } : x)))}
                        />
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="faint flex-1 text-xs">{s.reason}</span>
                    <button className="btn-ghost !px-2.5 !py-1" onClick={() => setItems((list) => list.map((x, j) => (j === i ? { ...x, status: 'dismissed' } : x)))}>
                      <X size={13} /> Skip
                    </button>
                    <button className="btn-primary !px-2.5 !py-1" onClick={() => accept(i)}>
                      <Check size={13} /> Accept
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>
              Close
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                open.forEach(({ i }) => accept(i));
                toast(`Organized ${open.length} note${open.length === 1 ? '' : 's'}`);
              }}
            >
              Accept all ({open.length})
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ✨ Extract actions
// ---------------------------------------------------------------------------
export function ExtractPanel({ note, actions, onClose }: { note: Note; actions: { title: string; due_date: string | null; priority: Priority | null }[]; onClose: () => void }) {
  const [items, setItems] = useState(actions.map((a) => ({ ...a, keep: true })));
  const addTasks = useAddTasks();
  const toast = useToast();
  const keep = items.filter((a) => a.keep && a.title.trim());
  return (
    <Modal open onClose={onClose} title="✨ Actions found in this note" description="Untick anything you don’t want. Each becomes a task linked to the note.">
      {items.length === 0 ? (
        <p className="text-sm">No clear to-dos in this note.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a, i) => (
            <li key={i} className="flex items-center gap-2">
              <input type="checkbox" className="accent-violet-600" checked={a.keep} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} aria-label={`Keep “${a.title}”`} />
              <input className="input !py-1.5 flex-1" value={a.title} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label="Task title" />
              {a.due_date && <span className="faint text-xs">{a.due_date}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary"
          disabled={!keep.length}
          onClick={() => {
            addTasks.mutate(keep.map((a, i) => ({ title: a.title.trim(), due_date: a.due_date, priority: a.priority, source_note_id: note.id, sort: Date.now() / 1000 + i })));
            toast(`Added ${keep.length} task${keep.length === 1 ? '' : 's'}`);
            onClose();
          }}
        >
          Add {keep.length} task{keep.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ✨ Summarize (a note or the week)
// ---------------------------------------------------------------------------
export function SummaryPanel({ title, summary, keyPoints, onClose }: { title: string; summary: string; keyPoints: string[]; onClose: () => void }) {
  const addNote = useAddNote();
  const toast = useToast();
  return (
    <Modal open onClose={onClose} title={`✨ ${title}`}>
      <p className="text-sm leading-relaxed">{summary}</p>
      {keyPoints.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {keyPoints.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          className="btn-ghost"
          onClick={() => {
            addNote.mutate({ body: `## ${title}\n\n${summary}\n\n${keyPoints.map((k) => `- ${k}`).join('\n')}`, state: 'note' });
            toast('Saved as a note');
            onClose();
          }}
        >
          Save as note
        </button>
        <button className="btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ✨ Find patterns
// ---------------------------------------------------------------------------
export function PatternsPanel({ themes, onClose }: { themes: { theme: string; evidence: string; suggestion: string }[]; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="✨ Patterns in your recent notes" description="Themes that came up more than once in the last 30 days.">
      {themes.length === 0 ? (
        <p className="text-sm">No recurring themes yet — keep capturing and try again later.</p>
      ) : (
        <ul className="space-y-3">
          {themes.map((t, i) => (
            <li key={i} className="rounded-2xl border border-slate-900/10 p-3 dark:border-white/10">
              <p className="font-semibold">{t.theme}</p>
              <p className="muted mt-0.5 text-xs">{t.evidence}</p>
              <p className="mt-1.5 text-sm">💡 {t.suggestion}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ✨ Turn into a plan
// ---------------------------------------------------------------------------
export function PlanPanel({ note, plan, onClose }: { note: Note; plan: { title: string; steps: { title: string; estimate_min: number | null }[] }; onClose: () => void }) {
  const [title, setTitle] = useState(plan.title || firstLine(note.body));
  const [steps, setSteps] = useState(plan.steps.map((s) => ({ ...s, keep: true })));
  const [as, setAs] = useState<'tasks' | 'goal'>('tasks');
  const addTasks = useAddTasks();
  const addGoal = useAddGoal();
  const addMilestones = useAddMilestones();
  const updateNote = useUpdateNote();
  const toast = useToast();
  const keep = steps.filter((s) => s.keep && s.title.trim());

  const create = async () => {
    if (as === 'tasks') {
      addTasks.mutate(keep.map((s, i) => ({ title: s.title.trim(), estimate_min: s.estimate_min, source_note_id: note.id, sort: Date.now() / 1000 + i })));
      toast(`Added ${keep.length} tasks from your plan`);
    } else {
      const goal = await addGoal.mutateAsync({ title: title.trim(), emoji: '🎯', target: keep.length, current: 0, unit: 'steps', source_note_id: note.id });
      addMilestones.mutate(keep.map((s) => ({ goal_id: goal.id, title: s.title.trim() })));
      toast(`New goal “${title.trim()}” with ${keep.length} milestones`);
    }
    if (note.state === 'inbox') updateNote.mutate({ id: note.id, patch: { state: 'idea' } });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="✨ A plan for this idea" className="max-w-xl">
      <label className="block">
        <span className="label">Plan</span>
        <input className="input font-medium" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <input type="checkbox" className="accent-violet-600" checked={s.keep} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} aria-label={`Keep step ${i + 1}`} />
            <span className="faint w-5 text-right text-xs">{i + 1}.</span>
            <input className="input !py-1.5 flex-1" value={s.title} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label={`Step ${i + 1}`} />
            {s.estimate_min && <span className="faint text-xs">{s.estimate_min}m</span>}
          </li>
        ))}
      </ol>
      <fieldset className="mt-4 flex flex-wrap gap-2">
        <legend className="label">Create as</legend>
        {(
          [
            ['tasks', 'Tasks (linked to this note)'],
            ['goal', 'A goal with these milestones'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" className={cn(as === v ? 'chip-on' : 'chip-off')} onClick={() => setAs(v)} aria-pressed={as === v}>
            {label}
          </button>
        ))}
      </fieldset>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={!keep.length || !title.trim()} onClick={create}>
          Create
        </button>
      </div>
    </Modal>
  );
}
