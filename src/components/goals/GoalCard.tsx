import { Check, Minus, Pencil, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Goal, Milestone } from '../../lib/types';
import { cn } from '../../lib/utils';

/** Whole percent, rounded down, so it only says 100% once the target is actually reached. */
export function goalPercent(g: Pick<Goal, 'current' | 'target'>) {
  const target = Number(g.target);
  if (!(target > 0)) return 0;
  return Math.max(0, Math.min(100, Math.floor((Number(g.current) / target) * 100)));
}

export function goalStep(target: number) {
  return target >= 1000 ? 50 : target >= 100 ? 5 : 1;
}

interface Props {
  goal: Goal;
  milestones?: Milestone[];
  openTasks?: number;
  habits?: number;
  onBump?: (delta: number) => void;
  onEdit?: () => void;
  onToggleMilestone?: (m: Milestone) => void;
  actions?: ReactNode;
}

/** A goal with its progress bar, milestones and links. Presentational. */
export function GoalCard({ goal, milestones = [], openTasks, habits, onBump, onEdit, onToggleMilestone, actions }: Props) {
  const pct = goalPercent(goal);
  const step = goalStep(Number(goal.target));
  const reached = Number(goal.current) >= Number(goal.target);
  return (
    <article className="card p-5" aria-label={goal.title}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink/[0.06] text-2xl" aria-hidden>
          {goal.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{goal.title}</h3>
          <p className="muted text-sm">
            {Number(goal.current).toLocaleString()} of {Number(goal.target).toLocaleString()} {goal.unit}
            {goal.due_date && ` · by ${new Date(goal.due_date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
          </p>
        </div>
        {onEdit && (
          <button className="icon-btn h-8 w-8" onClick={onEdit} aria-label={`Edit goal ${goal.title}`}>
            <Pencil size={15} />
          </button>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct}% — ${Number(goal.current).toLocaleString()} of ${Number(goal.target).toLocaleString()} ${goal.unit}`.trim()}
          aria-label={`${goal.title} progress`}
        >
          <div className={cn('h-full rounded-full transition-[width] duration-500', reached ? 'bg-success' : 'bg-ink')} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums" aria-hidden>
          {pct}%
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="faint text-xs">
          {reached ? 'Target reached 🏆' : `${(Number(goal.target) - Number(goal.current)).toLocaleString()} ${goal.unit} to go`}
          {openTasks ? ` · ${openTasks} open task${openTasks === 1 ? '' : 's'}` : ''}
          {habits ? ` · ${habits} habit${habits === 1 ? '' : 's'}` : ''}
        </span>
        {onBump && (
          <div className="ml-auto flex gap-1">
            <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => onBump(-step)} aria-label={`Decrease by ${step}`} disabled={Number(goal.current) <= 0}>
              <Minus size={14} />
            </button>
            <button className="btn-primary !px-2.5 !py-1.5" onClick={() => onBump(step)} aria-label={`Increase by ${step}`}>
              <Plus size={14} /> {step}
            </button>
          </div>
        )}
      </div>
      {milestones.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-line pt-3" aria-label="Milestones">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <button
                onClick={() => onToggleMilestone?.(m)}
                disabled={!onToggleMilestone}
                className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', m.done ? 'border-ink/40 bg-accent text-accent-ink' : 'border-control')}
                aria-label={m.done ? `Mark milestone “${m.title}” not done` : `Complete milestone “${m.title}”`}
              >
                {m.done && <Check size={10} strokeWidth={3} />}
              </button>
              <span className={cn(m.done && 'faint line-through')}>{m.title}</span>
            </li>
          ))}
        </ul>
      )}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
