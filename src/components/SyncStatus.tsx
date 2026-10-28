import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { useNow } from '../hooks/useNow';
import { timeAgo } from '../lib/sync';
import { cn } from '../lib/utils';

/** Compact "Synced 3m ago · 24 events" pill with a refresh button. */
export function SyncStatusPill({ className }: { className?: string }) {
  const { syncing, lastSync, events, errorCount, requestError, syncedCalendars, sync } = useCalendarSync();
  const { navigate } = useApp();
  useNow(30_000);

  if (!syncedCalendars.length) {
    return (
      <button onClick={() => navigate('calendars')} className={cn('chip-off', className)}>
        📡 Connect a calendar feed
      </button>
    );
  }

  let body;
  if (syncing) {
    body = (
      <>
        <Loader2 size={13} className="animate-spin text-violet-400" /> Syncing {syncedCalendars.length} calendar{syncedCalendars.length === 1 ? '' : 's'}…
      </>
    );
  } else if (requestError || errorCount) {
    body = (
      <button onClick={() => navigate('calendars')} className="flex items-center gap-1.5 text-rose-600 hover:underline dark:text-rose-300" title={requestError ?? undefined}>
        <AlertTriangle size={13} /> {requestError ? 'Sync server unreachable' : `${errorCount} calendar${errorCount === 1 ? '' : 's'} failed to sync`}
      </button>
    );
  } else {
    body = (
      <>
        <CheckCircle2 size={13} className="text-emerald-500" /> Synced {timeAgo(lastSync)} · {events.length} event{events.length === 1 ? '' : 's'}
      </>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-xs font-medium',
        requestError || errorCount
          ? 'border-rose-500/30 bg-rose-500/10'
          : 'border-slate-900/10 bg-white/50 dark:border-white/10 dark:bg-white/5',
        className,
      )}
    >
      {body}
      <button
        onClick={() => sync()}
        disabled={syncing}
        className="icon-btn h-6 w-6 rounded-full"
        aria-label="Sync calendars now"
        title="Sync now"
      >
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
