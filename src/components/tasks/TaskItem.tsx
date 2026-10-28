import { CalendarClock, Check, ChevronRight, FileText, Star } from 'lucide-react';
import type { Task } from '../../lib/types';
import { formatMinutesShort } from '../../lib/planner';
import { formatDue } from '../../lib/quickAdd';
import { cn } from '../../lib/utils';
import { PRIORITY_STYLES, TaskChips } from './TaskChips';

interface Props {
  task: Task;
  today: string;
  onToggle?: (task: Task) => void;
  onStar?: (task: Task) => void;
  onOpen?: (task: Task) => void;
  subtasks?: { done: number; total: number };
  goalLabel?: string;
  /** Hide due chip (e.g. inside the "Today" section). */
  hideDue?: boolean;
  className?: string;
}

/** One task row. Presentational — the landing page renders it with sample data. */
export function TaskItem({ task, today, onToggle, onStar, onOpen, subtasks, goalLabel, hideDue, className }: Props) {
  const overdue = !task.done && task.due_date && task.due_date < today;
  const starred = task.top_date === today;
  return (
    <div className={cn('group flex items-start gap-3 rounded-xl border border-slate-900/5 bg-white/70 px-3 py-2.5 transition hover:border-violet-400/40 dark:border-white/[0.06] dark:bg-white/[0.04]', className)}>
      <button
        onClick={() => onToggle?.(task)}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition',
          task.done ? 'border-transparent bg-violet-600 text-white' : task.priority ? cn('hover:bg-violet-500/10', priorityRing[task.priority]) : 'border-slate-400 hover:bg-violet-500/10 dark:border-slate-500',
        )}
        aria-label={task.done ? `Mark “${task.title}” as not done` : `Complete “${task.title}”`}
      >
        {task.done && <Check size={12} strokeWidth={3} />}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen?.(task)} aria-label={`Open task ${task.title}`}>
        <p className={cn('text-sm font-medium leading-snug', task.done && 'faint line-through')}>{task.title}</p>
        {!task.done && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {task.due_date && !hideDue && (
              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', overdue ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300')}>
                {overdue ? 'Overdue · ' : ''}
                {formatDue(task.due_date, today)}
                {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ''}
              </span>
            )}
            <TaskChips tags={task.tags} priority={task.priority ?? undefined} duration={task.sched_date ? undefined : task.estimate_min ?? undefined} size={10} />
            {task.sched_date && task.sched_start != null && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
                <CalendarClock size={11} aria-hidden /> {formatDue(task.sched_date, today)} {formatMinutesShort(task.sched_start)}
              </span>
            )}
            {subtasks && subtasks.total > 0 && (
              <span className="faint inline-flex items-center gap-0.5 text-[11px]">
                <ChevronRight size={11} aria-hidden /> {subtasks.done}/{subtasks.total} steps
              </span>
            )}
            {goalLabel && <span className="faint text-[11px]">🎯 {goalLabel}</span>}
            {task.source_note_id && (
              <span className="faint inline-flex items-center gap-0.5 text-[11px]" title="Created from a Brain Dump note">
                <FileText size={11} aria-hidden /> from note
              </span>
            )}
          </div>
        )}
      </button>
      {onStar && !task.done && (
        <button
          onClick={() => onStar(task)}
          className={cn('icon-btn h-8 w-8', starred ? '!text-amber-500' : 'opacity-60 group-hover:opacity-100 md:opacity-0 md:focus:opacity-100')}
          aria-label={starred ? 'Remove from today’s top 3' : 'Add to today’s top 3'}
          aria-pressed={starred}
          title={starred ? 'In today’s top 3' : 'Make it one of today’s top 3'}
        >
          <Star size={16} className={starred ? 'fill-amber-400' : ''} />
        </button>
      )}
    </div>
  );
}

const priorityRing: Record<string, string> = {
  high: 'border-rose-500',
  medium: 'border-amber-500',
  low: 'border-emerald-500',
};

export { PRIORITY_STYLES };
