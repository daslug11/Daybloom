import { cn } from '../../lib/utils';

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-line bg-raised text-lg shadow-card" aria-hidden>
        🌸
      </span>
      {!compact && <span className="text-lg font-semibold tracking-[-0.02em] text-ink">Daybloom</span>}
      {compact && <span className="sr-only">Daybloom</span>}
    </span>
  );
}
