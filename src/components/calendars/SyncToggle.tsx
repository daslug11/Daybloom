import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { FeedStatus } from '../../lib/sync';
import { timeAgo } from '../../lib/sync';
import { cn } from '../../lib/utils';

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-gradient-to-r from-violet-500 to-blue-500 shadow-[0_0_12px_rgba(139,92,246,0.6)]' : 'bg-slate-900/20 dark:bg-white/20')}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

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
                <Loader2 size={12} className="animate-spin text-violet-400" /> Syncing…
              </>
            ) : status.state === 'ok' ? (
              <>
                <CheckCircle2 size={12} className="shrink-0 text-emerald-500" /> {status.count} event{status.count === 1 ? '' : 's'} · {timeAgo(status.fetchedAt)}
              </>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-300">
                <AlertTriangle size={12} /> Sync failed
              </span>
            )}
          </span>
        )}
        {!enabled && <span className="muted ml-auto">Off</span>}
      </div>
      {enabled && status?.state === 'error' && (
        <p role="alert" className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-200">
          {status.error}
        </p>
      )}
    </div>
  );
}
