import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FEED_REFRESH_MS, useCalendarSync } from '../../hooks/useCalendarSync';
import { useNow } from '../../hooks/useNow';
import { useToast } from '../../hooks/useToast';
import { timeAgo } from '../../lib/dates';
import { cn } from '../../lib/utils';

/**
 * "Checked 3m ago · 24 events" with a check-again button; links to Calendars when there's a problem.
 * The time is when the feeds were really fetched: the server reuses a feed for up to 10 minutes,
 * so checking again inside that window says so instead of claiming "just now".
 */
export function SyncStatusPill({ className, live = true }: { className?: string; /** false where the page has its own live region for sync errors (Calendars). */ live?: boolean }) {
  const { syncing, lastSync, events, errorCount, requestError, syncedCalendars, sync } = useCalendarSync();
  const toast = useToast();
  useNow(30_000);
  const checkAgain = async () => {
    const r = await sync();
    if (!r.ok || r.fresh) return;
    const left = r.lastSync ? Math.max(1, Math.ceil((Date.parse(r.lastSync) + FEED_REFRESH_MS - Date.now()) / 60_000)) : 10;
    toast(`No newer copy yet. Calendar feeds are fetched at most every 10 minutes; the next fetch is in about ${left} min.`);
  };
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
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-xs font-medium',
        bad ? 'border-danger/30 bg-danger/10' : 'border-line bg-surface',
        className,
      )}
    >
      {syncing ? (
        <>
          <Loader2 size={13} className="animate-spin text-ink" aria-hidden /> Checking {syncedCalendars.length} calendar{syncedCalendars.length === 1 ? '' : 's'}…
        </>
      ) : bad ? (
        <Link to="/app/calendars" className="flex items-center gap-1.5 text-danger hover:underline">
          <AlertTriangle size={13} aria-hidden /> {requestError ? 'Calendar sync failed' : `${errorCount} calendar${errorCount === 1 ? '' : 's'} failed to sync`}
        </Link>
      ) : (
        <>
          <CheckCircle2 size={13} className="text-success" aria-hidden /> Checked {lastSync ? timeAgo(lastSync) : ''} · {events.length} event{events.length === 1 ? '' : 's'}
        </>
      )}
      <button
        onClick={() => void checkAgain()}
        disabled={syncing}
        className="icon-btn relative h-6 w-6 rounded-full before:absolute before:-inset-2.5 before:content-['']"
        aria-label="Check calendars again"
        title="Check again (feeds are fetched at most every 10 minutes)"
      >
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
