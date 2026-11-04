/** The seven Space views. All of them render from the design; none is custom code. */
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  chartSeries,
  fieldByKey,
  formatAs,
  formatDay,
  formatValue,
  groupItems,
  itemTitle,
  NUMERIC_TYPES,
  STATUS_DOT,
  valueOf,
  type Field,
  type ItemValues,
  type SpaceDesign,
  type SpaceItem,
  type View,
} from '../../lib/spaces';
import { cn } from '../../lib/utils';
import { Menu, MenuItem } from '../ui/Menu';
import { FieldInput, FieldValue, SpaceImage, StatusPill } from './fields';
import { ItemRow, ROW_HEIGHT, rowFields, useRowFocus, VirtualRows, type RowHandlers } from './ItemList';

export interface ViewProps {
  design: SpaceDesign;
  view: View;
  items: SpaceItem[];
  today: string;
  emoji: string;
  color: number;
  selection: Set<string>;
  selecting: boolean;
  handlers: RowHandlers & { onUpdate: (item: SpaceItem, values: ItemValues) => void };
  readOnly?: boolean;
  people?: string[];
  /** Shown instead of rows when there are no items. */
  empty: ReactNode;
}

/** True below 640px: wide views fall back to rows there. */
function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

export function SpaceView(props: ViewProps) {
  const narrow = useNarrow();
  if (!props.items.length) return <>{props.empty}</>;
  // On a phone a table would hide most columns off-screen; rows show the key values instead.
  if (narrow && props.view.type === 'table') return <ChecklistView {...props} />;
  switch (props.view.type) {
    case 'checklist':
      return <ChecklistView {...props} />;
    case 'table':
      return <TableView {...props} />;
    case 'board':
      return <BoardView {...props} />;
    case 'grouped':
      return <GroupedView {...props} />;
    case 'gallery':
      return <GalleryView {...props} />;
    case 'calendar':
      return <CalendarView {...props} />;
    case 'chart':
      return <ChartView {...props} />;
  }
}

