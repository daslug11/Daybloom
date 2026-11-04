import { CheckSquare, ChevronLeft, ListChecks, MoreHorizontal, Search, Share2, Sparkles, Tag, Trash2, X, FolderInput, Copy, Pencil, Check } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ItemEditor } from '../../../components/spaces/ItemEditor';
import { SpaceIcon } from '../../../components/spaces/fields';
import { QuickAdd, quickAddHint } from '../../../components/spaces/QuickAdd';
import { DesignDialog, MoveDialog, SettingsDialog, ShareDialog, SmartDialog } from '../../../components/spaces/SpaceDialogs';
import type { DraftSpace } from '../../../components/spaces/PreviewEditor';
import { SummaryCards } from '../../../components/spaces/SummaryCards';
import { SpaceView } from '../../../components/spaces/views';
import { Menu, MenuItem } from '../../../components/ui/Menu';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingList, Skeleton } from '../../../components/ui/States';
import { fetchLinkPreview, useItemActions, useSpaceActions, useSpaceItems, useSpaces } from '../../../hooks/data/spaces';
import { hasOpenLayer } from '../../../hooks/useOverlay';
import { useToday } from '../../../hooks/useProfile';
import { useToast } from '../../../hooks/useToast';
import { celebrate } from '../../../lib/confetti';
import {
  itemText,
  itemTitle,
  normalizeValues,
  peopleIn,
  spaceColor,
  type ItemValues,
  type Space,
  type SpaceItem,
} from '../../../lib/spaces';
import { cn } from '../../../lib/utils';

const VIEW_KEY = (id: string) => `daybloom:space-view:${id}`;

export default function SpacePage() {
  const { id = '' } = useParams();
  const spaces = useSpaces();
  const space = spaces.data?.find((s) => s.id === id);
  if (spaces.isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading Space">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24" />
        <LoadingList rows={5} />
      </div>
    );
  }
  if (spaces.error) return <ErrorState message="Your Spaces didn’t load." onRetry={() => spaces.refetch()} />;
  if (!space) {
    return (
      <EmptyState emoji="🔍" title="This Space doesn’t exist" action={<Link to="/app/spaces" className="btn-primary">All Spaces</Link>}>
        It may have been deleted, or the link is wrong.
      </EmptyState>
    );
  }
  if (space.status === 'draft') {
    return (
      <EmptyState emoji="✨" title="This Space is still a preview" action={<Link to={`/app/spaces/new?draft=${space.id}`} className="btn-primary">Open preview</Link>}>
        Atlas drafted it. Check the preview and save it to start adding items.
      </EmptyState>
    );
  }
  return <SpaceScreen key={space.id} space={space} />;
}

