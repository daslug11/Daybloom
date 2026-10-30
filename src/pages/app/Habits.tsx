import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HabitCard } from '../../components/habits/HabitCard';
import { AiButton } from '../../components/ui/Ai';
import { EmojiPicker } from '../../components/ui/EmojiPicker';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, QueryState } from '../../components/ui/States';
import { useGoals } from '../../hooks/data/goals';
import { streakIsCapped, useAddHabits, useDeleteHabit, useHabitLogs, useHabits, useToggleHabitLog, useUpdateHabit } from '../../hooks/data/habits';
import { useAi } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { dayIn, formatDay, streak } from '../../lib/dates';
import { STREAK_RULE, habitStartDay } from '../../lib/stats';
import type { Habit } from '../../lib/types';

const EMOJIS = ['✅', '💧', '🏃', '📖', '🧘', '🥗', '😴', '✍️', '🎸', '🧹', '💊', '🌱', '📵', '🧠', '🙏', '💪', '🚶', '☀️'];

interface Suggested {
  name: string;
  emoji: string;
  why: string;
  goal_id: string | null;
}

export default function Habits() {
  const { today, tz } = useToday();
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
  // AI suggestions still to decide on, plus the names already added (so an emptied list says "Added N", not "No suggestions").
  const [suggestions, setSuggestions] = useState<{ items: Suggested[]; added: string[] } | null>(null);

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

  const toggleDay = (h: Habit, day: string, days: Set<string>) => {
    const done = !days.has(day);
    toggle.mutate({ habit_id: h.id, day, done });
    // Fixing history is easy to do by accident on a phone, so past days get an Undo.
    if (day !== today) {
      toast(`${h.name}: ${formatDay(day, today)} marked ${done ? 'done' : 'not done'}`, { label: 'Undo', onClick: () => toggle.mutate({ habit_id: h.id, day, done: !done }) });
    }
  };

  const addSuggested = (items: Suggested[]) => {
    if (!suggestions || !items.length) return;
    add.mutate(items.map((s) => ({ name: s.name, emoji: s.emoji, goal_id: s.goal_id })));
    const names = new Set(items.map((s) => s.name));
    setSuggestions({ items: suggestions.items.filter((s) => !names.has(s.name)), added: [...suggestions.added, ...items.map((s) => s.name)] });
  };

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
        description="Small things you want to do every day. Tick today’s, watch the streak grow, and tap any past square to fix your history."
        actions={
          <>
            <AiButton
              loading={suggest.isPending}
              onClick={() => suggest.mutate({}, { onSuccess: (r) => setSuggestions({ items: r.result.habits, added: [] }) })}
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
          <GridLegend />
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((h) => {
              const days = byHabit.get(h.id) ?? new Set<string>();
              return (
                <HabitCard
                  key={h.id}
                  habit={h}
                  today={today}
                  start={habitStartDay(dayIn(tz, new Date(h.created_at)), days)}
                  days={days}
                  streak={streak(days, today)}
                  streakCapped={streakIsCapped(days, today)}
                  goalLabel={h.goal_id ? goalLabel.get(h.goal_id) : undefined}
                  onToggle={(day) => toggleDay(h, day, days)}
                  onEdit={() => setEditor(h)}
                />
              );
            })}
          </div>
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
          <div className="rounded-card border border-atlas/30 bg-atlas/[0.04] p-3" aria-live="polite">
            {suggestions.items.length === 0 ? (
              <p className="text-sm">
                {suggestions.added.length
                  ? `Added ${suggestions.added.length} habit${suggestions.added.length === 1 ? '' : 's'} ✓ They’re on your list now.`
                  : 'No new suggestions — you may already have habits covering your goals.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {suggestions.items.map((s) => (
                  <li key={s.name} className="flex items-start gap-3 rounded-control border border-line bg-surface p-3">
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
                    <button className="btn-ghost !px-3 !py-1.5" onClick={() => addSuggested([s])} aria-label={`Add ${s.name}`}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            {suggestions.added.length > 0 && suggestions.items.length > 0 && <span className="muted mr-auto text-xs">Added {suggestions.added.length}</span>}
            {suggestions.items.length > 1 && (
              <button className="btn-ghost" onClick={() => addSuggested(suggestions.items)}>
                Add all {suggestions.items.length}
              </button>
            )}
            <button className="btn-primary" onClick={() => setSuggestions(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** What the squares mean, shown once above the cards. */
function GridLegend() {
  const sw = 'inline-block h-3 w-3 shrink-0 rounded-[3px]';
  return (
    <div className="muted mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="flex items-center gap-1.5">
        <span className={`${sw} bg-ink/70`} aria-hidden /> Filled = done
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${sw} bg-raised ring-1 ring-inset ring-line`} aria-hidden /> Empty = not done
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${sw} bg-raised outline outline-1 outline-offset-1 outline-ink/60`} aria-hidden /> Today
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${sw} border border-dashed border-line-strong`} aria-hidden /> Before you started
      </span>
      <span>Streak: {STREAK_RULE.charAt(0).toLowerCase() + STREAK_RULE.slice(1)}</span>
    </div>
  );
}
