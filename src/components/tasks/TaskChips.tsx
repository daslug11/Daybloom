import { CalendarDays, Clock, Flag, Hash, Hourglass } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDue, formatDuration, formatTime } from '../../lib/quickAdd';
import type { Priority } from '../../lib/types';
import { cn } from '../../lib/utils';

export const PRIORITY_STYLES: Record<Priority, { label: string; chip: string; block: string }> = {
  high: {
    label: 'High',
    chip: 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300',
    block: 'from-rose-500/90 to-fuchsia-600/90',
  },
  medium: {
    label: 'Medium',
    chip: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300',
    block: 'from-amber-500/90 to-orange-500/90',
  },
  low: {
    label: 'Low',
    chip: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    block: 'from-emerald-500/90 to-teal-500/90',
  },
};

function Chip({ icon, children, className }: { icon: ReactNode; children: ReactNode; className: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold', className)}>
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

/** Colored pills for a task's date / time / duration / tags / priority. */
export function TaskChips({ due, time, tags, priority, duration, className, size = 11 }: Props) {
  if (!due && !time && !tags?.length && !priority && !duration) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {due && (
        <Chip icon={<CalendarDays size={size} />} className="border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300">
          {formatDue(due)}
        </Chip>
      )}
      {time && (
        <Chip icon={<Clock size={size} />} className="border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
          {formatTime(time)}
        </Chip>
      )}
      {duration && (
        <Chip icon={<Hourglass size={size} />} className="border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300">
          {formatDuration(duration)}
        </Chip>
      )}
      {tags?.map((t) => (
        <Chip key={t} icon={<Hash size={size} />} className="border-pink-500/40 bg-pink-500/15 text-pink-700 dark:text-pink-300">
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
