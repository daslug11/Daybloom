import { Check, MoreHorizontal } from 'lucide-react';
import { addDays } from '../../lib/dates';
import type { Habit } from '../../lib/types';
import { cn } from '../../lib/utils';
import { ContributionGrid } from './ContributionGrid';

interface Props {
  habit: Habit;
  today: string;
  days: Set<string>;
  streak: number;
  goalLabel?: string;
  onToggle?: (day: string) => void;
  onEdit?: () => void;
  showGrid?: boolean;
}

/** One habit: today's check-off, streak, this week, and the 12-week grid. Presentational. */
export function HabitCard({ habit, today, days, streak, goalLabel, onToggle, onEdit, showGrid = true }: Props) {
  const doneToday = days.has(today);
  let week = 0;
  for (let i = 0; i < 7; i++) if (days.has(addDays(today, -i))) week++;
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onToggle?.(today)}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl transition',
            doneToday ? 'bg-violet-600 text-white ring-2 ring-violet-400' : 'bg-slate-900/5 hover:bg-violet-500/15 dark:bg-white/5',
          )}
          aria-label={doneToday ? `Undo ${habit.name} for today` : `Mark ${habit.name} done today`}
          aria-pressed={doneToday}
        >
          {doneToday ? <Check size={20} strokeWidth={3} /> : <span aria-hidden>{habit.emoji}</span>}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            {habit.emoji} {habit.name}
          </h3>
          <p className="muted text-xs">
            {doneToday ? 'Done today' : 'Not done yet today'} · {week}/7 this week{goalLabel ? ` · 🎯 ${goalLabel}` : ''}
          </p>
        </div>
        <div className="text-right" title="Streak: days in a row, ending today (or yesterday if today isn’t done yet)">
          <div className={cn('text-lg font-bold tabular-nums', streak > 0 ? 'text-orange-600 dark:text-orange-300' : 'faint')}>🔥 {streak}</div>
          <div className="faint text-[10px] uppercase tracking-wider">day streak</div>
        </div>
        {onEdit && (
          <button className="icon-btn h-8 w-8" onClick={onEdit} aria-label={`Edit ${habit.name}`}>
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
      {showGrid && (
        <div className="mt-3">
          <ContributionGrid today={today} name={habit.name} level={(k) => (days.has(k) ? 0.75 : 0)} label={(k) => (days.has(k) ? 'done' : 'not done')} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}
