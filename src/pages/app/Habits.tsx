import { ChevronDown, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HabitCard } from '../../components/habits/HabitCard';
import { AiButton } from '../../components/ui/Ai';
import { EmojiPicker } from '../../components/ui/EmojiPicker';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, QueryState } from '../../components/ui/States';
import { useGoals } from '../../hooks/data/goals';
import { HISTORY_DAYS, streakIsCapped, useAddHabits, useArchivedHabits, useDeleteHabit, useHabitLogs, useHabits, useRestoreHabit, useToggleHabitLog, useUpdateHabit } from '../../hooks/data/habits';
import { useAi } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { addDays, dayIn, formatDay, streak } from '../../lib/dates';
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
  const archived = useArchivedHabits();
  const restore = useRestoreHabit();
  const [editor, setEditorState] = useState<Partial<Habit> | null>(null);
  // The in-dialog "really delete?" step; reset whenever the dialog opens or closes.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setEditor = (e: Partial<Habit> | null) => {
    if (!e || e.id !== editor?.id) setConfirmDelete(false);
    setEditorState(e);
  };
  const [showArchived, setShowArchived] = useState(false);
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

      <ArchivedHabits
        habits={archived.data ?? []}
        open={showArchived}
        onToggle={() => setShowArchived((v) => !v)}
        onRestore={(h) => {
          restore.mutate(h);
          toast(`Restored ${h.emoji} ${h.name}, with its history.`);
        }}
        restoring={restore.isPending ? restore.variables?.id : undefined}
      />

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
            {editor.id && confirmDelete ? (
              <DeleteConfirm
                name={`${editor.emoji ?? ''} ${editor.name ?? ''}`.trim()}
                ticked={[...(byHabit.get(editor.id) ?? [])].filter((d) => d > addDays(today, -HISTORY_DAYS)).length}
                streakDays={streak(byHabit.get(editor.id) ?? new Set<string>(), today)}
                onCancel={() => setConfirmDelete(false)}
                onArchive={() => {
                  const id = editor.id!;
                  update.mutate({ id, patch: { archived_at: new Date().toISOString() } });
                  toast('Habit archived — its history is kept', { label: 'Undo', onClick: () => update.mutate({ id, patch: { archived_at: null } }) });
                  setEditor(null);
                }}
                onDelete={() => {
                  del.mutate(editor.id!);
                  toast(`Deleted ${editor.name} and its history.`);
                  setEditor(null);
                }}
              />
            ) : (
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
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete…
                    </button>
                  </>
                )}
                <button className="btn-primary ml-auto" disabled={!editor.name?.trim()}>
                  {editor.id ? 'Save' : 'Add habit'}
                </button>
              </div>
            )}
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

/** The last step before deleting: says exactly what history goes with it, and offers Archive instead. */
function DeleteConfirm({ name, ticked, streakDays, onCancel, onArchive, onDelete }: { name: string; ticked: number; streakDays: number; onCancel: () => void; onArchive: () => void; onDelete: () => void }) {
  const lost = [
    ticked ? `${ticked} ticked day${ticked === 1 ? '' : 's'} from the last ${HISTORY_DAYS} days` : '',
    streakDays ? `your ${streakDays}-day streak` : '',
  ].filter(Boolean);
  return (
    <div role="group" aria-labelledby="habit-delete-title" className="space-y-3 rounded-control border border-danger/30 bg-danger/[0.06] p-3">
      <p id="habit-delete-title" className="text-sm font-semibold">
        Delete “{name}” for good?
      </p>
      <p className="text-sm [text-wrap:pretty]">
        This deletes the habit and every day you’ve ticked for it{lost.length ? `, including ${lost.join(' and ')}` : ''}. It can’t be undone. Archive it instead to hide it and keep the history.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost !px-3" onClick={onCancel} autoFocus>
          Keep it
        </button>
        <button type="button" className="btn-ghost !px-3" onClick={onArchive}>
          Archive instead
        </button>
        <button type="button" className="btn-danger ml-auto !px-3" onClick={onDelete}>
          Delete habit and history
        </button>
      </div>
    </div>
  );
}

/** Archived habits: hidden from the list and the dashboard, history kept, one tap to bring back. */
function ArchivedHabits({ habits, open, onToggle, onRestore, restoring }: { habits: Habit[]; open: boolean; onToggle: () => void; onRestore: (h: Habit) => void; restoring?: string }) {
  if (!habits.length) return null;
  return (
    <section className="mt-6" aria-labelledby="archived-habits-toggle">
      <h2>
        <button
          id="archived-habits-toggle"
          type="button"
          className="hit flex items-center gap-1.5 rounded-control text-sm font-semibold text-muted hover:text-ink"
          aria-expanded={open}
          aria-controls="archived-habits"
          onClick={onToggle}
        >
          <ChevronDown size={15} aria-hidden className={open ? '' : '-rotate-90'} />
          Archived ({habits.length})
        </button>
      </h2>
      {open && (
        <ul id="archived-habits" className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
          {habits.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-lg" aria-hidden>
                {h.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{h.name}</p>
                {h.archived_at && <p className="faint text-xs">Archived {new Date(h.archived_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · history kept</p>}
              </div>
              <button type="button" className="btn-ghost !px-3 !py-1.5" onClick={() => onRestore(h)} disabled={restoring === h.id} aria-label={`Restore ${h.name}`}>
                <RotateCcw size={14} aria-hidden /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
