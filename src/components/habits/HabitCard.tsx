import { Check, MoreHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import type { Habit } from '../../lib/types';
import { STREAK_RULE, habitWeekLabel } from '../../lib/stats';
import { cn } from '../../lib/utils';
import { ContributionGrid } from './ContributionGrid';

interface Props {
  habit: Habit;
  today: string;
  /** First day the habit counts from (created, or an earlier logged day). */
  start: string;
  days: Set<string>;
  streak: number;
  /** The streak reaches the oldest history we load, so the real number may be higher. */
  streakCapped?: boolean;
  goalLabel?: string;
  onToggle?: (day: string) => void;
  onEdit?: () => void;
  showGrid?: boolean;
}

/** One habit: today's check-off, streak, the last 7 days, and the 12-week grid. Presentational. */
export function HabitCard({ habit, today, start, days, streak, streakCapped, goalLabel, onToggle, onEdit, showGrid = true }: Props) {
  const doneToday = days.has(today);
  const [explain, setExplain] = useState(false);
  const ruleId = useId();
  const streakText = `${streak}${streakCapped ? '+' : ''}`;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onToggle?.(today)}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl transition-colors duration-fast',
            doneToday ? 'bg-accent text-accent-ink ring-2 ring-ink/40' : 'bg-raised hover:bg-raised',
          )}
          aria-label={doneToday ? `Undo ${habit.name} for today` : `Mark ${habit.name} done today`}
          aria-pressed={doneToday}
        >
          {doneToday ? <Check size={20} strokeWidth={3} /> : <span aria-hidden>{habit.emoji}</span>}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{habit.name}</h3>
          <p className="muted text-xs">
            {doneToday ? 'Done today' : 'Not done yet today'} · {habitWeekLabel(start, days, today)}
            {goalLabel ? ` · 🎯 ${goalLabel}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="-my-1 rounded-control px-1.5 py-1 text-right hover:bg-raised"
          aria-expanded={explain}
          aria-controls={ruleId}
          aria-label={`${streakText} day streak. How is this counted?`}
          onClick={() => setExplain((v) => !v)}
        >
          <span className={cn('block text-lg font-bold tabular-nums', streak > 0 ? 'text-ink' : 'text-muted')}>
            <span aria-hidden>🔥</span> {streakText}
          </span>
          <span className="muted block text-xs">day streak</span>
        </button>
        {onEdit && (
          <button className="icon-btn h-8 w-8" onClick={onEdit} aria-label={`Edit ${habit.name}`}>
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
      <p id={ruleId} hidden={!explain} className="muted mt-2 text-xs">
        Streak: {STREAK_RULE}
        {streakCapped ? ' We only look back about 10 years, so yours may be longer.' : ''}
      </p>
      {showGrid && (
        <div className="mt-3">
          <ContributionGrid today={today} start={start} name={habit.name} level={(k) => (days.has(k) ? 0.75 : 0)} label={(k) => (days.has(k) ? 'done' : 'not done')} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}
