import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Star, X } from 'lucide-react';
import { useState } from 'react';
import { useFocusIds, useTasks } from '../hooks/useData';
import { celebrate, originFromEvent } from '../lib/confetti';
import { cn } from '../lib/utils';
import { Card, CardTitle } from './Card';

const MAX = 3;

export function TodaysFocus({ delay = 0, className }: { delay?: number; className?: string }) {
  const [tasks, setTasks] = useTasks();
  const [focusIds, setFocusIds] = useFocusIds();
  const [picking, setPicking] = useState(false);

  const focus = focusIds.map((id) => tasks.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
  const candidates = tasks.filter((t) => t.status !== 'done' && !focusIds.includes(t.id));

  const toggle = (id: string, e: React.MouseEvent) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const done = task.status !== 'done';
    if (done) celebrate(originFromEvent(e));
    setTasks((all) =>
      all.map((t) =>
        t.id === id
          ? { ...t, status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : undefined }
          : t,
      ),
    );
  };

  return (
    <Card delay={delay} className={className}>
      <CardTitle
        icon={<Star size={16} className="text-amber-400" />}
        action={
          focus.length < MAX && candidates.length > 0 ? (
            <button className="chip-off" onClick={() => setPicking((p) => !p)}>
              {picking ? <X size={12} /> : <Plus size={12} />} {picking ? 'Close' : 'Pick'}
            </button>
          ) : null
        }
      >
        Today's Focus · top {MAX}
      </CardTitle>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {focus.map((t) => {
            const done = t.status === 'done';
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="group flex items-center gap-3 rounded-xl border border-slate-900/5 bg-white/40 px-3 py-2.5 dark:border-white/5 dark:bg-white/[0.03]"
              >
                <button
                  onClick={(e) => toggle(t.id, e)}
                  aria-label={done ? 'Mark as not done' : 'Mark as done'}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition',
                    done ? 'border-transparent bg-gradient-to-br from-violet-500 to-blue-500 text-white' : 'border-violet-400/60 hover:bg-violet-500/10',
                  )}
                >
                  {done && <Check size={14} strokeWidth={3} />}
                </button>
                <span className={cn('flex-1 text-sm', done && 'muted line-through')}>{t.title}</span>
                <button
                  className="opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  onClick={() => setFocusIds((ids) => ids.filter((x) => x !== t.id))}
                  aria-label="Remove from focus"
                >
                  <X size={14} className="muted" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {focus.length === 0 && !picking && (
          <div className="py-4 text-center">
            <div className="text-3xl">🎯</div>
            <p className="mt-1 text-sm font-medium">Nothing here yet — let's change that! 🚀</p>
            <p className="muted text-xs">Pick up to 3 tasks that would make today a win.</p>
          </div>
        )}

        {picking && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-dashed border-violet-400/30 p-2">
            {candidates.length === 0 && <p className="muted p-2 text-xs">No open tasks to pick. Add some on the Tasks page!</p>}
            {candidates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setFocusIds((ids) => [...ids, t.id].slice(-MAX));
                  if (focus.length + 1 >= MAX) setPicking(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-violet-500/10"
              >
                <Plus size={14} className="text-violet-400" /> {t.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
