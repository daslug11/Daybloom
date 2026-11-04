import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SpaceIcon } from '../../../components/spaces/fields';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/States';
import { useSpaces } from '../../../hooks/data/spaces';
import { useUserId } from '../../../hooks/useAuth';
import { LIMITS, TEMPLATES, type Space } from '../../../lib/spaces';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

/** Item counts for the cards (one tiny HEAD request per Space). */
function useCounts(ids: string[]) {
  const uid = useUserId();
  return useQuery({
    queryKey: ['space_counts', uid, ids.join(',')],
    enabled: !!uid && ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const entries = await Promise.all(ids.map(async (id) => [id, (await supabase.from('space_items').select('id', { count: 'exact', head: true }).eq('space_id', id)).count ?? null] as const));
      return Object.fromEntries(entries) as Record<string, number | null>;
    },
  });
}

export default function SpacesIndex() {
  const spaces = useSpaces();
  const all = spaces.data ?? [];
  const active = all.filter((s) => s.status === 'active');
  const drafts = all.filter((s) => s.status === 'draft');
  const archived = all.filter((s) => s.status === 'archived');
  const counts = useCounts(all.filter((s) => s.status !== 'draft').map((s) => s.id));
  const [showArchived, setShowArchived] = useState(false);
  const full = active.length >= LIMITS.activeSpaces;

  return (
    <div>
      <PageHeader
        title="Spaces"
        description="Your own lists and trackers: a Christmas list, a running log, college applications. Describe one and Atlas builds it, or start from a template."
        actions={
          <Link to="/app/spaces/new" className={cn('btn-primary', full && 'pointer-events-none opacity-50')} aria-disabled={full}>
            <Plus size={16} aria-hidden /> New Space
          </Link>
        }
      />
      {spaces.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading Spaces">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : spaces.error ? (
        <ErrorState message="Your Spaces didn’t load." onRetry={() => spaces.refetch()} />
      ) : (
        <>
          {drafts.length > 0 && (
            <section className="mb-6" aria-labelledby="drafts-h">
              <h2 id="drafts-h" className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Sparkles size={14} className="text-atlas" aria-hidden /> Previews from Atlas</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {drafts.map((s) => (
                  <Link key={s.id} to={`/app/spaces/new?draft=${s.id}`} className="card card-hover flex items-center gap-3 border-atlas/30 p-4">
                    <SpaceIcon emoji={s.emoji} color={s.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.name}</span>
                      <span className="block text-xs text-muted">Not saved yet · open to check and save</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {active.length === 0 ? (
            <div className="card">
              <EmptyState emoji="🗂️" title="Make your first Space" action={<Link to="/app/spaces/new" className="btn-primary"><Plus size={16} aria-hidden /> New Space</Link>}>
                Tell Atlas what you want to keep track of, or pick one of these to start:
              </EmptyState>
              <div className="flex flex-wrap justify-center gap-2 px-4 pb-8">
                {TEMPLATES.slice(0, 6).map((t) => (
                  <Link key={t.id} to={`/app/spaces/new?template=${t.id}`} className="chip-off !min-h-9 !px-3">
                    <span aria-hidden>{t.emoji}</span> {t.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">{active.length} of {LIMITS.activeSpaces} Spaces{full ? ' · archive one to make room' : ''}</p>
              <SpaceGrid spaces={active} counts={counts.data} />
            </>
          )}

          {archived.length > 0 && (
            <section className="mt-8" aria-labelledby="archived-h">
              <button type="button" id="archived-h" className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink" aria-expanded={showArchived} onClick={() => setShowArchived((s) => !s)}>
                <ChevronDown size={14} className={cn('transition-transform duration-fast', !showArchived && '-rotate-90')} aria-hidden /> Archived ({archived.length})
              </button>
              {showArchived && <SpaceGrid spaces={archived} counts={counts.data} muted />}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SpaceGrid({ spaces, counts, muted }: { spaces: Space[]; counts?: Record<string, number | null>; muted?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {spaces.map((s) => {
        const n = counts?.[s.id];
        return (
          <li key={s.id}>
            <Link to={`/app/spaces/${s.id}`} className={cn('card card-hover flex h-full items-center gap-3 p-4 transition-transform duration-press ease-out active:scale-[0.99]', muted && 'opacity-70')}>
              <SpaceIcon emoji={s.emoji} color={s.color} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-muted">
                  {n === undefined ? '…' : n === null ? 'Count unavailable' : `${n} item${n === 1 ? '' : 's'}`}
                  {s.settings.pinned ? ' · pinned' : ''}
                  {s.habit_id || s.goal_id ? ' · linked' : ''}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
