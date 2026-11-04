import { useEffect, useMemo, useRef } from 'react';
import { celebrate } from '../../lib/confetti';
import { computeSummary, type SpaceDesign, type SpaceItem } from '../../lib/spaces';
import { cn } from '../../lib/utils';

/**
 * The Space's summary cards (totals, budgets, bests…). A progress card that
 * reaches its target gets one small celebration (never under reduced motion).
 */
export function SummaryCards({ design, items, today, tz, spaceId, compact }: { design: SpaceDesign; items: SpaceItem[]; today: string; tz?: string; spaceId?: string; compact?: boolean }) {
  const results = useMemo(() => design.summaries.map((s) => ({ s, r: computeSummary(design, s, items, today, tz) })), [design, items, today, tz]);
  const reached = useRef<Map<string, boolean> | null>(null);

  useEffect(() => {
    const now = new Map(results.map(({ s, r }) => [s.id, s.kind === 'progress' && !!r.over]));
    const before = reached.current;
    reached.current = now;
    if (!before || !spaceId) return;
    for (const [id, hit] of now) if (hit && before.get(id) === false) celebrate();
  }, [results, spaceId]);

  if (!results.length) return null;
  return (
    <div
      className={cn(
        compact ? 'grid grid-cols-2 gap-3' : 'grid-cols-2 gap-3 max-sm:-mx-4 max-sm:flex max-sm:snap-x max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 sm:grid lg:grid-cols-3 xl:grid-cols-4',
      )}
      role="list"
      aria-label="Summary"
      // The phone strip scrolls sideways, so keyboard users can focus it and use the arrow keys.
      tabIndex={compact ? undefined : 0}
    >
      {/* Phones: one swipeable strip, so the list starts near the top of the screen. */}
      {results.map(({ s, r }) => (
        <div key={s.id} role="listitem" className={cn('card min-w-0 p-4 max-sm:shrink-0 max-sm:snap-start', !compact && 'max-sm:w-[46%] max-sm:min-w-[150px]', s.kind === 'budget' && !!r.groups?.length && !compact && 'sm:col-span-2 max-sm:w-[78%]')}>
          <p className="truncate text-xs font-medium text-muted">{s.label}</p>
          <p className={cn('mt-1 truncate text-xl font-semibold tabular-nums tracking-[-0.01em]', r.over && s.kind === 'budget' && 'text-danger', r.empty && 'text-faint')}>{r.display}</p>
          {r.sub && r.sub.toLowerCase() !== s.label.toLowerCase() && <p className={cn('mt-0.5 truncate text-xs', r.over && s.kind === 'budget' ? 'font-medium text-danger' : 'text-muted')}>{r.sub}</p>}
          {r.ratio !== undefined && (s.kind === 'progress' || s.kind === 'budget' || (s.kind === 'count' && s.filter)) && (
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]" role="progressbar" aria-label={s.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.ratio * 100)}>
              <div className={cn('h-full origin-left rounded-full transition-transform duration-base ease-out', r.over && s.kind === 'budget' ? 'bg-danger' : r.over ? 'bg-success' : 'bg-ink')} style={{ transform: `scaleX(${r.ratio})` }} />
            </div>
          )}
          {!compact && r.groups && r.groups.length > 0 && (
            <ul className="mt-3 space-y-1.5 max-sm:hidden">
              {r.groups.slice(0, 8).map((g) => (
                <li key={g.label} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{g.label}</span>
                  <span className={cn('shrink-0 tabular-nums', g.over ? 'font-semibold text-danger' : 'text-muted')}>
                    {g.amount}
                    {g.target ? ` / ${g.target}` : ''}
                    {g.over ? ' · over' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
