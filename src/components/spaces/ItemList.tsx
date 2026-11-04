/**
 * Rows of items for the checklist and grouped views: check off, swipe (phones),
 * long-press or click to select, arrow keys to move, and windowed rendering for
 * long lists so 1,000+ items scroll smoothly.
 */
import { Check, MoreHorizontal } from 'lucide-react';
import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { formatValue, itemTitle, valueOf, type Field, type SpaceDesign, type SpaceItem } from '../../lib/spaces';
import { cn } from '../../lib/utils';
import { FieldValue } from './fields';

export const ROW_HEIGHT = 60;

export interface RowHandlers {
  onToggle?: (item: SpaceItem) => void;
  onOpen: (item: SpaceItem) => void;
  onActions: (item: SpaceItem) => void;
  onSelect: (item: SpaceItem, opts: { range?: boolean; only?: boolean }) => void;
  onDelete: (item: SpaceItem) => void;
}

/** The fields shown under the title (up to four), and the one shown on the right. */
export function rowFields(design: SpaceDesign, hide: string[] = []): { meta: Field[]; trailing: Field | undefined } {
  const skip = new Set([design.primary, design.check ?? '', ...hide]);
  const trailing = design.fields.find((f) => !skip.has(f.key) && (f.type === 'money' || (f.type === 'computed' && f.compute?.kind === 'pace'))) ?? design.fields.find((f) => !skip.has(f.key) && (f.type === 'number' || f.type === 'duration'));
  const meta = design.fields.filter((f) => !skip.has(f.key) && f.key !== trailing?.key && !['long_text', 'image'].includes(f.type)).slice(0, 4);
  return { meta, trailing };
}

interface RowProps extends RowHandlers {
  item: SpaceItem;
  design: SpaceDesign;
  today: string;
  selected: boolean;
  selecting: boolean;
  focused: boolean;
  hide?: string[];
  index: number;
  setFocus: (i: number) => void;
  readOnly?: boolean;
}

