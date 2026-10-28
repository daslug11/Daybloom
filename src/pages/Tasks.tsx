import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, GripVertical, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useFocusIds, useTasks } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { celebrate } from '../lib/confetti';
import type { Task, TaskStatus } from '../lib/types';
import { cn, uid } from '../lib/utils';

const COLUMNS: { id: TaskStatus; title: string; accent: string }[] = [
  { id: 'todo', title: 'To Do 📝', accent: 'from-violet-500 to-indigo-500' },
  { id: 'doing', title: 'In Progress ⚡', accent: 'from-blue-500 to-cyan-400' },
  { id: 'done', title: 'Done ✅', accent: 'from-pink-500 to-fuchsia-500' },
];

function withStatus(t: Task, status: TaskStatus): Task {
  if (t.status === status) return t;
  return { ...t, status, completedAt: status === 'done' ? new Date().toISOString() : undefined };
}

export default function Tasks() {
  const [tasks, setTasks] = useTasks();
  const [focusIds, setFocusIds] = useFocusIds();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: TaskStatus; before: string | null } | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setTasks((t) => [{ id: uid(), title: title.trim(), status: 'todo', createdAt: new Date().toISOString() }, ...t]);
    setTitle('');
  };

  /** Move a task to a column, optionally placing it before another task. */
  const move = (id: string, status: TaskStatus, beforeId: string | null) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (status === 'done' && task.status !== 'done') celebrate();
    setTasks((all) => {
      const moving = withStatus(all.find((t) => t.id === id)!, status);
      const rest = all.filter((t) => t.id !== id);
      let idx = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
      if (idx === -1) {
        // Append after the last task of that column.
        const lastInCol = rest.map((t) => t.status).lastIndexOf(status);
        idx = lastInCol + 1;
      }
      rest.splice(idx, 0, moving);
      return rest;
    });
  };

  const remove = (task: Task) => {
    const index = tasks.findIndex((t) => t.id === task.id);
    setTasks((all) => all.filter((t) => t.id !== task.id));
    setFocusIds((ids) => ids.filter((x) => x !== task.id));
    toast('Task deleted 🗑️', {
      label: 'Undo',
      onClick: () => setTasks((all) => [...all.slice(0, index), task, ...all.slice(index)]),
    });
  };

  const toggleFocus = (id: string) => {
    if (focusIds.includes(id)) setFocusIds((ids) => ids.filter((x) => x !== id));
    else if (focusIds.length >= 3) toast('Today’s Focus is full (3 max) — stay focused! 🎯');
    else {
      setFocusIds((ids) => [...ids, id]);
      toast('Added to Today’s Focus ⭐');
    }
  };

  const onDrop = (col: TaskStatus) => {
    if (dragId) move(dragId, col, over?.before ?? null);
    setDragId(null);
    setOver(null);
  };

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Drag cards between columns. Ship it. 🚢" />

      <form onSubmit={add} className="glass mb-6 flex gap-2 p-2">
        <input className="input border-none bg-transparent dark:bg-transparent" placeholder="What needs doing? (press Enter)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-primary shrink-0" type="submit">
          <Plus size={16} /> <span className="hidden sm:inline">Add task</span>
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col, ci) => {
          const items = tasks.filter((t) => t.status === col.id);
          const isOver = over?.col === col.id && dragId !== null;
          return (
            <motion.section
              key={col.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.08 }}
              onDragOver={(e) => {
                e.preventDefault();
                if (over?.col !== col.id) setOver({ col: col.id, before: null });
              }}
              onDrop={() => onDrop(col.id)}
              className={cn('glass flex min-h-[300px] flex-col p-3 transition', isOver && 'border-violet-400/60 shadow-[0_0_40px_-8px_rgba(139,92,246,0.6)]')}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className={cn('h-2.5 w-2.5 rounded-full bg-gradient-to-r', col.accent)} />
                  {col.title}
                </h2>
                <span className="muted rounded-full bg-slate-900/5 px-2 py-0.5 text-xs dark:bg-white/5">{items.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <AnimatePresence initial={false}>
                  {items.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: dragId === t.id ? 0.4 : 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      {over?.before === t.id && dragId !== t.id && <div className="mb-2 h-1 rounded-full bg-gradient-to-r from-violet-500 to-blue-500" />}
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', t.id);
                          setDragId(t.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOver(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (over?.before !== t.id) setOver({ col: col.id, before: t.id });
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          onDrop(col.id);
                        }}
                        className="group flex cursor-grab items-start gap-2 rounded-xl border border-slate-900/5 bg-white/70 p-3 shadow-sm transition hover:border-violet-400/40 active:cursor-grabbing dark:border-white/10 dark:bg-white/[0.06]"
                      >
                        <GripVertical size={16} className="muted mt-0.5 shrink-0 opacity-50" />
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-medium', t.status === 'done' && 'muted line-through')}>{t.title}</p>
                          {t.completedAt && <p className="muted mt-1 text-[11px]">Done {new Date(t.completedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                        </div>
                        <div className="flex shrink-0 items-center opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                          {ci > 0 && (
                            <button className="icon-btn h-7 w-7" aria-label="Move left" onClick={() => move(t.id, COLUMNS[ci - 1].id, null)}>
                              <ChevronLeft size={14} />
                            </button>
                          )}
                          {ci < COLUMNS.length - 1 && (
                            <button className="icon-btn h-7 w-7" aria-label="Move right" onClick={() => move(t.id, COLUMNS[ci + 1].id, null)}>
                              <ChevronRight size={14} />
                            </button>
                          )}
                          {t.status !== 'done' && (
                            <button className="icon-btn h-7 w-7" aria-label="Toggle Today's Focus" onClick={() => toggleFocus(t.id)}>
                              <Star size={14} className={focusIds.includes(t.id) ? 'fill-amber-400 text-amber-400' : ''} />
                            </button>
                          )}
                          <button className="icon-btn h-7 w-7 hover:!text-rose-400" aria-label="Delete task" onClick={() => remove(t)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {items.length === 0 && <EmptyState emoji={col.id === 'done' ? '🏆' : col.id === 'doing' ? '⚡' : '📝'} hint={dragId ? 'Drop it here!' : undefined} />}
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
