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
  /** A plain row for lists inside a card (hairline dividers come from the list). */
  flat?: boolean;
  className?: string;
}

/** One task row. Presentational — the landing page renders it with sample data. */
export function TaskItem({ task, today, onToggle, onStar, onOpen, subtasks, goalLabel, hideDue, flat, className }: Props) {
  const overdue = !task.done && task.due_date && task.due_date < today;
  const starred = task.top_date === today;
  // Without an onOpen handler the title is plain text, not a button that does nothing.
  const Body = onOpen ? 'button' : 'div';
  return (
    <div
      className={cn(
        'group flex items-start gap-3',
        flat ? 'py-2.5' : 'rounded-control border border-line bg-surface px-3 py-2.5 transition-colors duration-fast hover:border-line-strong',
        className,
      )}
    >
      <button
        onClick={() => onToggle?.(task)}
        className={cn(
          'hit mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-[transform,color,background-color,border-color] duration-press ease-out motion-safe:active:scale-[0.9]',
          task.done ? 'border-transparent bg-accent text-accent-ink' : 'border-control hover:border-ink hover:bg-raised',
        )}
        aria-label={task.done ? `Mark “${task.title}” as not done` : `Complete “${task.title}”`}
      >
        {task.done && <Check size={12} strokeWidth={3} className="animate-check-pop" />}
      </button>
      <Body
        className="min-w-0 flex-1 text-left"
        {...(onOpen ? { type: 'button' as const, onClick: () => onOpen(task), 'aria-label': `Open task ${task.title}` } : {})}
      >
        <p className={cn('text-sm font-medium leading-snug', task.done && 'faint line-through')}>{task.title}</p>
        {!task.done && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {task.due_date && !hideDue && (
              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', overdue ? 'border-danger/30 bg-danger/10 text-danger' : 'border-line-strong bg-raised text-ink')}>
                {overdue ? 'Overdue · ' : ''}
                {formatDue(task.due_date, today)}
                {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ''}
              </span>
            )}
            <TaskChips tags={task.tags} priority={task.priority ?? undefined} duration={task.sched_date ? undefined : task.estimate_min ?? undefined} size={10} />
            {task.sched_date && task.sched_start != null && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink">
                <CalendarClock size={11} aria-hidden /> {formatDue(task.sched_date, today)} {formatMinutesShort(task.sched_start)}
              </span>
            )}
            {subtasks && subtasks.total > 0 && (
              <span className="faint inline-flex items-center gap-0.5 text-xs">
                <ChevronRight size={11} aria-hidden /> {subtasks.done}/{subtasks.total} steps
              </span>
            )}
            {goalLabel && <span className="faint text-xs">🎯 {goalLabel}</span>}
            {task.source_note_id && (
              <span className="faint inline-flex items-center gap-0.5 text-xs" title="Created from a Brain Dump note">
                <FileText size={11} aria-hidden /> from note
              </span>
            )}
          </div>
        )}
      </Body>
      {onStar && !task.done && (
        <button
          onClick={() => onStar(task)}
          className={cn('icon-btn h-8 w-8', starred ? '!text-warning' : 'opacity-60 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-visible:opacity-100')}
          aria-label={starred ? 'Remove from today’s top 3' : 'Add to today’s top 3'}
          aria-pressed={starred}
          title={starred ? 'In today’s top 3' : 'Make it one of today’s top 3'}
        >
          <Star size={16} className={starred ? 'fill-warning text-warning' : ''} />
        </button>
      )}
    </div>
  );
}

export { PRIORITY_STYLES };
