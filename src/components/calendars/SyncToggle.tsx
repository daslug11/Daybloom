import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { FeedStatus } from '../../hooks/useCalendarSync';
import { timeAgo } from '../../lib/dates';
import { Switch } from '../ui/Switch';

/** Per-calendar sync switch + its live status. */
export function SyncRow({ enabled, status, onToggle }: { enabled: boolean; status?: FeedStatus; onToggle: (v: boolean) => void }) {
  return (
    <div className="px-4 pb-3 pl-5">
      <div className="flex items-center gap-2 text-xs">
        <Switch checked={enabled} onChange={onToggle} label="Sync events into the Planner" />
        <span className="font-medium">Sync</span>
        {enabled && (
          <span className="muted ml-auto flex min-w-0 items-center gap-1 truncate">
            {!status || status.state === 'loading' ? (
              <>
                <Loader2 size={12} className="animate-spin text-ink" /> Syncing…
              </>
            ) : status.state === 'ok' ? (
              <>
                <CheckCircle2 size={12} className="shrink-0 text-success" /> {status.count} event{status.count === 1 ? '' : 's'}{status.fetchedAt ? ` · ${timeAgo(status.fetchedAt)}` : ''}
              </>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-danger">
                <AlertTriangle size={12} /> Sync failed
              </span>
            )}
          </span>
        )}
        {!enabled && <span className="muted ml-auto">Off</span>}
      </div>
      {enabled && status?.state === 'error' && (
        <p role="alert" className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
          {status.error}
        </p>
      )}
    </div>
  );
}
