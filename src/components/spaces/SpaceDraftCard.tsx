import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSpaces } from '../../hooks/data/spaces';
import { SpaceIcon } from './fields';

/** The card Atlas shows under a reply when it drafts a Space: opens the live preview. */
export function SpaceDraftCard({ spaceId }: { spaceId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useSpaces();
  const space = data?.find((s) => s.id === spaceId);
  if (isLoading) return <div className="h-20 animate-pulse rounded-card bg-raised" aria-hidden />;
  if (!space) return <p className="rounded-card border border-line px-3 py-2 text-xs text-muted">That Space preview was discarded.</p>;
  const draft = space.status === 'draft';
  return (
    <div className="rounded-card border border-atlas/40 bg-surface p-3">
      <div className="flex items-center gap-3">
        <SpaceIcon emoji={space.emoji} color={space.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{space.name}</p>
          <p className="truncate text-xs text-muted">{space.design.fields.map((f) => f.name).join(' · ')}</p>
        </div>
      </div>
      <button type="button" className={draft ? 'btn-primary mt-3 w-full' : 'btn-ghost mt-3 w-full'} onClick={() => navigate(draft ? `/app/spaces/new?draft=${space.id}` : `/app/spaces/${space.id}`)}>
        {draft ? 'Open preview' : 'Open Space'} <ArrowRight size={15} aria-hidden />
      </button>
      {draft && <p className="mt-2 text-center text-xs text-faint">Nothing is saved until you check it and press Save.</p>}
    </div>
  );
}