function SpaceScreen({ space }: { space: Space }) {
  const toast = useToast();
  const { today, tz } = useToday();
  const itemsQ = useSpaceItems(space.id);
  const actions = useItemActions(space.id);
  const { update: updateSpace } = useSpaceActions();
  const items = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const design = space.design;
  const people = useMemo(() => peopleIn(design, items), [design, items]);

  const [viewId, setViewId] = useState<string>(() => {
    try {
      return localStorage.getItem(VIEW_KEY(space.id)) ?? design.views[0].id;
    } catch {
      return design.views[0].id;
    }
  });
  const view = design.views.find((v) => v.id === viewId) ?? design.views[0];
  const pickView = (v: string) => {
    setViewId(v);
    try {
      localStorage.setItem(VIEW_KEY(space.id), v);
    } catch {
      /* private mode */
    }
  };

  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => itemText(design, i).includes(q)) : items;
  }, [items, query, design]);

  // Selection (multi-select and bulk actions).
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const lastPicked = useRef<string | null>(null);
  const selecting = selectMode || selection.size > 0;
  const clearSelection = () => {
    setSelection(new Set());
    setSelectMode(false);
  };

  const [editing, setEditing] = useState<SpaceItem | null>(null);
  const [actionsFor, setActionsFor] = useState<SpaceItem | null>(null);
  const [moving, setMoving] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<'share' | 'settings' | 'design' | 'suggest' | 'insights' | 'ask' | 'redesign' | null>(null);
  const [redesignDraft, setRedesignDraft] = useState<DraftSpace | null>(null);
  const [tagging, setTagging] = useState(false);
  const tagsField = design.fields.find((f) => f.type === 'tags');
  const linkField = design.fields.find((f) => f.type === 'link');
  const moneyField = design.fields.find((f) => f.type === 'money');

  /** Fetches link previews (title, image, price) for new links; fills an empty price. No AI. */
  const enrich = useCallback(
    async (saved: SpaceItem[]) => {
      if (!linkField) return;
      const todo = saved.filter((i) => typeof i.values[linkField.key] === 'string' && i.meta?.previews?.[linkField.key]?.url !== i.values[linkField.key]).slice(0, 20);
      for (const item of todo) {
        const url = item.values[linkField.key] as string;
        const preview = await fetchLinkPreview(url).catch(() => null);
        if (!preview) continue;
        const values = { ...item.values };
        if (moneyField && values[moneyField.key] === undefined && preview.price && (!preview.currency || preview.currency === moneyField.currency)) values[moneyField.key] = preview.price;
        await actions.update([{ id: item.id, values, meta: { ...item.meta, previews: { ...(item.meta?.previews ?? {}), [linkField.key]: preview } } }], 'Link preview', { quiet: true });
      }
    },
    [linkField, moneyField, actions],
  );

  const add = async (values: ItemValues[], label?: string) => {
    const saved = await actions.add(values, label);
    void enrich(saved);
    return saved;
  };

  const save = (item: SpaceItem, values: ItemValues, label = `Updated “${itemTitle(design, { ...item, values })}”`) => {
    const clean = normalizeValues(design, values);
    const linkChanged = linkField && clean[linkField.key] !== item.values[linkField.key];
    void actions.update([{ id: item.id, values: clean }], label).then(() => {
      if (linkChanged) void enrich([{ ...item, values: clean }]);
    });
    if (editing?.id === item.id) setEditing({ ...item, values: clean });
  };

  const toggle = (item: SpaceItem) => {
    if (!design.check || item.id.startsWith('temp-')) return;
    const on = item.values[design.check] !== true;
    const values = { ...item.values };
    if (on) values[design.check] = true;
    else delete values[design.check];
    void actions.update([{ id: item.id, values }], on ? `Ticked off “${itemTitle(design, item)}”` : `Unticked “${itemTitle(design, item)}”`);
    // All done: one small celebration.
    if (on && items.length >= 3 && items.every((i) => i.id === item.id || i.values[design.check!] === true)) celebrate();
  };

  const select = (item: SpaceItem, opts: { range?: boolean }) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (opts.range && lastPicked.current) {
        const ids = shown.map((i) => i.id);
        const a = ids.indexOf(lastPicked.current);
        const b = ids.indexOf(item.id);
        if (a >= 0 && b >= 0) for (const k of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(k);
      } else if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      lastPicked.current = item.id;
      return next;
    });
  };

  const handlers = {
    onToggle: toggle,
    onOpen: (item: SpaceItem) => !item.id.startsWith('temp-') && setEditing(item),
    onActions: (item: SpaceItem) => setActionsFor(item),
    onSelect: select,
    onDelete: (item: SpaceItem) => void actions.remove([item.id], `Deleted “${itemTitle(design, item)}”`),
    onUpdate: (item: SpaceItem, values: ItemValues) => save(item, values),
  };

  // Ctrl/⌘+Z undoes the last change here; "/" jumps to quick add; Escape clears a selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing && !hasOpenLayer()) {
        e.preventDefault();
        void actions.undoLast().then((did) => !did && toast('Nothing to undo here.'));
      } else if (e.key === '/' && !typing && !hasOpenLayer()) {
        e.preventDefault();
        document.getElementById('space-quick-add')?.focus();
      } else if (e.key === 'Escape' && selecting && !hasOpenLayer()) clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selected = items.filter((i) => selection.has(i.id));
  const bulkCheck = (on: boolean) => {
    if (!design.check) return;
    const changes = selected.map((i) => {
      const values = { ...i.values };
      if (on) values[design.check!] = true;
      else delete values[design.check!];
      return { id: i.id, values };
    });
    void actions.update(changes, `${on ? 'Ticked off' : 'Unticked'} ${changes.length} item${changes.length === 1 ? '' : 's'}`);
    clearSelection();
  };
  const bulkTag = (tag: string) => {
    if (!tagsField) return;
    const t = tag.replace(/^#/, '').trim().toLowerCase().slice(0, 30);
    if (!t) return;
    const changes = selected.map((i) => ({ id: i.id, values: { ...i.values, [tagsField.key]: [...new Set([...((i.values[tagsField.key] as string[]) ?? []), t])].slice(0, 10) } }));
    void actions.update(changes, `Tagged ${changes.length} item${changes.length === 1 ? '' : 's'} #${t}`);
    setTagging(false);
    clearSelection();
  };
  const resetAll = () => {
    if (!design.check) return;
    const changes = items.filter((i) => i.values[design.check!] === true).map((i) => {
      const values = { ...i.values };
      delete values[design.check!];
      return { id: i.id, values };
    });
    void actions.update(changes, `Reset ${changes.length} item${changes.length === 1 ? '' : 's'}`);
  };
  const moveTo = (to: Space) => {
    const ids = moving ?? [];
    setMoving(null);
    clearSelection();
    void actions.move(ids, to, (values) => {
      const out: ItemValues = {};
      for (const f of design.fields) {
        const v = values[f.key];
        if (v === undefined) continue;
        const target = to.design.fields.find((x) => x.key === f.key && x.type === f.type) ?? to.design.fields.find((x) => x.name.toLowerCase() === f.name.toLowerCase() && x.type === f.type);
        if (target) out[target.key] = v;
        else if (f.key === design.primary) out[to.design.primary] = v;
      }
      return normalizeValues(to.design, out);
    });
  };

  const hex = spaceColor(space.color);
  const checkName = design.check ? design.fields.find((f) => f.key === design.check)?.name : null;

  return (
    <div className={cn(selecting && 'pb-24')}>
      {/* Header: the Space's emoji and colour make it feel like its own place. */}
      <div className="mb-1">
        <Link to="/app/spaces" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
          <ChevronLeft size={14} aria-hidden /> Spaces
        </Link>
      </div>
      <header className="mb-5 flex flex-wrap items-start gap-3">
        <SpaceIcon emoji={space.emoji} color={space.color} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{space.name}</h1>
          <span aria-hidden className="mt-1 block h-1 w-10 rounded-full" style={{ background: hex }} />
          <p className="muted mt-0.5 line-clamp-2 text-sm">{space.description || `${items.length} item${items.length === 1 ? '' : 's'}`}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn-ghost !px-3" onClick={() => setDialog('share')} aria-label="Share">
            <Share2 size={15} aria-hidden /> <span className="hidden sm:inline">Share</span>
          </button>
          <Menu label="✨ Smart actions" align="right" width={232} triggerClassName="btn-ai !px-3" trigger={<><Sparkles size={15} aria-hidden /><span className="hidden sm:inline">Smart</span></>}>
            {(close) => (
              <>
                <MenuItem onClick={() => (close(), setDialog('suggest'))}>Suggest items</MenuItem>
                <MenuItem onClick={() => (close(), setDialog('insights'))} disabled={items.length < 2}>Insights</MenuItem>
                <MenuItem onClick={() => (close(), setDialog('ask'))}>Ask this Space</MenuItem>
                <MenuItem onClick={() => (close(), setDialog('redesign'))}>Redesign…</MenuItem>
                <p className="px-2.5 pb-1 pt-1.5 text-xs text-faint">Each uses 1 AI action.</p>
              </>
            )}
          </Menu>
          <Menu label="Space settings" align="right" width={220} triggerClassName="icon-btn" trigger={<MoreHorizontal size={18} aria-hidden />}>
            {(close) => (
              <>
                <MenuItem onClick={() => (close(), setDialog('design'))}><Pencil size={14} aria-hidden /> Edit design</MenuItem>
                <MenuItem onClick={() => (close(), setDialog('settings'))}><ListChecks size={14} aria-hidden /> Settings…</MenuItem>
              </>
            )}
          </Menu>
        </div>
      </header>

      {space.status === 'archived' && (
        <div className="card mb-4 flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="flex-1">This Space is archived. It doesn’t count toward your 25.</span>
          <button type="button" className="btn-ghost !min-h-9" onClick={() => updateSpace.mutate({ id: space.id, patch: { status: 'active' } })}>Restore</button>
        </div>
      )}

      {itemsQ.isLoading ? (
        <LoadingList rows={5} label="Loading items" />
      ) : itemsQ.error ? (
        <ErrorState message="The items in this Space didn’t load." onRetry={() => itemsQ.refetch()} />
      ) : (
        <div className="space-y-4">
          <SummaryCards design={design} items={items} today={today} tz={tz} spaceId={space.id} />
          <div>
            <QuickAdd design={design} today={today} people={people} templateId={space.template_id} onAdd={add} name={space.name} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {design.views.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="View">
                {design.views.map((v) => (
                  <button key={v.id} type="button" aria-pressed={view.id === v.id} onClick={() => pickView(v.id)} className={view.id === v.id ? 'chip-on' : 'chip-off'}>
                    {v.name}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {items.length > 8 && (
                <label className="relative">
                  <span className="sr-only">Search this Space</span>
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
                  <input className="input !w-40 !py-1.5 !pl-8 sm:!w-48" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
                </label>
              )}
              {items.length > 0 && ['checklist', 'grouped', 'table', 'board', 'gallery'].includes(view.type) && (
                <button type="button" className={selecting ? 'chip-on' : 'chip-off'} aria-pressed={selecting} onClick={() => (selecting ? clearSelection() : setSelectMode(true))}>
                  <CheckSquare size={13} aria-hidden /> {selecting ? 'Done' : 'Select'}
                </button>
              )}
            </div>
          </div>
          {query && <p className="text-xs text-muted" aria-live="polite">{shown.length} of {items.length} match “{query}”</p>}
          <SpaceView
            design={design}
            view={view}
            items={shown}
            today={today}
            emoji={space.emoji}
            color={space.color}
            selection={selection}
            selecting={selecting}
            handlers={handlers}
            people={people}
            empty={
              query ? (
                <p className="card px-4 py-8 text-center text-sm text-muted">Nothing matches “{query}”.</p>
              ) : (
                <ViewEmpty space={space} viewType={view.type} />
              )
            }
          />
        </div>
      )}

      {/* Bulk actions */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6" role="toolbar" aria-label={`${selection.size} selected`}>
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-card border border-line bg-overlay p-1.5 shadow-pop animate-fade-in">
            <span className="px-2 text-sm font-medium tabular-nums">{selection.size} selected</span>
            <button type="button" className="btn-ghost !min-h-9 !px-2.5 text-xs" onClick={() => setSelection(new Set(shown.map((i) => i.id)))}>All</button>
            {design.check && (
              <>
                <button type="button" className="btn-ghost !min-h-9 !px-2.5 text-xs" disabled={!selection.size} onClick={() => bulkCheck(true)}><Check size={14} aria-hidden /> {checkName ?? 'Done'}</button>
                <button type="button" className="btn-ghost !min-h-9 !px-2.5 text-xs" disabled={!selection.size} onClick={() => bulkCheck(false)}>Untick</button>
              </>
            )}
            {tagsField && <button type="button" className="btn-ghost !min-h-9 !px-2.5 text-xs" disabled={!selection.size} onClick={() => setTagging(true)}><Tag size={14} aria-hidden /> Tag</button>}
            <button type="button" className="btn-ghost !min-h-9 !px-2.5 text-xs" disabled={!selection.size} onClick={() => setMoving([...selection])}><FolderInput size={14} aria-hidden /> Move</button>
            <button type="button" className="btn-danger !min-h-9 !px-2.5 text-xs" disabled={!selection.size} onClick={() => { void actions.remove([...selection]); clearSelection(); }}><Trash2 size={14} aria-hidden /> Delete</button>
            <button type="button" className="icon-btn h-9 w-9" onClick={clearSelection} aria-label="Clear selection"><X size={16} aria-hidden /></button>
          </div>
        </div>
      )}

      <ItemEditor
        item={editing}
        design={design}
        today={today}
        people={people}
        onClose={() => setEditing(null)}
        onSave={(item, values) => save(item, values)}
        onDelete={(item) => {
          setEditing(null);
          void actions.remove([item.id], `Deleted “${itemTitle(design, item)}”`);
        }}
        onDuplicate={(item) => {
          setEditing(null);
          void add([item.values], `Duplicated “${itemTitle(design, item)}”`);
        }}
        onMove={(item) => {
          setEditing(null);
          setMoving([item.id]);
        }}
      />

      {/* Swipe-left / ⋯ actions for one item */}
      <Modal open={!!actionsFor} onClose={() => setActionsFor(null)} title={actionsFor ? itemTitle(design, actionsFor) : ''} variant="sheet" className="sm:max-w-sm">
        {actionsFor && (
          <div className="grid gap-1.5">
            {design.check && (
              <button type="button" className="btn-ghost justify-start" onClick={() => (toggle(actionsFor), setActionsFor(null))}>
                <Check size={15} aria-hidden /> {actionsFor.values[design.check] === true ? 'Untick' : `Tick off${checkName ? ` (${checkName.toLowerCase()})` : ''}`}
              </button>
            )}
            <button type="button" className="btn-ghost justify-start" onClick={() => (setEditing(actionsFor), setActionsFor(null))}><Pencil size={15} aria-hidden /> Edit</button>
            <button type="button" className="btn-ghost justify-start" onClick={() => (void add([actionsFor.values], 'Duplicated item'), setActionsFor(null))}><Copy size={15} aria-hidden /> Duplicate</button>
            <button type="button" className="btn-ghost justify-start" onClick={() => (setSelection(new Set([actionsFor.id])), setActionsFor(null))}><CheckSquare size={15} aria-hidden /> Select</button>
            <button type="button" className="btn-ghost justify-start" onClick={() => (setMoving([actionsFor.id]), setActionsFor(null))}><FolderInput size={15} aria-hidden /> Move to another Space</button>
            <button type="button" className="btn-danger justify-start" onClick={() => (handlers.onDelete(actionsFor), setActionsFor(null))}><Trash2 size={15} aria-hidden /> Delete</button>
          </div>
        )}
      </Modal>

      <Modal open={tagging} onClose={() => setTagging(false)} title={`Tag ${selection.size} item${selection.size === 1 ? '' : 's'}`}>
        <form onSubmit={(e) => { e.preventDefault(); bulkTag(new FormData(e.currentTarget).get('tag') as string); }} className="flex gap-2">
          <label htmlFor="bulk-tag" className="sr-only">Tag</label>
          <input id="bulk-tag" name="tag" className="input" placeholder="#idea" autoFocus maxLength={31} />
          <button type="submit" className="btn-primary">Add tag</button>
        </form>
      </Modal>

      <MoveDialog space={space} count={moving?.length ?? 0} open={!!moving} onClose={() => setMoving(null)} onMove={moveTo} />
      <ShareDialog space={space} open={dialog === 'share'} onClose={() => setDialog(null)} onDesign={(d) => updateSpace.mutate({ id: space.id, patch: { design: d } })} />
      <SettingsDialog space={space} items={items} open={dialog === 'settings'} onClose={() => setDialog(null)} onEditDesign={() => setDialog('design')} onResetAll={resetAll} />
      {dialog === 'design' && <DesignDialog space={space} items={items} open onClose={() => setDialog(null)} />}
      {redesignDraft && (
        <DesignDialog
          space={space}
          items={items}
          open
          initial={{ ...redesignDraft, samples: items.slice(0, 3).map((i) => i.values) }}
          title="✨ Redesign preview"
          note="Here’s the new design with a few of your own items. Adjust anything, then save — or cancel to keep the old one."
          onClose={() => setRedesignDraft(null)}
        />
      )}
      <SmartDialog
        space={space}
        kind={dialog === 'suggest' || dialog === 'insights' || dialog === 'ask' || dialog === 'redesign' ? dialog : null}
        onClose={() => setDialog(null)}
        onAdd={(values) => void add(values, `Added ${values.length} suggestion${values.length === 1 ? '' : 's'}`)}
        onRedesign={(d) => {
          setDialog(null);
          setRedesignDraft(d);
        }}
      />
    </div>
  );
}

/** What to do first in each view, using this Space's own example line. */
function ViewEmpty({ space, viewType }: { space: Space; viewType: string }) {
  const example = quickAddHint(space.design, space.template_id);
  const date = space.design.fields.find((f) => f.type === 'date');
  const body =
    viewType === 'chart'
      ? `Log a few entries with a ${date?.name.toLowerCase() ?? 'date'} and a number, and they’ll be charted here over time.`
      : viewType === 'calendar'
        ? `Items with a ${date?.name.toLowerCase() ?? 'date'} show up on the calendar.`
        : viewType === 'gallery'
          ? 'Add a link or a photo to an item and it shows as a card here.'
          : 'Type in the bar above and press Enter, or paste a whole list at once.';
  return (
    <EmptyState emoji={space.emoji} title="Add your first item" className="card">
      <p>{body}</p>
      <p className="mt-2">
        Try: <span className="kbd !text-xs">{example}</span>
      </p>
    </EmptyState>
  );
}
