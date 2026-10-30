import { CalendarDays, Clock, Flag, Hash, Hourglass } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDue, formatDuration, formatTime } from '../../lib/quickAdd';
import type { Priority } from '../../lib/types';
import { cn } from '../../lib/utils';

export const PRIORITY_STYLES: Record<Priority, { label: string; chip: string; dot: string }> = {
  high: {
    label: 'High',
    chip: 'border-danger/30 bg-danger/10 text-danger',
    dot: 'bg-danger',
  },
  medium: {
    label: 'Medium',
    chip: 'border-warning/40 bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  low: {
    label: 'Low',
    chip: 'border-success/40 bg-success/10 text-success',
    dot: 'bg-success',
  },
};

function Chip({ icon, children, className }: { icon: ReactNode; children: ReactNode; className: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold', className)}>
      {icon}
      {children}
    </span>
  );
}

interface Props {
  due?: string;
  time?: string;
  tags?: string[];
  priority?: Priority;
  duration?: number;
  className?: string;
  size?: number;
}

/** Pills for a task's date / time / duration / tags / priority. Only priority is coloured: colour means something. */
export function TaskChips({ due, time, tags, priority, duration, className, size = 11 }: Props) {
  if (!due && !time && !tags?.length && !priority && !duration) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {due && (
        <Chip icon={<CalendarDays size={size} />} className="border-line-strong bg-raised text-ink">
          {formatDue(due)}
        </Chip>
      )}
      {time && (
        <Chip icon={<Clock size={size} />} className="border-line-strong bg-raised text-ink">
          {formatTime(time)}
        </Chip>
      )}
      {duration && (
        <Chip icon={<Hourglass size={size} />} className="border-line-strong bg-raised text-ink">
          {formatDuration(duration)}
        </Chip>
      )}
      {tags?.map((t) => (
        <Chip key={t} icon={<Hash size={size} />} className="border-line bg-surface text-muted">
          {t}
        </Chip>
      ))}
      {priority && (
        <Chip icon={<Flag size={size} />} className={PRIORITY_STYLES[priority].chip}>
          {PRIORITY_STYLES[priority].label}
        </Chip>
      )}
    </div>
  );
}
