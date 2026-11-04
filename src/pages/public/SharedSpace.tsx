import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SpaceIcon } from '../../components/spaces/fields';
import { SummaryCards } from '../../components/spaces/SummaryCards';
import { SpaceView } from '../../components/spaces/views';
import { EmptyState, LoadingList } from '../../components/ui/States';
import { normalizeDesign, type SpaceDesign, type SpaceItem } from '../../lib/spaces';

interface Shared {
  space: { name: string; emoji: string; color: number; description: string; design: SpaceDesign };
  items: { id: string; values: SpaceItem['values']; meta: SpaceItem['meta'] }[];
}

/** A read-only Space from a share link. Shows no account info; not indexed by search engines. */
export default function SharedSpace() {
  const { token = '' } = useParams();
  const q = useQuery({
    queryKey: ['shared-space', token],
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/spaces?share=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'This link isn’t working.');
      return data as Shared;
    },
  });

  // Keep shared pages out of search results (the server also sends X-Robots-Tag).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => {
    if (q.data) document.title = `${q.data.space.emoji} ${q.data.space.name} · Daybloom`;
  }, [q.data]);

  const design = useMemo(() => (q.data ? normalizeDesign(q.data.space.design).design : null), [q.data]);
  const items: SpaceItem[] = useMemo(() => (q.data?.items ?? []).map((i, n) => ({ ...i, space_id: 'shared', position: n, created_at: '', updated_at: '' })), [q.data]);
  const [viewId, setViewId] = useState<string | null>(null);
  const today = new Date().toLocaleDateString('en-CA');
  const noop = () => {};

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 sm:px-6">
      {q.isLoading ? (
        <LoadingList rows={6} label="Loading shared list" />
      ) : q.error || !q.data || !design ? (
        <EmptyState emoji="🔒" title="This link isn’t available" action={<Link to="/" className="btn-ghost">About Daybloom</Link>}>
          {(q.error as Error)?.message ?? 'It may have been turned off by its owner.'}
        </EmptyState>
      ) : (
        <>
          <header className="mb-6 flex items-start gap-3">
            <SpaceIcon emoji={q.data.space.emoji} color={q.data.space.color} size="lg" />
            <div className="min-w-0">
              <h1 className="page-title">{q.data.space.name}</h1>
              {q.data.space.description && <p className="muted mt-1 text-sm">{q.data.space.description}</p>}
              <p className="faint mt-1 text-xs">Shared read-only · {items.length} item{items.length === 1 ? '' : 's'}</p>
            </div>
          </header>
          <div className="space-y-4">
            <SummaryCards design={design} items={items} today={today} />
            {design.views.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="View">
                {design.views.map((v) => (
                  <button key={v.id} type="button" aria-pressed={(viewId ?? design.views[0].id) === v.id} onClick={() => setViewId(v.id)} className={(viewId ?? design.views[0].id) === v.id ? 'chip-on' : 'chip-off'}>{v.name}</button>
                ))}
              </div>
            )}
            <SpaceView
              design={design}
              view={design.views.find((v) => v.id === viewId) ?? design.views[0]}
              items={items}
              today={today}
              emoji={q.data.space.emoji}
              color={q.data.space.color}
              selection={new Set()}
              selecting={false}
              readOnly
              handlers={{ onOpen: noop, onActions: noop, onSelect: noop, onDelete: noop, onUpdate: noop }}
              empty={<p className="card px-4 py-10 text-center text-sm text-muted">Nothing here yet.</p>}
            />
          </div>
          <footer className="mt-10 text-center text-xs text-faint">
            Made with <Link to="/" className="link">🌸 Daybloom</Link>, a free life organiser.
          </footer>
        </>
      )}
    </div>
  );
}
