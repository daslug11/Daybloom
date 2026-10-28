import { dateKey, parseKey } from '../lib/dates';
import { cn } from '../lib/utils';

const SHADES = [
  'bg-slate-900/[0.06] dark:bg-white/[0.06]',
  'bg-violet-300 dark:bg-violet-900',
  'bg-violet-400 dark:bg-violet-700',
  'bg-violet-500 dark:bg-violet-500',
  'bg-violet-600 shadow-[0_0_8px_rgba(139,92,246,0.8)] dark:bg-violet-400',
];

/** Builds 12 week columns (Sun→Sat), ending with the current week. */
export function buildWeeks(weeks = 12) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      return { key: dateKey(date), future: date > today };
    }),
  );
}

interface Props {
  /** 0–1 intensity per date key. */
  level: (key: string) => number;
  onToggle?: (key: string) => void;
  label: (key: string) => string;
  cell?: string;
}

export function ContributionGrid({ level, onToggle, label, cell = 'h-3.5 w-3.5 sm:h-4 sm:w-4' }: Props) {
  const weeks = buildWeeks();
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map(({ key, future }) => {
            const l = level(key);
            const shade = l <= 0 ? 0 : Math.min(4, Math.ceil(l * 4));
            const text = `${parseKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${label(key)}`;
            return (
              <button
                key={key}
                type="button"
                disabled={future || !onToggle}
                onClick={() => onToggle?.(key)}
                title={future ? undefined : text}
                aria-label={future ? undefined : text}
                className={cn(
                  'rounded-[4px] transition',
                  cell,
                  future ? 'invisible' : SHADES[shade],
                  onToggle && !future && 'hover:scale-125 hover:ring-1 hover:ring-violet-300',
                  key === dateKey() && 'ring-1 ring-pink-400',
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function GridLegend() {
  return (
    <div className="muted flex items-center gap-1 text-[11px]">
      Less
      {SHADES.map((s, i) => (
        <span key={i} className={cn('h-3 w-3 rounded-[3px]', s)} />
      ))}
      More
    </div>
  );
}
