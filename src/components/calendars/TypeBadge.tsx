import { CALENDAR_TYPES } from '../../lib/calendars';
import type { CalendarType } from '../../lib/types';
import { cn } from '../../lib/utils';

const STYLES: Record<CalendarType, string> = {
  google: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  outlook: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  apple: 'bg-slate-500/15 text-slate-700 dark:text-slate-200 border-slate-500/30',
  notion: 'bg-stone-500/15 text-stone-700 dark:text-stone-200 border-stone-500/30',
  calendly: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  ics: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  other: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
};

export function TypeBadge({ type, className }: { type: CalendarType; className?: string }) {
  const t = CALENDAR_TYPES[type];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold', STYLES[type], className)}>
      {t.emoji} {t.label}
    </span>
  );
}
