import { CalendarClock, CornerDownLeft, ListPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAddTasks, type NewTask } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { blockRange, formatDue, parseQuickAdd, plannerBlock, taskFromParsed } from '../../lib/quickAdd';
import type { Task } from '../../lib/types';
import { cn } from '../../lib/utils';
import { AiButton } from '../ui/Ai';
import { TaskChips } from './TaskChips';

interface Props {
  extra?: Partial<NewTask>;
  placeholder?: string;
  className?: string;
  /** Called with the saved task, e.g. to scroll to and highlight its row. Without it, a toast confirms the add. */
  onAdded?: (task: Task) => void;
  /** Sits inside another card: an input well, not a card. */
  inset?: boolean;
}

/** Inline natural-language task entry with a live preview of what was understood — including any Planner time it will block. */
export function QuickAddTask({ extra, placeholder, className, onAdded, inset }: Props) {
  const [text, setText] = useState('');
  const [ai, setAi] = useState<{ title: string; due_date: string | null; due_time: string | null; priority: 'high' | 'medium' | 'low' | null; tags: string[]; estimate_min: number | null } | null>(null);
  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const add = useAddTasks();
  const parseAi = useAi<NonNullable<typeof ai>>('parse_task');
  const toast = useToast();
  const { today } = useToday();
  const shown = ai
    ? { title: ai.title, due: ai.due_date ?? undefined, time: ai.due_time ?? undefined, priority: ai.priority ?? undefined, tags: ai.tags, duration: ai.estimate_min ?? undefined }
    : parsed;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const task = taskFromParsed(shown, text, extra);
    const block = plannerBlock(shown);
    add.mutate([task], { onSuccess: (rows) => rows[0] && onAdded?.(rows[0]) });
    // Blocking Planner time is a side effect worth spelling out; a plain add is confirmed by its row (or a toast here).
    if (block) toast(`Added “${task.title}” and blocked ${formatDue(block.date, today)} ${blockRange(block)} in the Planner`);
    else if (!onAdded) toast(`Added “${task.title}”`);
    setText('');
    setAi(null);
  };
  const block = plannerBlock(shown);

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
          {block && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-xs font-medium text-ink">
              <CalendarClock size={11} aria-hidden /> → Planner {formatDue(block.date, today)} {blockRange(block)}
            </span>
          )}
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
