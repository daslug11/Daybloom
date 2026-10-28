import { addDays, parseKey } from '../../lib/dates';
import { cn } from '../../lib/utils';

const SHADES = [
  'bg-slate-900/[0.07] dark:bg-white/[0.07]',
  'bg-violet-300 dark:bg-violet-900',
  'bg-violet-400 dark:bg-violet-700',
  'bg-violet-500 dark:bg-violet-500',
  'bg-violet-700 dark:bg-violet-300',
];

/** 12 week columns (Mon→Sun), ending with the current week. */
export function buildWeeks(today: string, weeks = 12) {
  const dow = (parseKey(today).getDay() + 6) % 7;
  const start = addDays(today, -dow - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const key = addDays(start, w * 7 + d);
    return { key, future: key > today };
  }));
}

interface Props {
  today: string;
  /** 0–1 intensity per date key. */
  level: (key: string) => number;
  label: (key: string) => string;
  onToggle?: (key: string) => void;
  cell?: string;
  name: string;
}

/** GitHub-style history grid. Click a past day to toggle it. */
export function ContributionGrid({ today, level, onToggle, label, cell = 'h-3.5 w-3.5', name }: Props) {
  const weeks = buildWeeks(today);
  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1" role="group" aria-label={`${name}: last 12 weeks`}>
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map(({ key, future }) => {
            const l = level(key);
            const shade = l <= 0 ? 0 : Math.min(4, Math.ceil(l * 4));
            const text = `${parseKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${label(key)}`;
            return future ? (
              <span key={key} className={cn('rounded-[3px] opacity-0', cell)} aria-hidden />
            ) : (
              <button
                key={key}
                type="button"
                disabled={!onToggle}
                onClick={() => onToggle?.(key)}
                title={text}
                aria-label={text}
                aria-pressed={l > 0}
                className={cn('rounded-[3px] transition', cell, SHADES[shade], onToggle && 'hover:ring-1 hover:ring-violet-400', key === today && 'ring-1 ring-violet-500')}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
