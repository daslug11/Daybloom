import { CALENDAR_TYPES } from '../../lib/calendars';
import type { CalendarType } from '../../lib/types';
import { cn } from '../../lib/utils';

// Provider badges are neutral: the emoji and the name identify the provider, colour isn't needed.


export function TypeBadge({ type, className }: { type: CalendarType; className?: string }) {
  const t = CALENDAR_TYPES[type];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line-strong bg-raised px-2 py-0.5 text-xs font-medium text-muted', className)}>
      {t.emoji} {t.label}
    </span>
  );
}
