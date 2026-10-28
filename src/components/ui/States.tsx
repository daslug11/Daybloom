import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Explains what a section is for and the first thing to do — never just "nothing here". */
export function EmptyState({ emoji, title, children, action, className }: { emoji: string; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      {children && <div className="muted mt-1 max-w-md text-sm">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center px-4 py-8 text-center', className)}>
      <AlertTriangle className="text-rose-500" aria-hidden />
      <p className="mt-2 text-sm font-medium">{message ?? "This didn't load."}</p>
      {onRetry && (
        <button className="btn-ghost mt-3" onClick={onRetry}>
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  );
}

export function Spinner({ label = 'Loading', size = 18, className }: { label?: string; size?: number; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <Loader2 size={size} className="animate-spin text-violet-500" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-slate-900/[0.06] dark:bg-white/[0.06]', className)} />;
}

export function LoadingList({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

/** Small helper for query results: loading → skeleton, error → retry. */
export function QueryState({ isLoading, error, onRetry, rows }: { isLoading: boolean; error: unknown; onRetry?: () => void; rows?: number }) {
  if (isLoading) return <LoadingList rows={rows} />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={onRetry} />;
  return null;
}
