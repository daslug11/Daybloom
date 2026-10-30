import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, parseKey } from '../../lib/dates';
import { cn } from '../../lib/utils';

// Ink density: none → done. The "done" square is the strongest ink in both themes.
const SHADES = ['bg-raised', 'bg-ink/25', 'bg-ink/45', 'bg-ink/70', 'bg-ink'];
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
/** 14px squares; 24px on touch screens so a finger can hit one. */
const CELL = 'h-3.5 w-3.5 [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6';

/** 12 week columns (Mon→Sun), ending with the current week. */
export function buildWeeks(today: string, weeks = 12) {
  const dow = (parseKey(today).getDay() + 6) % 7;
  const start = addDays(today, -dow - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const key = addDays(start, w * 7 + d);
      return { key, future: key > today };
    }),
  );
}

const longDate = (key: string) => parseKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

interface Props {
  today: string;
  /** First day that counts (the habit's start). Earlier days are shown as "before you started" and can't be changed. */
  start?: string;
  /** 0–1 intensity per date key. */
  level: (key: string) => number;
  label: (key: string) => string;
  onToggle?: (key: string) => void;
  name: string;
}

/**
 * GitHub-style history grid: rows are weekdays, columns are weeks. One Tab stop; arrow keys
 * move a day (↑↓) or a week (←→), Home/End jump to the first counted day / today, and
 * Enter or Space toggles the focused day.
 */
export function ContributionGrid({ today, start, level, onToggle, label, name }: Props) {
  const weeks = buildWeeks(today);
  const first = weeks[0][0].key;
  const editableFrom = start && start > first ? start : first;
  const [active, setActive] = useState(today);
  const grid = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Show the latest weeks first when the grid is wider than the card (phones).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // Keep the roving stop on a real, changeable day (e.g. after midnight).
  const current = active < editableFrom || active > today ? today : active;

  const move = (to: string) => {
    if (to < editableFrom || to > today) return;
    setActive(to);
    grid.current?.querySelector<HTMLElement>(`[data-day="${to}"]`)?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    if (e.key in step) move(addDays(current, step[e.key]));
    else if (e.key === 'Home') move(editableFrom);
    else if (e.key === 'End') move(today);
    else return;
    e.preventDefault();
  };

  // Month labels over the week where a month starts.
  const months = weeks.map((w, i) => {
    const m = parseKey(w[0].key).getMonth();
    return i === 0 || m !== parseKey(weeks[i - 1][0].key).getMonth() ? parseKey(w[0].key).toLocaleDateString(undefined, { month: 'short' }) : '';
  });

  return (
    <div ref={scroller} className="-m-1 overflow-x-auto p-1">
      <div className="inline-flex flex-col gap-[3px]">
        <div className="flex gap-[3px] pl-8 text-xs text-muted" aria-hidden>
          {months.map((m, i) => (
            <span key={i} className={cn('overflow-visible whitespace-nowrap', CELL, '!h-auto')}>
              {m}
            </span>
          ))}
        </div>
        <div ref={grid} role="grid" aria-label={`${name}: last 12 weeks`} aria-readonly={!onToggle} className="flex flex-col gap-[3px]" onKeyDown={onToggle ? onKey : undefined}>
          {WEEKDAYS.map((wd, d) => (
            <div key={d} role="row" className="flex items-center gap-[3px]">
              <span className="w-8 shrink-0 text-xs leading-none text-muted" aria-hidden>
                {wd}
              </span>
              {weeks.map((week) => {
                const { key, future } = week[d];
                if (future) return <span key={key} role="gridcell" aria-hidden className={cn('rounded-[3px]', CELL)} />;
                if (start && key < start) {
                  return (
                    <span
                      key={key}
                      role="gridcell"
                      aria-label={`${longDate(key)}: before you started`}
                      title={`${longDate(key)}: before you started`}
                      className={cn('rounded-[3px] border border-dashed border-line-strong', CELL)}
                    />
                  );
                }
                const l = level(key);
                const shade = l <= 0 ? 0 : Math.min(4, Math.ceil(l * 4));
                const text = `${longDate(key)}: ${label(key)}`;
                const cls = cn('block rounded-[3px] transition-colors duration-fast', CELL, SHADES[shade], key === today && 'outline outline-1 outline-offset-1 outline-ink/60');
                return (
                  <span key={key} role="gridcell" className="flex">
                    {onToggle ? (
                      <button
                        type="button"
                        data-day={key}
                        tabIndex={key === current ? 0 : -1}
                        onClick={() => {
                          setActive(key);
                          onToggle(key);
                        }}
                        onFocus={() => setActive(key)}
                        title={text}
                        aria-label={text}
                        aria-pressed={l > 0}
                        className={cn(cls, 'hover:ring-1 hover:ring-ink/40')}
                      />
                    ) : (
                      <span title={text} aria-label={text} className={cls} />
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
