import { ChevronDown, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QuickAddTask } from '../../components/tasks/QuickAddTask';
import { TaskEditor } from '../../components/tasks/TaskEditor';
import { TaskItem } from '../../components/tasks/TaskItem';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, QueryState } from '../../components/ui/States';
import { useGoals } from '../../hooks/data/goals';
import { useTasks, useToggleTask, useUpdateTask } from '../../hooks/data/tasks';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { addDays } from '../../lib/dates';
import type { Task } from '../../lib/types';
import { cn } from '../../lib/utils';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const byPriorityThenDue = (a: Task, b: Task) =>
  (a.priority ? PRIORITY_RANK[a.priority] : 3) - (b.priority ? PRIORITY_RANK[b.priority] : 3) ||
  (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
  a.sort - b.sort;

export default function Tasks() {
  const { today } = useToday();
  const tasks = useTasks();
  const { data: goals = [] } = useGoals();
  const toggle = useToggleTask();
  const update = useUpdateTask();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const openId = params.get('task');
  const all = tasks.data ?? [];
  const editing = all.find((t) => t.id === openId) ?? null;
  const goalName = useMemo(() => new Map(goals.map((g) => [g.id, `${g.emoji} ${g.title}`])), [goals]);

  const open = (t: Task) => setParams((p) => (p.set('task', t.id), p));
  const close = () => setParams((p) => (p.delete('task'), p));

  const topCount = all.filter((t) => !t.done && t.top_date === today && !t.parent_id).length;
  const star = (t: Task) => {
    if (t.top_date === today) return update.mutate({ id: t.id, patch: { top_date: null } });
    if (topCount >= 3) return toast('You already have 3 top tasks today — unstar one first. Three is plenty. 🙂');
    update.mutate({ id: t.id, patch: { top_date: today } });
  };

  const roots = all.filter((t) => !t.parent_id);
  const stepsOf = (id: string) => all.filter((t) => t.parent_id === id);
  const tags = [...new Set(roots.filter((t) => !t.done).flatMap((t) => t.tags))].sort();
  const q = query.trim().toLowerCase();
  const match = (t: Task) => (!q || t.title.toLowerCase().includes(q) || t.details.toLowerCase().includes(q)) && (!tag || t.tags.includes(tag));
  const open_ = roots.filter((t) => !t.done && match(t));
  const weekEnd = addDays(today, 7);

  const sections: { key: string; title: string; hint?: string; items: Task[]; hideDue?: boolean }[] = [
    { key: 'top', title: '⭐ Top 3 today', hint: 'What would make today a win', items: open_.filter((t) => t.top_date === today) },
    { key: 'overdue', title: 'Overdue', items: open_.filter((t) => t.top_date !== today && t.due_date && t.due_date < today) },
    { key: 'today', title: 'Today', items: open_.filter((t) => t.top_date !== today && t.due_date === today), hideDue: true },
    { key: 'week', title: 'Next 7 days', items: open_.filter((t) => t.top_date !== today && t.due_date && t.due_date > today && t.due_date <= weekEnd) },
    { key: 'later', title: 'Later', items: open_.filter((t) => t.top_date !== today && t.due_date && t.due_date > weekEnd) },
    { key: 'someday', title: 'No date', hint: 'Give these a date, or star one for today', items: open_.filter((t) => t.top_date !== today && !t.due_date) },
  ];
  const done = roots.filter((t) => t.done && match(t)).sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  const renderTask = (t: Task, hideDue?: boolean) => {
    const steps = stepsOf(t.id);
    const isOpen = expanded.has(t.id);
    return (
      <li key={t.id}>
        <TaskItem
          task={t}
          today={today}
          onToggle={toggle}
          onStar={star}
          onOpen={open}
          hideDue={hideDue}
          goalLabel={t.goal_id ? goalName.get(t.goal_id) : undefined}
          subtasks={steps.length ? { done: steps.filter((s) => s.done).length, total: steps.length } : undefined}
        />
        {steps.length > 0 && (
          <div className="ml-8 mt-1">
            <button
              className="faint flex items-center gap-1 text-xs hover:underline"
              onClick={() => setExpanded((s) => (s.has(t.id) ? (s.delete(t.id), new Set(s)) : new Set(s).add(t.id)))}
              aria-expanded={isOpen}
            >
              <ChevronDown size={12} className={cn('transition', !isOpen && '-rotate-90')} /> {isOpen ? 'Hide' : 'Show'} steps
            </button>
            {isOpen && (
              <ul className="mt-1 space-y-1">
                {steps.map((s) => (
                  <li key={s.id}>
                    <TaskItem task={s} today={today} onToggle={toggle} onOpen={open} className="!py-1.5" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div>
      <PageHeader title="Tasks" description="Everything you need to do, sorted by when it’s due. Star up to three as today’s top 3 — they’re what your dashboard shows first." />

      <QuickAddTask className="mb-5" />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input className="input !py-2 pl-9" placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search tasks" />
          {query && (
            <button className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        {tags.map((t) => (
          <button key={t} className={tag === t ? 'chip-on' : 'chip-off'} onClick={() => setTag(tag === t ? null : t)} aria-pressed={tag === t}>
            #{t}
          </button>
        ))}
      </div>

      <QueryState isLoading={tasks.isLoading} error={tasks.error} onRetry={() => tasks.refetch()} />

      {tasks.data && roots.length === 0 && (
        <EmptyState emoji="✅" title="No tasks yet">
          Type one above in plain language — “call the dentist tomorrow 10am” — and Daybloom picks up the date, time, #tags and !priority. Or turn notes from your
          Brain Dump into tasks.
        </EmptyState>
      )}

      {tasks.data && roots.length > 0 && (
        <div className="space-y-6">
          {sections.map(
            (s) =>
              (s.items.length > 0 || (s.key === 'top' && !q && !tag)) && (
                <section key={s.key} aria-labelledby={`sec-${s.key}`}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <h2 id={`sec-${s.key}`} className={cn('text-sm font-bold', s.key === 'overdue' && 'text-danger ')}>
                      {s.title}
                    </h2>
                    <span className="faint text-xs">{s.key === 'top' ? `${s.items.length}/3` : s.items.length}</span>
                    {s.hint && <span className="faint hidden text-xs sm:inline">· {s.hint}</span>}
                  </div>
                  {s.items.length ? (
                    <ul className="space-y-1.5">{[...s.items].sort(byPriorityThenDue).map((t) => renderTask(t, s.hideDue))}</ul>
                  ) : (
                    <p className="muted rounded-xl border border-dashed border-line-strong px-3 py-3 text-sm">
                      Star (☆) up to three tasks to make them today’s top 3.
                    </p>
                  )}
                </section>
              ),
          )}
          {open_.length === 0 && (q || tag) && <p className="muted text-sm">No open tasks match.</p>}

          <section aria-labelledby="sec-done">
            <button id="sec-done" className="flex items-center gap-2 text-sm font-bold" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
              <ChevronDown size={15} className={cn('transition', !showDone && '-rotate-90')} /> Done
              <span className="faint text-xs font-normal">{done.length} in the last 60 days</span>
            </button>
            {showDone && <ul className="mt-2 space-y-1.5">{done.slice(0, 100).map((t) => renderTask(t))}</ul>}
          </section>
        </div>
      )}

      <TaskEditor task={editing} onClose={close} />
    </div>
  );
}
