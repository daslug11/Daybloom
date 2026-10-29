import { cn } from '../../lib/utils';

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-pink-500 text-lg shadow-sm" aria-hidden>
        🌸
      </span>
      {!compact && <span className="gradient-text text-lg font-extrabold">Daybloom</span>}
      {compact && <span className="sr-only">Daybloom</span>}
    </span>
  );
}
