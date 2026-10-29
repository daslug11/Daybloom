import { useEffect, useState } from 'react';
import { useAddGoal, useGoals } from '../../hooks/data/goals';
import { useAddHabits } from '../../hooks/data/habits';
import { useUpdateNote } from '../../hooks/data/notes';
import { useAddTasks } from '../../hooks/data/tasks';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { minutesFromTime } from '../../lib/quickAdd';
import { firstLine } from '../../lib/text';
import type { Note } from '../../lib/types';
import { EmojiPicker } from '../ui/EmojiPicker';
import { Modal } from '../ui/Modal';

export type ConvertKind = 'task' | 'block' | 'goal-task' | 'habit' | 'goal';

const TITLES: Record<ConvertKind, string> = {
  task: 'Make it a task',
  block: 'Schedule it in the Planner',
  'goal-task': 'Add it to a goal',
  habit: 'Make it a habit',
  goal: 'Make it a goal',
};

const HABIT_EMOJIS = ['✅', '💧', '🏃', '📖', '🧘', '🥗', '😴', '✍️', '🎸', '🧹', '💊', '🌱', '📵', '🧠', '🙏', '💪'];
const GOAL_EMOJIS = ['🎯', '📚', '🏃', '💰', '✈️', '🚀', '🎨', '💻', '🏋️', '🧘', '🌱', '🏆'];

interface Props {
  note: Note | null;
  kind: ConvertKind;
  /** Text the user selected inside the note, if any. */
  selection?: string;
  onClose: () => void;
  /** Called after creating, e.g. to advance the inbox processor. */
  onDone?: () => void;
}

/** Turns a note (or selected text) into a task, time block, goal step, habit or goal — keeping a link back to the note. */
export function ConvertDialog({ note, kind, selection, onClose, onDone }: Props) {
  const { today } = useToday();
  const { data: goals = [] } = useGoals();
  const addTasks = useAddTasks();
  const addHabits = useAddHabits();
  const addGoal = useAddGoal();
  const updateNote = useUpdateNote();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [goalId, setGoalId] = useState('');
  const [emoji, setEmoji] = useState('✅');
  const [target, setTarget] = useState('10');
  const [unit, setUnit] = useState('');
  const [archive, setArchive] = useState(true);

  useEffect(() => {
    if (!note) return;
    setTitle((selection?.trim() || firstLine(note.body, 200)).slice(0, kind === 'habit' ? 120 : 200));
    setDue('');
    setDate(today);
    setStart('09:00');
    setDuration(60);
    setGoalId(goals.find((g) => !g.completed_at)?.id ?? '');
    setEmoji(kind === 'goal' ? '🎯' : '✅');
    setArchive(note.state === 'inbox');
  }, [note, kind, selection]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!note) return null;

  const finish = (label: string) => {
    if (archive && note.state !== 'archived') updateNote.mutate({ id: note.id, patch: { state: 'archived', processed_at: new Date().toISOString() } });
    toast(label);
    onDone?.();
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (kind === 'task') {
      addTasks.mutate([{ title: t, due_date: due || null, source_note_id: note.id }]);
      finish(`Task added: “${t}”`);
    } else if (kind === 'block') {
      const s = Math.min(Math.round(minutesFromTime(start) / 15) * 15, 1425);
      addTasks.mutate([{ title: t, sched_date: date, sched_start: s, sched_duration: Math.min(duration, 1440 - s), due_date: date, source_note_id: note.id }]);
      finish(`Scheduled “${t}” in the Planner`);
    } else if (kind === 'goal-task') {
      if (!goalId) return;
      addTasks.mutate([{ title: t, goal_id: goalId, due_date: due || null, source_note_id: note.id }]);
      const g = goals.find((x) => x.id === goalId);
      finish(`Added “${t}” to ${g ? `${g.emoji} ${g.title}` : 'your goal'}`);
    } else if (kind === 'habit') {
      addHabits.mutate([{ name: t, emoji, source_note_id: note.id }]);
      finish(`New habit: ${emoji} ${t}`);
    } else {
      const n = Number(target);
      if (!(n > 0)) return;
      addGoal.mutate({ title: t, emoji, target: n, current: 0, unit: unit.trim(), source_note_id: note.id });
      finish(`New goal: ${emoji} ${t}`);
    }
  };

  const noGoals = kind === 'goal-task' && goals.length === 0;

  return (
    <Modal open onClose={onClose} title={TITLES[kind]} description={selection?.trim() ? 'From the text you selected.' : 'A link back to this note is kept.'}>
      {noGoals ? (
        <p className="text-sm">You don’t have any goals yet. Use “Make it a goal” instead, or create one on the Goals page.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="convert-title">
              {kind === 'habit' ? 'Habit' : kind === 'goal' ? 'Goal' : 'Task'}
            </label>
            <input id="convert-title" autoFocus className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {(kind === 'task' || kind === 'goal-task') && (
            <label className="block">
              <span className="label">Due date (optional)</span>
              <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
          )}
          {kind === 'goal-task' && (
            <label className="block">
              <span className="label">Goal</span>
              <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.emoji} {g.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'block' && (
            <div className="grid grid-cols-3 gap-2">
              <label>
                <span className="label">Day</span>
                <input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              </label>
              <label>
                <span className="label">Start</span>
                <input type="time" step={900} className="input" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
              </label>
              <label>
                <span className="label">Length</span>
                <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {[15, 30, 45, 60, 90, 120, 180].map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} min` : `${m / 60} h`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {(kind === 'habit' || kind === 'goal') && (
            <div>
              <span className="label">Emoji</span>
              <EmojiPicker options={kind === 'habit' ? HABIT_EMOJIS : GOAL_EMOJIS} value={emoji} onChange={setEmoji} />
            </div>
          )}
          {kind === 'goal' && (
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">Target</span>
                <input type="number" min={1} className="input" value={target} onChange={(e) => setTarget(e.target.value)} />
              </label>
              <label>
                <span className="label">Unit</span>
                <input className="input" placeholder="books, km, sessions…" value={unit} maxLength={40} onChange={(e) => setUnit(e.target.value)} />
              </label>
            </div>
          )}
          {note.state !== 'archived' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-violet-600" checked={archive} onChange={(e) => setArchive(e.target.checked)} />
              Archive the note afterwards (it stays linked)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!title.trim() || (kind === 'goal-task' && !goalId)}>
              Create
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