/** One item row. Swipe right = check off, swipe left = actions, long-press = select (touch). */
export const ItemRow = memo(function ItemRow({ item, design, today, selected, selecting, focused, hide, index, setFocus, readOnly, ...h }: RowProps) {
  const done = !!design.check && item.values[design.check] === true;
  const { meta, trailing } = rowFields(design, hide);
  const title = itemTitle(design, item);
  const row = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const g = useRef<{ x: number; y: number; id: number; swiping: boolean; timer: number | null; long: boolean } | null>(null);
  const preview = item.meta?.previews;
  const pending = item.id.startsWith('temp-');
  // Only fields with a value take a line; a title alone sits centred in the row.
  const shownMeta = meta.filter((f) => {
    const v = f.type === 'computed' ? valueOf(design, f, item, today) : item.values[f.key];
    return v !== undefined && v !== null && v !== '' && v !== false && !(Array.isArray(v) && !v.length);
  });

  useEffect(() => {
    if (focused && row.current && document.activeElement !== row.current && row.current.closest('[data-rows]')?.contains(document.activeElement)) row.current.focus({ preventScroll: false });
  }, [focused]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly || e.pointerType !== 'touch') return;
    const timer = window.setTimeout(() => {
      if (!g.current || g.current.swiping) return;
      g.current.long = true;
      navigator.vibrate?.(10);
      h.onSelect(item, {});
    }, 450);
    g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false, timer, long: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.swiping && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      if (s.timer) window.clearTimeout(s.timer);
      s.timer = null;
      if (Math.abs(mx) > Math.abs(my) * 1.4 && !selecting) {
        s.swiping = true;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* the pointer already ended */
        }
      } else {
        g.current = null; // vertical: let the page scroll
        return;
      }
    }
    if (s.swiping) setDx(Math.max(-96, Math.min(96, mx * (design.check || mx < 0 ? 1 : 0.3))));
  };
  const end = () => {
    const s = g.current;
    if (s?.timer) window.clearTimeout(s.timer);
    if (s?.swiping) {
      if (dx > 64 && design.check) h.onToggle?.(item);
      else if (dx < -64) h.onActions(item);
    }
    g.current = s?.long ? { ...s, timer: null } : null;
    setDx(0);
  };

  const onClick = (e: React.MouseEvent) => {
    if (g.current?.long) {
      g.current = null;
      return;
    }
    if (readOnly) return;
    if (selecting || e.shiftKey || e.metaKey || e.ctrlKey) h.onSelect(item, { range: e.shiftKey });
    else h.onOpen(item);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowDown' || e.key === 'j') (e.preventDefault(), setFocus(index + 1));
    else if (e.key === 'ArrowUp' || e.key === 'k') (e.preventDefault(), setFocus(index - 1));
    else if (readOnly) return;
    else if (e.key === 'Enter') (e.preventDefault(), h.onOpen(item));
    else if ((e.key === ' ' || e.key === 'x') && design.check) (e.preventDefault(), h.onToggle?.(item));
    else if (e.key === 's') (e.preventDefault(), h.onSelect(item, { range: e.shiftKey }));
    else if (e.key === 'Delete' || e.key === 'Backspace') (e.preventDefault(), h.onDelete(item));
  };

  return (
    <div className="relative overflow-hidden" style={{ height: ROW_HEIGHT }}>
      {/* What a swipe will do, revealed under the row. */}
      {dx !== 0 && (
        <div aria-hidden className={cn('absolute inset-0 flex items-center px-5 text-sm font-semibold', dx > 0 ? 'justify-start bg-success/15 text-success' : 'justify-end bg-ink/[0.08] text-ink')}>
          {dx > 0 ? (done ? 'Undo' : 'Done') : 'Actions'}
        </div>
      )}
      <div
        ref={row}
        role="listitem"
        tabIndex={focused ? 0 : -1}
        aria-selected={selecting ? selected : undefined}
        aria-label={`${title}${done ? ', done' : ''}`}
        onFocus={() => setFocus(index)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onClick={onClick}
        onContextMenu={(e) => g.current?.long && e.preventDefault()}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)' }}
        className={cn(
          'group relative flex h-full cursor-default select-none items-center gap-3 border-b border-line bg-surface px-3 outline-none [-webkit-touch-callout:none]',
          'focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/60 focus-visible:ring-offset-0',
          selected && 'bg-ink/[0.06]',
          pending && 'opacity-60',
          !readOnly && 'hover:bg-raised',
        )}
      >
        {(selecting || selected) && !readOnly && (
          <span aria-hidden className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2', selected ? 'border-ink bg-ink text-canvas' : 'border-control')}>
            {selected && <Check size={12} strokeWidth={3} />}
          </span>
        )}
        {design.check && !selecting && (
          <button
            type="button"
            tabIndex={-1}
            disabled={readOnly}
            onClick={(e) => {
              e.stopPropagation();
              h.onToggle?.(item);
            }}
            className="hit group/check -m-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform duration-press ease-out motion-safe:active:scale-[0.85]"
            aria-label={done ? `Mark “${title}” as not done` : `Tick off “${title}”`}
          >
            <span aria-hidden className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-press ease-out', done ? 'border-transparent bg-accent text-accent-ink' : 'border-control group-hover/check:border-ink')}>
              {done && <Check size={12} strokeWidth={3} className="animate-check-pop" />}
            </span>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium leading-5 transition-colors duration-fast', done && 'text-faint line-through decoration-faint/60')}>{title}</p>
          {shownMeta.length > 0 && (
            <div className="mt-0.5 flex h-5 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
              {shownMeta.map((f) => (
                <span key={f.key} className="flex min-w-0 shrink items-center">
                  <FieldValue design={design} field={f} item={item} today={today} preview={preview?.[f.key]} />
                </span>
              ))}
            </div>
          )}
        </div>
        {trailing && (
          <span className={cn('shrink-0 text-sm font-medium tabular-nums', done && 'text-faint')}>
            <FieldValueText design={design} field={trailing} item={item} today={today} />
          </span>
        )}
        {!readOnly && !selecting && (
          <button
            type="button"
            tabIndex={-1}
            className="icon-btn h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              h.onActions(item);
            }}
            aria-label={`Actions for “${title}”`}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
});

function FieldValueText({ design, field, item, today }: { design: SpaceDesign; field: Field; item: SpaceItem; today: string }) {
  return <>{formatValue(design, field, valueOf(design, field, item, today))}</>;
}

/**
 * Renders only the rows near the viewport (the page itself scrolls). Below
 * `threshold` rows everything renders normally.
 */
export function VirtualRows({ count, rowHeight, render, threshold = 120, className }: { count: number; rowHeight: number; render: (i: number) => ReactNode; threshold?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[number, number]>([0, Math.min(count, 40)]);
  const virtual = count > threshold;

  useLayoutEffect(() => {
    if (!virtual) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = box.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const first = Math.max(0, Math.floor(-top / rowHeight) - 10);
      const last = Math.min(count, Math.ceil((vh - top) / rowHeight) + 10);
      setRange((r) => (r[0] === first && r[1] === last ? r : [first, Math.max(first, last)]));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [virtual, count, rowHeight]);

  if (!virtual) return <div className={className}>{Array.from({ length: count }, (_, i) => render(i))}</div>;
  const [first, last] = range;
  return (
    <div ref={box} className={cn('relative', className)} style={{ height: count * rowHeight }}>
      <div style={{ transform: `translateY(${first * rowHeight}px)` }}>{Array.from({ length: Math.max(0, last - first) }, (_, k) => render(first + k))}</div>
    </div>
  );
}

/** Keeps a focused row index within bounds and scrolls virtual rows into view. */
export function useRowFocus(count: number, rowHeight: number, box: React.RefObject<HTMLElement | null>) {
  const [focus, setFocusState] = useState(0);
  const setFocus = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i));
    setFocusState(next);
    const el = box.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY + next * rowHeight;
    const vt = window.scrollY + 80;
    const vb = window.scrollY + window.innerHeight - 120;
    if (top < vt) window.scrollTo({ top: top - 80 });
    else if (top + rowHeight > vb) window.scrollTo({ top: top + rowHeight - window.innerHeight + 120 });
  };
  return { focus: Math.min(focus, Math.max(0, count - 1)), setFocus };
}
