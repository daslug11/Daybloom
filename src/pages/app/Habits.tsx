import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HabitCard } from '../../components/habits/HabitCard';
import { AiButton } from '../../components/ui/Ai';
import { EmojiPicker } from '../../components/ui/EmojiPicker';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, QueryState } from '../../components/ui/States';
import { useGoals } from '../../hooks/data/goals';
import { useAddHabits, useDeleteHabit, useHabitLogs, useHabits, useToggleHabitLog, useUpdateHabit } from '../../hooks/data/habits';
import { useAi } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { streak } from '../../lib/dates';
import type { Habit } from '../../lib/types';

const EMOJIS = ['✅', '💧', '🏃', '📖', '🧘', '🥗', '😴', '✍️', '🎸', '🧹', '💊', '🌱', '📵', '🧠', '🙏', '💪', '🚶', '☀️'];

interface Suggested {
  name: string;
  emoji: string;
  why: string;
  goal_id: string | null;
}

export default function Habits() {
  const { today } = useToday();
  const habits = useHabits();
  const logs = useHabitLogs(today);
  const { data: goals = [] } = useGoals();
  const toggle = useToggleHabitLog();
  const add = useAddHabits();
  const update = useUpdateHabit();
  const del = useDeleteHabit();
  const toast = useToast();
  const suggest = useAi<{ habits: Suggested[] }>('suggest_habits');
  const [editor, setEditor] = useState<Partial<Habit> | null>(null);
  const [suggestions, setSuggestions] = useState<Suggested[] | null>(null);

  const byHabit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of logs.data ?? []) {
      if (!map.has(l.habit_id)) map.set(l.habit_id, new Set());
      map.get(l.habit_id)!.add(l.day);
    }
    return map;
  }, [logs.data]);
  const goalLabel = new Map(goals.map((g) => [g.id, `${g.emoji} ${g.title}`]));
  const list = habits.data ?? [];
  const doneToday = list.filter((h) => byHabit.get(h.id)?.has(today)).length;

  const save = () => {
    if (!editor?.name?.trim()) return;
    if (editor.id) update.mutate({ id: editor.id, patch: { name: editor.name.trim(), emoji: editor.emoji ?? '✅', goal_id: editor.goal_id ?? null } });
    else add.mutate([{ name: editor.name.trim(), emoji: editor.emoji ?? '✅', goal_id: editor.goal_id ?? null }]);
    setEditor(null);
  };

  return (
    <div>
      <PageHeader
        title="Habits"
        description="Small things you want to do every day. Tick today’s, watch the streak grow, and click any past square to fix your history."
        actions={
          <>
            <AiButton
              loading={suggest.isPending}
              onClick={() => suggest.mutate({}, { onSuccess: (r) => setSuggestions(r.result.habits) })}
              hint="Ideas for small daily habits based on your goals"
            >
              Suggest from goals
            </AiButton>
            <button className="btn-primary" onClick={() => setEditor({ emoji: '✅' })}>
              <Plus size={16} /> New habit
            </button>
          </>
        }
      />

      <QueryState isLoading={habits.isLoading || logs.isLoading} error={habits.error ?? logs.error} onRetry={() => (habits.refetch(), logs.refetch())} />

      {habits.data && list.length === 0 && (
        <EmptyState emoji="🌱" title="No habits yet" action={<button className="btn-primary" onClick={() => setEditor({ emoji: '✅' })}>Add your first habit</button>}>
          Pick something small you can do daily — “drink water”, “10-minute walk”, “read 10 pages”. If you’ve set goals, ✨ Suggest from goals proposes a few.
        </EmptyState>
      )}

      {list.length > 0 && (
        <>
          <p className="muted mb-3 text-sm" aria-live="polite">
            <strong className="text-ink ">{doneToday}</strong> of {list.length} done today.
          </p>
          <h2 className="sr-only">Your habits</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((h) => {
              const days = byHabit.get(h.id) ?? new Set<string>();
              return (
                <HabitCard
                  key={h.id}
                  habit={h}
                  today={today}
                  days={days}
                  streak={streak(days, today)}
                  goalLabel={h.goal_id ? goalLabel.get(h.goal_id) : undefined}
                  onToggle={(day) => toggle.mutate({ habit_id: h.id, day, done: !days.has(day) })}
                  onEdit={() => setEditor(h)}
                />
              );
            })}
          </div>
          <p className="faint mt-4 text-xs">Streak = days in a row ending today, or ending yesterday if you haven’t logged today yet. Darker squares are days you did it.</p>
        </>
      )}

      {editor && (
        <Modal open onClose={() => setEditor(null)} title={editor.id ? 'Edit habit' : 'New habit'} description="Keep it small enough to do on a bad day.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="label">Habit</span>
              <input autoFocus className="input" maxLength={120} placeholder="e.g. 10-minute walk" value={editor.name ?? ''} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
            </label>
            <div>
              <span className="label">Emoji</span>
              <EmojiPicker options={EMOJIS} value={editor.emoji ?? '✅'} onChange={(emoji) => setEditor({ ...editor, emoji })} />
            </div>
            {goals.length > 0 && (
              <label className="block">
                <span className="label">Supports a goal (optional)</span>
                <select className="input" value={editor.goal_id ?? ''} onChange={(e) => setEditor({ ...editor, goal_id: e.target.value || null })}>
                  <option value="">None</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.emoji} {g.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex items-center gap-2">
              {editor.id && (
                <>
                  <button
                    type="button"
                    className="btn-ghost !px-3"
                    onClick={() => {
                      update.mutate({ id: editor.id!, patch: { archived_at: new Date().toISOString() } });
                      toast('Habit archived — its history is kept', { label: 'Undo', onClick: () => update.mutate({ id: editor.id!, patch: { archived_at: null } }) });
                      setEditor(null);
                    }}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className="btn-danger !px-3"
                    onClick={() => {
                      if (!window.confirm(`Delete “${editor.name}” and all its history? This can’t be undone.`)) return;
                      del.mutate(editor.id!);
                      setEditor(null);
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
              <button className="btn-primary ml-auto" disabled={!editor.name?.trim()}>
                {editor.id ? 'Save' : 'Add habit'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {suggestions && (
        <Modal open onClose={() => setSuggestions(null)} title="✨ Habits that support your goals" description="Add the ones you like; you can edit them later.">
          {suggestions.length === 0 ? (
            <p className="text-sm">No new suggestions — you may already have habits covering your goals.</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-3 rounded-2xl border border-line p-3">
                  <span className="text-xl" aria-hidden>
                    {s.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="muted text-xs">
                      {s.why}
                      {s.goal_id && goalLabel.get(s.goal_id) ? ` · for ${goalLabel.get(s.goal_id)}` : ''}
                    </p>
                  </div>
                  <button
                    className="btn-primary !px-3 !py-1.5"
                    onClick={() => {
                      add.mutate([{ name: s.name, emoji: s.emoji, goal_id: s.goal_id }]);
                      setSuggestions(suggestions.filter((_, j) => j !== i));
                      toast(`Added ${s.emoji} ${s.name}`);
                    }}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
