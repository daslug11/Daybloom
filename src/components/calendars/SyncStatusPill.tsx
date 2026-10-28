import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useNow } from '../../hooks/useNow';
import { timeAgo } from '../../lib/dates';
import { cn } from '../../lib/utils';

/** "Synced 3m ago · 24 events" with a refresh button; links to Calendars when there's a problem. */
export function SyncStatusPill({ className }: { className?: string }) {
  const { syncing, lastSync, events, errorCount, requestError, syncedCalendars, sync } = useCalendarSync();
  useNow(30_000);
  if (!syncedCalendars.length) {
    return (
      <Link to="/app/calendars" className={cn('chip-off', className)}>
        📡 Sync a calendar feed
      </Link>
    );
  }
  const bad = !!requestError || errorCount > 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-xs font-medium',
        bad ? 'border-rose-500/30 bg-rose-500/10' : 'border-slate-900/10 bg-white/60 dark:border-white/10 dark:bg-white/5',
        className,
      )}
    >
      {syncing ? (
        <>
          <Loader2 size={13} className="animate-spin text-violet-500" aria-hidden /> Syncing {syncedCalendars.length} calendar{syncedCalendars.length === 1 ? '' : 's'}…
        </>
      ) : bad ? (
        <Link to="/app/calendars" className="flex items-center gap-1.5 text-rose-700 hover:underline dark:text-rose-300">
          <AlertTriangle size={13} aria-hidden /> {requestError ? 'Calendar sync failed' : `${errorCount} calendar${errorCount === 1 ? '' : 's'} failed to sync`}
        </Link>
      ) : (
        <>
          <CheckCircle2 size={13} className="text-emerald-600" aria-hidden /> Synced {lastSync ? timeAgo(lastSync) : ''} · {events.length} event{events.length === 1 ? '' : 's'}
        </>
      )}
      <button onClick={() => sync()} disabled={syncing} className="icon-btn h-6 w-6 rounded-full" aria-label="Sync calendars now" title="Sync now">
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
