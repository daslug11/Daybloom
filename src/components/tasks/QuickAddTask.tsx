import { CornerDownLeft, ListPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAddTasks, type NewTask } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import { useToast } from '../../hooks/useToast';
import { parseQuickAdd, taskFromParsed } from '../../lib/quickAdd';
import { cn } from '../../lib/utils';
import { AiButton } from '../ui/Ai';
import { TaskChips } from './TaskChips';

/** Inline natural-language task entry with a live preview of what was understood. */
export function QuickAddTask({ extra, placeholder, className, onAdded, inset }: { extra?: Partial<NewTask>; placeholder?: string; className?: string; onAdded?: () => void; /** Sits inside another card: an input well, not a card. */ inset?: boolean }) {
  const [text, setText] = useState('');
  const [ai, setAi] = useState<{ title: string; due_date: string | null; due_time: string | null; priority: 'high' | 'medium' | 'low' | null; tags: string[]; estimate_min: number | null } | null>(null);
  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const add = useAddTasks();
  const parseAi = useAi<NonNullable<typeof ai>>('parse_task');
  const toast = useToast();
  const shown = ai
    ? { title: ai.title, due: ai.due_date ?? undefined, time: ai.due_time ?? undefined, priority: ai.priority ?? undefined, tags: ai.tags, duration: ai.estimate_min ?? undefined }
    : parsed;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const task = taskFromParsed(shown, text, extra);
    add.mutate([task]);
    if (task.sched_date) toast(`Added “${task.title}” and blocked time in the Planner`);
    setText('');
    setAi(null);
    onAdded?.();
  };

  return (
    <form onSubmit={submit} className={cn(inset ? 'rounded-control border border-line bg-raised p-1.5' : 'card p-2', className)} data-tour="quick-add">
      <div className="flex items-center gap-2 px-1">
        <ListPlus size={18} className="shrink-0 text-muted" aria-hidden />
        <label htmlFor="quick-add-task" className="sr-only">
          Add a task
        </label>
        <input
          id="quick-add-task"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAi(null);
          }}
          maxLength={300}
          placeholder={placeholder ?? 'Add a task… try “report fri 3pm for 1h #work !high”'}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-faint"
        />
        <button type="submit" className="btn-primary !px-3 !py-1.5" disabled={!text.trim()}>
          <CornerDownLeft size={14} aria-hidden /> Add
        </button>
      </div>
      {text.trim() && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-2 pb-1 pt-2" aria-live="polite">
          <span className="faint text-xs font-medium">{ai ? '✨ AI read it as' : 'Understood'}</span>
          <span className="text-sm font-medium">{shown.title || '…'}</span>
          <TaskChips due={shown.due} time={shown.time} tags={shown.tags} priority={shown.priority} duration={shown.duration} />
          {!ai && (
            <AiButton size="sm" className="ml-auto" loading={parseAi.isPending} onClick={() => parseAi.mutate({ text }, { onSuccess: (r) => setAi(r.result) })} hint="Let AI read a tricky sentence">
              Read with AI
            </AiButton>
          )}
        </div>
      )}
    </form>
  );
}
