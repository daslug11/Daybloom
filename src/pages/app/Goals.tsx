import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoalCard } from '../../components/goals/GoalCard';
import { AiButton } from '../../components/ui/Ai';
import { EmojiPicker } from '../../components/ui/EmojiPicker';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, QueryState } from '../../components/ui/States';
import { useAddGoal, useAddMilestones, useDeleteGoal, useDeleteMilestone, useGoals, useMilestones, useUpdateGoal, useUpdateMilestone } from '../../hooks/data/goals';
import { useHabits } from '../../hooks/data/habits';
import { useAddTasks, useTasks } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import { useToast } from '../../hooks/useToast';
import { celebrate } from '../../lib/confetti';
import type { Goal } from '../../lib/types';

const EMOJIS = ['🎯', '📚', '🏃', '💰', '✈️', '🚀', '🎨', '💻', '🏋️', '🧘', '🌱', '🏆', '🎸', '✍️', '🏠', '❤️'];

interface PlanResult {
  milestones: { title: string; tasks: { title: string; due_date: string | null }[] }[];
}

export default function Goals() {
  const goals = useGoals();
  const { data: milestones = [] } = useMilestones();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const addGoal = useAddGoal();
  const update = useUpdateGoal();
  const del = useDeleteGoal();
  const addMilestones = useAddMilestones();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const addTasks = useAddTasks();
  const plan = useAi<PlanResult>('goal_plan');
  const toast = useToast();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<(Partial<Goal> & { targetText?: string; currentText?: string }) | null>(null);
  const [planFor, setPlanFor] = useState<{ goal: Goal; result: PlanResult } | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);

  const list = goals.data ?? [];
  const active = list.filter((g) => !g.completed_at);
  const completed = list.filter((g) => g.completed_at);

  const setProgress = (g: Goal, value: number) => {
    const next = Math.max(0, value);
    const reached = next >= Number(g.target);
    if (reached && !g.completed_at) {
      celebrate();
      toast(`${g.emoji} Goal reached: ${g.title}! 🏆`);
    }
    update.mutate({ id: g.id, patch: { current: next, completed_at: reached ? g.completed_at ?? new Date().toISOString() : null } });
  };

  const save = () => {
    if (!editor?.title?.trim()) return;
    const target = Number(editor.targetText ?? editor.target);
    const current = Number(editor.currentText ?? editor.current ?? 0);
    if (!(target > 0)) return toast('The target must be a number above 0.');
    const data = { title: editor.title.trim(), emoji: editor.emoji ?? '🎯', target, current: Math.max(0, current || 0), unit: (editor.unit ?? '').trim(), due_date: editor.due_date || null };
    if (editor.id) update.mutate({ id: editor.id, patch: { ...data, completed_at: data.current >= target ? editor.completed_at ?? new Date().toISOString() : null } });
    else addGoal.mutate(data);
    setEditor(null);
  };

  const acceptPlan = async () => {
    if (!planFor) return;
    const { goal, result } = planFor;
    const created = await addMilestones.mutateAsync(result.milestones.map((m) => ({ goal_id: goal.id, title: m.title })));
    const rows = result.milestones.flatMap((m, i) => m.tasks.map((t) => ({ title: t.title, due_date: t.due_date, goal_id: goal.id, milestone_id: created[i]?.id ?? null })));
    if (rows.length) addTasks.mutate(rows);
    toast(`Added ${result.milestones.length} milestones and ${rows.length} tasks`, { label: 'View tasks', onClick: () => navigate('/app/tasks') });
    setPlanFor(null);
  };

  const renderGoal = (g: Goal) => (
    <GoalCard
      key={g.id}
      goal={g}
      milestones={milestones.filter((m) => m.goal_id === g.id)}
      openTasks={tasks.filter((t) => t.goal_id === g.id && !t.done).length}
      habits={habits.filter((h) => h.goal_id === g.id).length}
      onBump={(d) => setProgress(g, Number(g.current) + d)}
      onEdit={() => setEditor({ ...g, targetText: String(g.target), currentText: String(g.current) })}
      onToggleMilestone={(m) => updateMilestone.mutate({ id: m.id, patch: { done: !m.done } })}
      actions={
        !g.completed_at && (
          <AiButton
            size="sm"
            loading={planning === g.id}
            onClick={() => {
              setPlanning(g.id);
              plan.mutate({ goal_id: g.id }, { onSuccess: (r) => setPlanFor({ goal: g, result: r.result }), onSettled: () => setPlanning(null) });
            }}
            hint="Break this goal into milestones and next tasks"
          >
            Make a plan
          </AiButton>
        )
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Things you want to achieve, with a number to track — “Read 24 books”. Update progress as you go, and break big goals into milestones and tasks."
        actions={
          <button className="btn-primary" onClick={() => setEditor({ emoji: '🎯', targetText: '10', currentText: '0' })}>
            <Plus size={16} /> New goal
          </button>
        }
      />
      <QueryState isLoading={goals.isLoading} error={goals.error} onRetry={() => goals.refetch()} />
      {goals.data && list.length === 0 && (
        <EmptyState emoji="🎯" title="No goals yet" action={<button className="btn-primary" onClick={() => setEditor({ emoji: '🎯', targetText: '10', currentText: '0' })}>Set your first goal</button>}>
          A goal here is something measurable: a number you’re working towards, like “Run 100 km” or “Save 2,000”. ✨ Make a plan can break it into milestones.
        </EmptyState>
      )}
      {active.length > 0 && (
        <>
          <h2 className="sr-only">Active goals</h2>
          <div className="grid gap-3 md:grid-cols-2">{active.map(renderGoal)}</div>
        </>
      )}
      {completed.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">Completed 🏆</h2>
          <div className="grid gap-3 md:grid-cols-2">{completed.map(renderGoal)}</div>
        </section>
      )}

      {editor && (
        <Modal open onClose={() => setEditor(null)} title={editor.id ? 'Edit goal' : 'New goal'} description="Shown as “Title target unit” — e.g. “Read 24 books”.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="block">
              <span className="label">Goal</span>
              <input autoFocus className="input" maxLength={200} placeholder="e.g. Read 24 books" value={editor.title ?? ''} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label>
                <span className="label">Now at</span>
                <input type="number" min={0} step="any" className="input" value={editor.currentText ?? ''} onChange={(e) => setEditor({ ...editor, currentText: e.target.value })} />
              </label>
              <label>
                <span className="label">Target</span>
                <input type="number" min={0} step="any" className="input" value={editor.targetText ?? ''} onChange={(e) => setEditor({ ...editor, targetText: e.target.value })} />
              </label>
              <label>
                <span className="label">Unit</span>
                <input className="input" maxLength={40} placeholder="books" value={editor.unit ?? ''} onChange={(e) => setEditor({ ...editor, unit: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="label">Deadline (optional)</span>
              <input type="date" className="input" value={editor.due_date ?? ''} onChange={(e) => setEditor({ ...editor, due_date: e.target.value || null })} />
            </label>
            <div>
              <span className="label">Emoji</span>
              <EmojiPicker options={EMOJIS} value={editor.emoji ?? '🎯'} onChange={(emoji) => setEditor({ ...editor, emoji })} />
            </div>
            {editor.id && milestones.some((m) => m.goal_id === editor.id) && (
              <div>
                <span className="label">Milestones</span>
                <ul className="space-y-1">
                  {milestones
                    .filter((m) => m.goal_id === editor.id)
                    .map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{m.title}</span>
                        <button type="button" className="icon-btn h-7 w-7" onClick={() => deleteMilestone.mutate(m.id)} aria-label={`Remove milestone ${m.title}`}>
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-2">
              {editor.id && (
                <button
                  type="button"
                  className="btn-danger !px-3"
                  onClick={() => {
                    if (!window.confirm(`Delete “${editor.title}”? Its milestones go too; linked tasks and habits are kept.`)) return;
                    del.mutate(editor.id!);
                    setEditor(null);
                  }}
                >
                  Delete
                </button>
              )}
              <button className="btn-primary ml-auto" disabled={!editor.title?.trim()}>
                {editor.id ? 'Save' : 'Add goal'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {planFor && (
        <Modal open onClose={() => setPlanFor(null)} title={`✨ A plan for ${planFor.goal.emoji} ${planFor.goal.title}`} description="Edit or remove anything, then add it. Tasks are linked to the goal." className="max-w-xl">
          <ol className="space-y-4">
            {planFor.result.milestones.map((m, i) => (
              <li key={i}>
                <div className="flex items-center gap-2">
                  <span className="faint text-xs font-bold">{i + 1}</span>
                  <input
                    className="input !py-1.5 font-medium"
                    value={m.title}
                    aria-label={`Milestone ${i + 1}`}
                    onChange={(e) => setPlanFor({ ...planFor, result: { milestones: planFor.result.milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) } })}
                  />
                  <button
                    className="icon-btn h-8 w-8"
                    aria-label="Remove milestone"
                    onClick={() => setPlanFor({ ...planFor, result: { milestones: planFor.result.milestones.filter((_, j) => j !== i) } })}
                  >
                    <X size={14} />
                  </button>
                </div>
                <ul className="ml-6 mt-1.5 space-y-1">
                  {m.tasks.map((t, k) => (
                    <li key={k} className="flex items-center gap-2 text-sm">
                      <span className="faint">•</span>
                      <span className="flex-1">{t.title}</span>
                      {t.due_date && <span className="faint text-xs">{t.due_date}</span>}
                      <button
                        className="icon-btn h-7 w-7"
                        aria-label={`Remove task ${t.title}`}
                        onClick={() =>
                          setPlanFor({ ...planFor, result: { milestones: planFor.result.milestones.map((x, j) => (j === i ? { ...x, tasks: x.tasks.filter((_, n) => n !== k) } : x)) } })
                        }
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setPlanFor(null)}>
              Discard
            </button>
            <button className="btn-primary" onClick={acceptPlan} disabled={!planFor.result.milestones.length}>
              Add to my goal
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