// ---------------------------------------------------------------------------
// Checklist: to do first, then a collapsible "Done" section
// ---------------------------------------------------------------------------
function ChecklistView({ design, items, today, selection, selecting, handlers, readOnly }: ViewProps) {
  const [showDone, setShowDone] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const check = design.check;
  const open = check ? items.filter((i) => i.values[check] !== true) : items;
  const done = check ? items.filter((i) => i.values[check] === true) : [];
  const rows = showDone ? [...open, ...done] : open;
  const doneWord = (design.fields.find((f) => f.key === check)?.name ?? 'done').toLowerCase();
  const { focus, setFocus } = useRowFocus(rows.length, ROW_HEIGHT, box);
  return (
    <div className="card overflow-hidden" ref={box} data-rows>
      <div role="list" aria-label="Items">
        <VirtualRows
          count={rows.length}
          rowHeight={ROW_HEIGHT}
          render={(i) => {
            const item = rows[i];
            return <ItemRow key={item.id} item={item} design={design} today={today} selected={selection.has(item.id)} selecting={selecting} focused={focus === i} index={i} setFocus={setFocus} readOnly={readOnly} {...handlers} />;
          }}
        />
      </div>
      {done.length > 0 && (
        <button type="button" onClick={() => setShowDone((s) => !s)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-medium text-muted hover:bg-raised" aria-expanded={showDone}>
          <ChevronDown size={14} className={cn('transition-transform duration-fast', !showDone && '-rotate-90')} aria-hidden />
          {showDone ? `Hide ${doneWord} (${done.length})` : `Show ${doneWord} (${done.length})`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped list: by person, status or tag, with a subtotal per group
// ---------------------------------------------------------------------------
function GroupedView({ design, view, items, today, selection, selecting, handlers, readOnly }: ViewProps) {
  const groups = useMemo(() => groupItems(design, view.field, items).filter((g) => g.items.length), [design, view.field, items]);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const money = design.fields.find((f) => f.type === 'money') ?? design.fields.find((f) => f.type === 'number' || f.type === 'duration');
  const flat: { item: SpaceItem; group: string }[] = [];
  for (const g of groups) if (!closed.has(g.key)) for (const item of g.items) flat.push({ item, group: g.key });
  const box = useRef<HTMLDivElement>(null);
  const { focus, setFocus } = useRowFocus(flat.length, ROW_HEIGHT, box);
  let index = 0;
  return (
    <div className="space-y-3" ref={box} data-rows>
      {groups.map((g) => {
        const isClosed = closed.has(g.key);
        const subtotal = money ? g.items.reduce((s, i) => s + (Number(valueOf(design, money, i, today)) || 0), 0) : null;
        const done = design.check ? g.items.filter((i) => i.values[design.check!] === true).length : null;
        return (
          <section key={g.key} className="card overflow-hidden" aria-label={g.label}>
            <button
              type="button"
              onClick={() => setClosed((c) => {
                const n = new Set(c);
                if (n.has(g.key)) n.delete(g.key);
                else n.add(g.key);
                return n;
              })}
              aria-expanded={!isClosed}
              className="flex w-full items-center gap-2 border-b border-line px-3 py-2.5 text-left hover:bg-raised"
            >
              <ChevronDown size={14} className={cn('shrink-0 text-muted transition-transform duration-fast', isClosed && '-rotate-90')} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {done !== null ? `${done}/${g.items.length}` : g.items.length}
                {subtotal !== null && money ? ` · ${formatAs(design, money.key, subtotal)}` : ''}
              </span>
            </button>
            {!isClosed && (
              <div role="list" aria-label={g.label}>
                {g.items.map((item) => {
                  const i = index++;
                  return (
                    <ItemRow key={`${g.key}-${item.id}`} item={item} design={design} today={today} hide={view.field ? [view.field] : []} selected={selection.has(item.id)} selecting={selecting} focused={focus === i} index={i} setFocus={setFocus} readOnly={readOnly} {...handlers} />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table: every field as a column, inline editing, sticky first column
// ---------------------------------------------------------------------------
const TABLE_ROW = 44;
const colWidth = (f: Field) => ({ long_text: 220, text: 200, link: 180, person: 130, tags: 160, status: 130, date: 120, money: 110, number: 100, duration: 96, rating: 108, checkbox: 72, image: 64, computed: 110 })[f.type];

function TableView({ design, items, today, selection, selecting, handlers, readOnly, people }: ViewProps) {
  const cols = design.fields;
  const primary = fieldByKey(design, design.primary)!;
  const ordered = [primary, ...cols.filter((f) => f.key !== primary.key)];
  const template = `${selecting ? '40px ' : ''}${ordered.map((f) => `${f.key === primary.key ? Math.max(colWidth(f), 200) : colWidth(f)}px`).join(' ')}`;
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const box = useRef<HTMLDivElement>(null);

  const totals = ordered.map((f) => (['money', 'number', 'duration'].includes(f.type) ? items.reduce((s, i) => s + (Number(i.values[f.key]) || 0), 0) : null));

  const moveFocus = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(items.length - 1, r));
    const nc = Math.max(0, Math.min(ordered.length - 1, c));
    setFocus({ r: nr, c: nc });
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-cell="${nr}-${nc}"]`)?.focus());
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain" ref={box}>
        <div role="table" aria-label="Items" aria-rowcount={items.length + 1} className="min-w-max text-sm">
          <div role="row" className="sticky top-0 z-[2] grid border-b border-line bg-raised" style={{ gridTemplateColumns: template }}>
            {selecting && <span role="columnheader" className="px-2 py-2"><span className="sr-only">Selected</span></span>}
            {ordered.map((f, c) => (
              <span key={f.key} role="columnheader" className={cn('truncate px-3 py-2 text-xs font-medium text-muted', c === 0 && 'sticky left-0 z-[1] bg-raised', NUMERIC_TYPES.includes(f.type) && 'text-right')}>
                {f.name}
              </span>
            ))}
          </div>
          <VirtualRows
            count={items.length}
            rowHeight={TABLE_ROW}
            threshold={100}
            render={(r) => {
              const item = items[r];
              const sel = selection.has(item.id);
              return (
                <div key={item.id} role="row" aria-selected={selecting ? sel : undefined} className={cn('grid border-b border-line', sel ? 'bg-ink/[0.06]' : 'bg-surface hover:bg-raised', item.id.startsWith('temp-') && 'opacity-60')} style={{ gridTemplateColumns: template, height: TABLE_ROW }}>
                  {selecting && (
                    <span role="cell" className="flex items-center justify-center">
                      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--ink))]" checked={sel} onChange={() => handlers.onSelect(item, {})} aria-label={`Select ${itemTitle(design, item)}`} />
                    </span>
                  )}
                  {ordered.map((f, c) => (
                    <TableCell
                      key={f.key}
                      design={design}
                      field={f}
                      item={item}
                      today={today}
                      first={c === 0}
                      editing={editing?.id === item.id && editing.key === f.key}
                      setEditing={(on) => setEditing(on ? { id: item.id, key: f.key } : null)}
                      tabIndex={focus.r === r && focus.c === c ? 0 : -1}
                      cellId={`${r}-${c}`}
                      onFocusCell={() => setFocus({ r, c })}
                      onMove={(dr, dc) => moveFocus(r + dr, c + dc)}
                      readOnly={readOnly}
                      people={people}
                      handlers={handlers}
                    />
                  ))}
                </div>
              );
            }}
          />
          {totals.some((t) => t !== null) && (
            <div role="row" className="grid bg-raised" style={{ gridTemplateColumns: template }}>
              {selecting && <span role="cell" />}
              {ordered.map((f, c) => (
                <span key={f.key} role="cell" className={cn('truncate px-3 py-2 text-xs font-semibold tabular-nums', c === 0 && 'sticky left-0 bg-raised text-muted', NUMERIC_TYPES.includes(f.type) && 'text-right')}>
                  {c === 0 ? `${items.length} item${items.length === 1 ? '' : 's'}` : totals[c] !== null && f.type !== 'number' ? formatAs(design, f.key, totals[c]!) : totals[c] !== null ? formatAs(design, f.key, totals[c]!) : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const INLINE: Field['type'][] = ['text', 'number', 'money', 'person', 'link', 'date'];

function TableCell(props: {
  design: SpaceDesign;
  field: Field;
  item: SpaceItem;
  today: string;
  first: boolean;
  editing: boolean;
  setEditing: (on: boolean) => void;
  tabIndex: number;
  cellId: string;
  onFocusCell: () => void;
  onMove: (dr: number, dc: number) => void;
  readOnly?: boolean;
  people?: string[];
  handlers: ViewProps['handlers'];
}) {
  const { design, field, item, today, first, editing, setEditing, readOnly, handlers } = props;
  const [draft, setDraft] = useState<unknown>(item.values[field.key]);
  const commit = () => {
    setEditing(false);
    if (draft !== item.values[field.key]) {
      const next = { ...item.values };
      if (draft === undefined || draft === '') delete next[field.key];
      else next[field.key] = draft;
      handlers.onUpdate(item, next);
    }
  };
  const activate = () => {
    if (readOnly || field.type === 'computed') return;
    if (field.type === 'checkbox') {
      const next = { ...item.values };
      if (next[field.key] === true) delete next[field.key];
      else next[field.key] = true;
      handlers.onUpdate(item, next);
    } else if (INLINE.includes(field.type)) {
      setDraft(item.values[field.key]);
      setEditing(true);
    } else if (field.type !== 'status' && field.type !== 'rating') handlers.onOpen(item);
  };
  const base = cn('relative flex min-w-0 items-center px-3 outline-none focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/60 focus-visible:ring-offset-0', first && 'sticky left-0 z-[1] bg-inherit font-medium', NUMERIC_TYPES.includes(field.type) && 'justify-end');

  if (editing) {
    return (
      <span role="cell" className={cn(base, 'px-1')}>
        <div className="w-full [&_.input]:!py-1.5 [&_.input]:!text-sm" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setEditing(false))}>
          <FieldInput field={field} value={draft} onChange={setDraft} onCommit={commit} id={`cell-${item.id}-${field.key}`} people={props.people} autoFocus />
        </div>
      </span>
    );
  }

  const content =
    field.type === 'status' && !readOnly ? (
      <Menu label={`${field.name} for ${itemTitle(design, item)}`} align="left" width={180} triggerClassName="flex h-full w-full items-center text-left" trigger={item.values[field.key] ? <StatusPill field={field} value={item.values[field.key]} /> : <span className="text-xs text-faint">Set…</span>}>
        {(close) => (
          <>
            {field.options?.map((o) => (
              <MenuItem key={o.id} onClick={() => (close(), handlers.onUpdate(item, { ...item.values, [field.key]: o.id }))}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_DOT[o.color] }} aria-hidden />
                {o.label}
              </MenuItem>
            ))}
            <MenuItem onClick={() => {
              close();
              const next = { ...item.values };
              delete next[field.key];
              handlers.onUpdate(item, next);
            }}>Clear</MenuItem>
          </>
        )}
      </Menu>
    ) : field.type === 'rating' && !readOnly ? (
      <span className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" tabIndex={-1} className="flex h-6 w-6 items-center justify-center text-warning" aria-label={`${n} stars`} onClick={(e) => (e.stopPropagation(), handlers.onUpdate(item, { ...item.values, [field.key]: n }))}>
            <span className={Number(item.values[field.key] ?? 0) >= n ? '' : 'opacity-30'}>★</span>
          </button>
        ))}
      </span>
    ) : first ? (
      <span className={cn('truncate', design.check && item.values[design.check] === true && 'text-faint line-through')}>{itemTitle(design, item)}</span>
    ) : field.type === 'checkbox' ? (
      <span aria-hidden className={cn('flex h-4 w-4 items-center justify-center rounded border-2', item.values[field.key] === true ? 'border-ink bg-ink text-canvas' : 'border-control')}>{item.values[field.key] === true ? '✓' : ''}</span>
    ) : (
      <span className="flex min-w-0 items-center [&>*]:min-w-0">
        <FieldValue design={design} field={field} item={item} today={today} preview={item.meta?.previews?.[field.key]} />
      </span>
    );

  return (
    <span
      role="cell"
      data-cell={props.cellId}
      tabIndex={props.tabIndex}
      onFocus={props.onFocusCell}
      aria-label={`${field.name}: ${formatValue(design, field, valueOf(design, field, item, today)) || 'empty'}`}
      onClick={(e) => {
        if (props.handlers && (e.shiftKey || e.metaKey || e.ctrlKey)) return handlers.onSelect(item, { range: e.shiftKey });
        if (field.type !== 'status' && field.type !== 'rating') activate();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const k = e.key;
        if (k === 'ArrowDown') (e.preventDefault(), props.onMove(1, 0));
        else if (k === 'ArrowUp') (e.preventDefault(), props.onMove(-1, 0));
        else if (k === 'ArrowRight') (e.preventDefault(), props.onMove(0, 1));
        else if (k === 'ArrowLeft') (e.preventDefault(), props.onMove(0, -1));
        else if (k === 'Enter' || k === 'F2') (e.preventDefault(), first ? handlers.onOpen(item) : activate());
        else if ((k === 'Delete' || k === 'Backspace') && first && !readOnly) (e.preventDefault(), handlers.onDelete(item));
        else if (k === ' ' && field.type === 'checkbox') (e.preventDefault(), activate());
      }}
      className={cn(base, !readOnly && field.type !== 'computed' && 'cursor-pointer')}
    >
      {content}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Board: one column per status, drag cards between columns
// ---------------------------------------------------------------------------
function BoardView({ design, view, items, today, handlers, readOnly, selection, selecting }: ViewProps) {
  const field = fieldByKey(design, view.field);
  const [over, setOver] = useState<string | null>(null);
  if (!field) return null;
  const groups = groupItems(design, field.key, items);
  const { meta, trailing } = rowFields(design, [field.key]);
  return (
    <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-3">
        {groups.map((g) => {
          const opt = field.options?.find((o) => o.id === g.key);
          return (
            <section
              key={g.key}
              aria-label={`${g.label}, ${g.items.length}`}
              className={cn('flex w-[272px] shrink-0 flex-col rounded-card border bg-raised/60 transition-colors duration-fast', over === g.key ? 'border-ink/50' : 'border-line')}
              onDragOver={(e) => {
                if (readOnly) return;
                e.preventDefault();
                setOver(g.key);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/space-item');
                const item = items.find((i) => i.id === id);
                if (!item) return;
                const next = { ...item.values };
                if (g.key === '__none') delete next[field.key];
                else next[field.key] = g.key;
                handlers.onUpdate(item, next);
              }}
            >
              <header className="flex items-center gap-2 px-3 py-2.5">
                {opt ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_DOT[opt.color] }} aria-hidden /> : null}
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{g.label}</h3>
                <span className="text-xs tabular-nums text-muted">{g.items.length}</span>
              </header>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto px-2 pb-2" role="list">
                {g.items.length === 0 && <p className="px-2 py-4 text-center text-xs text-faint">{readOnly ? 'Nothing here' : 'Drag cards here'}</p>}
                {g.items.slice(0, 300).map((item) => (
                  <div
                    key={item.id}
                    role="listitem"
                    tabIndex={0}
                    draggable={!readOnly}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/space-item', item.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={(e) => (readOnly ? undefined : selecting || e.shiftKey || e.metaKey ? handlers.onSelect(item, { range: e.shiftKey }) : handlers.onOpen(item))}
                    onKeyDown={(e) => e.key === 'Enter' && !readOnly && handlers.onOpen(item)}
                    className={cn('card cursor-pointer p-3 text-left outline-none transition-[border-color,transform] duration-fast hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ink/60 active:scale-[0.99]', selection.has(item.id) && 'border-ink/60')}
                  >
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{itemTitle(design, item)}</p>
                      {trailing && <span className="shrink-0 text-xs font-medium tabular-nums">{formatValue(design, trailing, valueOf(design, trailing, item, today))}</span>}
                    </div>
                    {meta.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {meta.map((f) => (
                          <FieldValue key={f.key} design={design} field={f} item={item} today={today} preview={item.meta?.previews?.[f.key]} />
                        ))}
                      </div>
                    )}
                    {!readOnly && (
                      <div className="mt-2 sm:hidden">
                        <select
                          aria-label={`Move “${itemTitle(design, item)}” to`}
                          className="input !min-h-0 !py-1 !text-xs"
                          value={typeof item.values[field.key] === 'string' ? (item.values[field.key] as string) : ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const next = { ...item.values };
                            if (!e.target.value) delete next[field.key];
                            else next[field.key] = e.target.value;
                            handlers.onUpdate(item, next);
                          }}
                        >
                          <option value="">No {field.name.toLowerCase()}</option>
                          {field.options?.map((o) => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
                {g.items.length > 300 && <p className="px-2 text-center text-xs text-faint">+ {g.items.length - 300} more — use the table to see them all</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery: cards with an image or a link preview
// ---------------------------------------------------------------------------
function GalleryView({ design, view, items, today, handlers, readOnly, emoji, selection, selecting }: ViewProps) {
  const field = fieldByKey(design, view.field);
  const link = design.fields.find((f) => f.type === 'link');
  const { meta, trailing } = rowFields(design, [view.field ?? '']);
  const [limit, setLimit] = useState(60);
  // No pictures anywhere yet: compact cards instead of rows of empty frames.
  const hasMedia = items.some((i) => (field?.type === 'image' && typeof i.values[field.key] === 'string') || (link && i.meta?.previews?.[link.key]?.image));
  return (
    <>
      {!hasMedia && !readOnly && <p className="mb-3 text-xs text-muted">Add a {field?.type === 'image' ? 'photo' : 'link'} to an item and its picture shows here.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.slice(0, limit).map((item) => {
          const img = field?.type === 'image' ? item.values[field.key] : undefined;
          const preview = link ? item.meta?.previews?.[link.key] : undefined;
          const remote = !img && preview?.ok && preview.image ? preview.image : null;
          const href = link ? (item.values[link.key] as string | undefined) : undefined;
          return (
            <article
              key={item.id}
              tabIndex={0}
              onClick={(e) => (readOnly ? href && window.open(href, '_blank', 'noopener,noreferrer') : selecting || e.shiftKey || e.metaKey ? handlers.onSelect(item, { range: e.shiftKey }) : handlers.onOpen(item))}
              onKeyDown={(e) => e.key === 'Enter' && !readOnly && handlers.onOpen(item)}
              className={cn('card group cursor-pointer overflow-hidden outline-none transition-[border-color,transform] duration-fast hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ink/60 active:scale-[0.99]', selection.has(item.id) && 'border-ink/60')}
              aria-label={itemTitle(design, item)}
            >
              {hasMedia && <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-raised">
                {typeof img === 'string' ? (
                  <SpaceImage value={img} alt="" className="h-full w-full" />
                ) : remote ? (
                  <img src={remote} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl opacity-60" aria-hidden>
                    {emoji}
                  </div>
                )}
                {design.check && item.values[design.check] === true && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-canvas">✓ {fieldByKey(design, design.check)?.name}</span>}
              </div>}
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <h3 className={cn('line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug', !hasMedia && design.check && item.values[design.check] === true && 'text-faint line-through')}>{itemTitle(design, item)}</h3>
                  {trailing && <span className="shrink-0 text-sm font-medium tabular-nums">{formatValue(design, trailing, valueOf(design, trailing, item, today))}</span>}
                </div>
                {preview?.ok && preview.title && preview.title !== itemTitle(design, item) && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{preview.title}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {meta.filter((f) => f.type !== 'link').slice(0, 3).map((f) => (
                    <FieldValue key={f.key} design={design} field={f} item={item} today={today} />
                  ))}
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()} className="inline-flex min-w-0 items-center gap-1 text-xs text-muted hover:text-ink">
                      <ExternalLink size={11} aria-hidden />
                      <span className="truncate">{preview?.site ?? new URL(href).hostname.replace(/^www\./, '')}</span>
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {items.length > limit && (
        <div className="mt-4 text-center">
          <button type="button" className="btn-ghost" onClick={() => setLimit((l) => l + 60)}>
            Show more ({items.length - limit} left)
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Calendar: month grid by a date field (agenda list on phones)
// ---------------------------------------------------------------------------
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function CalendarView({ design, view, items, today, handlers, readOnly }: ViewProps) {
  const field = fieldByKey(design, view.field);
  const [month, setMonth] = useState(today.slice(0, 7));
  if (!field) return null;
  const byDay = new Map<string, SpaceItem[]>();
  for (const i of items) {
    const d = i.values[field.key];
    if (typeof d === 'string') byDay.set(d, [...(byDay.get(d) ?? []), i]);
  }
  const undated = items.filter((i) => typeof i.values[field.key] !== 'string');
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + daysIn) / 7) * 7 }, (_, k) => {
    const n = k - offset + 1;
    return n >= 1 && n <= daysIn ? `${month}-${String(n).padStart(2, '0')}` : null;
  });
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const monthItems = [...byDay.entries()].filter(([d]) => d.startsWith(month)).sort(([a], [b]) => a.localeCompare(b));
  const chip = (i: SpaceItem) => (
    <button key={i.id} type="button" disabled={readOnly} onClick={() => handlers.onOpen(i)} className={cn('block min-h-6 w-full truncate rounded-md bg-ink/[0.07] px-1.5 py-1 text-left text-xs hover:bg-ink/[0.12]', design.check && i.values[design.check] === true && 'text-faint line-through')}>
      {itemTitle(design, i)}
    </button>
  );
  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-semibold">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} aria-hidden /></button>
        <button type="button" className="btn-ghost !min-h-9 !px-3 !py-1 text-xs" onClick={() => setMonth(today.slice(0, 7))}>Today</button>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} aria-hidden /></button>
      </div>
      {/* Phones: an agenda list for the month. */}
      <ol className="space-y-3 sm:hidden">
        {monthItems.length === 0 && <li className="py-6 text-center text-sm text-muted">Nothing with a {field.name.toLowerCase()} this month.</li>}
        {monthItems.map(([d, list]) => (
          <li key={d}>
            <p className={cn('mb-1 text-xs font-semibold', d === today ? 'text-ink' : 'text-muted')}>{formatDay(d, { weekday: 'short', month: 'short', day: 'numeric' })}{d === today ? ' · Today' : ''}</p>
            <div className="space-y-1">{list.map(chip)}</div>
          </li>
        ))}
      </ol>
      <div className="hidden sm:block" role="grid" aria-label="Month">
        <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-muted" role="row">
          {WEEK.map((w) => <span key={w} role="columnheader" className="py-1">{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-control border border-line bg-line">
          {Array.from({ length: cells.length / 7 }, (_, w) => (
            // One row per week (display: contents keeps the 7-column grid).
            <div key={w} role="row" className="contents">
          {cells.slice(w * 7, w * 7 + 7).map((d, j) => {
            const k = w * 7 + j;
            const list = d ? byDay.get(d) ?? [] : [];
            return (
              <div key={k} role="gridcell" aria-label={d ? `${formatDay(d, { month: 'long', day: 'numeric' })}, ${list.length} items` : undefined} className={cn('min-h-[92px] bg-surface p-1.5', !d && 'bg-raised/50')}>
                {d && (
                  <>
                    <span className={cn('mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums', d === today ? 'bg-ink font-semibold text-canvas' : 'text-muted')}>{Number(d.slice(8))}</span>
                    <div className="space-y-0.5">
                      {list.slice(0, 3).map(chip)}
                      {list.length > 3 && <p className="px-1 text-xs text-faint">+{list.length - 3} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
            </div>
          ))}
        </div>
      </div>
      {undated.length > 0 && <p className="mt-3 text-xs text-muted">{undated.length} item{undated.length === 1 ? ' has' : 's have'} no {field.name.toLowerCase()} and {undated.length === 1 ? 'isn’t' : 'aren’t'} shown here.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart: line or bar over time (hand-drawn SVG, no chart library)
// ---------------------------------------------------------------------------
const RANGES = [
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
  { id: '365', label: 'Year', days: 365 },
  { id: 'all', label: 'All', days: 100000 },
];

function ChartView({ design, view, items, today }: ViewProps) {
  const [range, setRange] = useState('90');
  const [asTable, setAsTable] = useState(false);
  const all = useMemo(() => chartSeries(design, view, items, today), [design, view, items, today]);
  const days = RANGES.find((r) => r.id === range)!.days;
  const rangeStart = new Date(Date.parse(`${today}T12:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const pts = all.filter((p) => p.day >= rangeStart);
  const yField = fieldByKey(design, view.y);
  const yLabel = view.agg === 'count' || !yField ? 'Items' : yField.name;
  const fmt = (n: number) => (view.agg === 'count' || !view.y ? String(Math.round(n)) : formatAs(design, view.y, n));
  const pace = yField?.compute?.kind === 'pace';
  // The x-axis spans the range you picked (or all your data), ending today.
  const from = range === 'all' ? (pts[0]?.day ?? today) : rangeStart;
  const W = 640;
  const H = 200;
  const barW = Math.max(3, Math.min(20, (W / Math.max(1, (Date.parse(today) - Date.parse(from)) / 86_400_000 + 1)) * 0.7));
  const padX = barW / 2 + 4;
  const top = 8;
  const bottom = H - 4;
  const max = Math.max(...pts.map((p) => p.value), 0) || 1;
  const min = pace && pts.length ? Math.min(...pts.map((p) => p.value)) * 0.9 : 0;
  const t0 = Date.parse(from);
  const t1 = Date.parse(today);
  const x = (d: string) => (t1 === t0 ? W / 2 : padX + ((Date.parse(d) - t0) / (t1 - t0)) * (W - padX * 2));
  const y = (v: number) => top + (1 - (v - min) / (max - min || 1)) * (bottom - top);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover !== null ? pts[hover] : pts[pts.length - 1];
  const best = pts.length ? (pace ? Math.min(...pts.map((p) => p.value)) : Math.max(...pts.map((p) => p.value))) : null;
  const mid = min + (max - min) / 2;

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted">{yLabel}{view.agg && view.agg !== 'sum' && view.agg !== 'count' ? ` (${view.agg === 'avg' ? 'average' : view.agg} per day)` : ' per day'}</p>
          <p className="text-xl font-semibold tabular-nums">{shown ? fmt(shown.value) : '—'}</p>
          <p className="text-xs text-faint">{shown ? formatDay(shown.day, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Nothing in this range'}</p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)} className={range === r.id ? 'chip-on' : 'chip-off'}>{r.label}</button>
          ))}
        </div>
      </div>
      {pts.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">No entries with a date in this range.</p>
      ) : asTable ? (
        <div className="max-h-72 overflow-y-auto rounded-control border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-raised text-xs text-muted"><tr><th className="px-3 py-2 text-left font-medium">Day</th><th className="px-3 py-2 text-right font-medium">{yLabel}</th></tr></thead>
            <tbody>
              {[...pts].reverse().map((p) => (
                <tr key={p.day} className="border-t border-line"><td className="px-3 py-1.5">{formatDay(p.day, { weekday: 'short', month: 'short', day: 'numeric' })}</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(p.value)}{p.value === best ? ' · best' : ''}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Labels are HTML (not SVG text), so they stay 12px at any width. */}
          <div className="flex w-14 shrink-0 flex-col justify-between py-0.5 text-right text-xs tabular-nums text-faint" aria-hidden>
            <span className="truncate">{fmt(max)}</span>
            <span className="truncate">{fmt(mid)}</span>
            <span className="truncate">{fmt(min)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-48 w-full touch-pan-y" role="img" aria-label={`${yLabel} over time: ${pts.slice(-12).map((p) => `${formatDay(p.day)} ${fmt(p.value)}`).join(', ')}`} onPointerLeave={() => setHover(null)}>
              {[top, (top + bottom) / 2, bottom].map((gy) => (
                <line key={gy} x1={0} x2={W} y1={gy} y2={gy} stroke="rgb(var(--line))" vectorEffect="non-scaling-stroke" />
              ))}
              {best !== null && <line x1={0} x2={W} y1={y(best)} y2={y(best)} stroke="rgb(var(--ink) / 0.35)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
              {view.chart === 'bar'
                ? pts.map((p, i) => <rect key={p.day} x={x(p.day) - barW / 2} y={y(p.value)} width={barW} height={Math.max(1, bottom - y(p.value))} rx={2} className={cn('fill-current transition-opacity duration-fast', hover === null || hover === i ? 'text-ink/80' : 'text-ink/35')} />)
                : (
                  <>
                    <polyline points={pts.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} fill="none" stroke="rgb(var(--ink) / 0.8)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    {pts.map((p, i) => <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r={hover === i ? 5 : 3} className="fill-current text-ink" vectorEffect="non-scaling-stroke" />)}
                  </>
                )}
              {pts.map((p, i) => (
                <rect key={`h${p.day}`} x={x(p.day) - Math.max(barW, 12) / 2} y={0} width={Math.max(barW, 12)} height={H} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
              ))}
            </svg>
            <div className="mt-1 flex justify-between text-xs text-faint" aria-hidden>
              <span>{formatDay(from)}</span>
              <span>Today</span>
            </div>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {best !== null && !asTable ? <p className="text-xs text-faint">Dashed line: your {pace ? 'fastest' : 'best'} day in this range ({fmt(best)}).</p> : <span />}
        {pts.length > 0 && <button type="button" className="link text-xs" onClick={() => setAsTable((t) => !t)}>{asTable ? 'Show chart' : 'Show as table'}</button>}
      </div>
    </div>
  );
}

