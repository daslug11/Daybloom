import { AlertTriangle, CalendarDays, ChevronDown, Copy, ExternalLink, FolderPlus, HelpCircle, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCard } from '../../components/calendars/CalendarCard';
import { CalendarModal } from '../../components/calendars/CalendarModal';
import { GroupModal } from '../../components/calendars/GroupModal';
import { IcsHelp } from '../../components/calendars/IcsHelp';
import { MoveToGroupDialog } from '../../components/calendars/MoveToGroupDialog';
import { SyncStatusPill } from '../../components/calendars/SyncStatusPill';
import { TypeBadge } from '../../components/calendars/TypeBadge';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, QueryState } from '../../components/ui/States';
import {
  calendarsKey,
  groupsKey,
  useAddCalendar,
  useCalendarGroups,
  useCalendars,
  useDeleteCalendar,
  useDeleteGroup,
  useRestoreCalendar,
  useSaveGroup,
  useUpdateCalendar,
  type CalendarDraft,
} from '../../hooks/data/calendars';
import { useUserId } from '../../hooks/useAuth';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useToast } from '../../hooks/useToast';
import { CALENDAR_TYPES, calendarColor, calendarTile, detectCalendarType, looksLikeFeed } from '../../lib/calendars';
import { supabase } from '../../lib/supabase';
import type { CalendarGroup, CalendarLink, CalendarType } from '../../lib/types';
import { cn } from '../../lib/utils';

const UNGROUPED = '__ungrouped__';
const COLLAPSED_KEY = 'daybloom:calendars-collapsed';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Calendars() {
  const calendars = useCalendars();
  const { data: groups = [] } = useCalendarGroups();
  const add = useAddCalendar();
  const update = useUpdateCalendar();
  const del = useDeleteCalendar();
  const restore = useRestoreCalendar();
  const saveGroup = useSaveGroup();
  const delGroup = useDeleteGroup();
  const sync = useCalendarSync();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const uid = useUserId();

  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<CalendarType | null>(null);
  const [calModal, setCalModal] = useState<{ open: boolean; editing: CalendarLink | null; groupId: string | null }>({ open: false, editing: null, groupId: null });
  const [groupModal, setGroupModal] = useState<{ open: boolean; editing: CalendarGroup | null }>({ open: false, editing: null });
  const [helpOpen, setHelpOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ section: string; before: string | null } | null>(null);
  const [movingCal, setMovingCal] = useState<CalendarLink | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (params.get('add') === '1') {
      setCalModal({ open: true, editing: null, groupId: null });
      setParams((p) => (p.delete('add'), p), { replace: true });
    }
  }, [params, setParams]);

  const list = useMemo(() => [...(calendars.data ?? [])].sort((a, b) => a.sort - b.sort), [calendars.data]);
  const groupIds = new Set(groups.map((g) => g.id));
  const sectionOf = (c: CalendarLink) => (c.group_id && groupIds.has(c.group_id) ? c.group_id : UNGROUPED);
  const filtering = !!query.trim() || groupFilter !== null || typeFilter !== null;
  const q = query.trim().toLowerCase();
  const visible = list.filter(
    (c) => (!q || `${c.name} ${c.url}`.toLowerCase().includes(q)) && (!groupFilter || sectionOf(c) === groupFilter) && (!typeFilter || detectCalendarType(c.url) === typeFilter),
  );
  const presentTypes = (Object.keys(CALENDAR_TYPES) as CalendarType[]).filter((t) => list.some((c) => detectCalendarType(c.url) === t));
  const pinned = visible.filter((c) => c.pinned);
  const sections = [...groups.map((g) => ({ id: g.id, group: g as CalendarGroup | null })), { id: UNGROUPED, group: null }].filter((s) => !groupFilter || s.id === groupFilter);

  const toggleCollapsed = (id: string) =>
    setCollapsed((c) => {
      const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  // The confirmation toast waits for the save to succeed (a failure shows its own message).
  const saveCalendar = (draft: CalendarDraft) => {
    if (calModal.editing) update.mutate({ id: calModal.editing.id, patch: draft }, { onSuccess: () => toast(`${draft.emoji} ${draft.name} updated`) });
    else add.mutate(draft, { onSuccess: () => toast(`${draft.emoji} ${draft.name} added`) });
    setCalModal((m) => ({ ...m, open: false }));
  };

  const deleteCalendar = (c: CalendarLink) => {
    del.mutate(c.id);
    toast(`Deleted ${c.emoji} ${c.name}`, { label: 'Undo', onClick: () => restore.mutate(c) });
  };

  const deleteGroup = (g: CalendarGroup) => {
    const moved = list.filter((c) => c.group_id === g.id).map((c) => c.id);
    delGroup.mutate(g.id);
    toast(`Deleted ${g.name}${moved.length ? ` · ${moved.length} moved to Ungrouped` : ''}`, {
      label: 'Undo',
      onClick: async () => {
        await supabase.from('calendar_groups').insert({ id: g.id, name: g.name, color: g.color, sort: g.sort });
        if (moved.length) await supabase.from('calendars').update({ group_id: g.id }).in('id', moved);
        qc.invalidateQueries({ queryKey: groupsKey(uid) });
        qc.invalidateQueries({ queryKey: calendarsKey(uid) });
      },
    });
  };

  // Reorder within a group or move between groups (by the `sort` column): put `id` before
  // `beforeId`, or at the end of `section`. Drag, the card menu and Move to group all use this.
  const place = (id: string, section: string, beforeId: string | null) => {
    if (id === beforeId) return;
    const moving = list.find((c) => c.id === id);
    if (!moving) return;
    const rest = list.filter((c) => c.id !== id);
    let sort: number;
    if (beforeId) {
      const i = rest.findIndex((c) => c.id === beforeId);
      const prev = rest[i - 1];
      sort = prev ? (prev.sort + rest[i].sort) / 2 : rest[i].sort - 1;
    } else {
      const inSection = rest.filter((c) => sectionOf(c) === section);
      sort = (inSection.length ? Math.max(...inSection.map((c) => c.sort)) : Math.max(0, ...rest.map((c) => c.sort))) + 1;
    }
    const group_id = section === UNGROUPED ? null : section;
    update.mutate({ id, patch: { sort, group_id } });
    if ((moving.group_id ?? null) !== group_id) toast(`Moved ${moving.emoji} ${moving.name} to ${groups.find((g) => g.id === group_id)?.name ?? 'Ungrouped'}`);
  };
  const drop = (section: string, beforeId: string | null) => {
    const id = dragId;
    setDragId(null);
    setDropTarget(null);
    if (id) place(id, section, beforeId);
  };
  /** Move up / Move down within the card's group, then keep focus on that card's menu button. */
  const moveBy = (c: CalendarLink, dir: -1 | 1) => {
    const section = sectionOf(c);
    const items = list.filter((x) => sectionOf(x) === section);
    const i = items.findIndex((x) => x.id === c.id);
    const to = i + dir;
    if (i < 0 || to < 0 || to >= items.length) return;
    place(c.id, section, dir < 0 ? items[to].id : (items[to + 1]?.id ?? null));
    setAnnouncement(`${c.name} moved to position ${to + 1} of ${items.length} in ${groups.find((g) => g.id === section)?.name ?? 'Ungrouped'}`);
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-calendar-id="${c.id}"] button[aria-haspopup="menu"]`)?.focus(), 60);
  };
  const neighbours = (c: CalendarLink) => {
    const items = list.filter((x) => sectionOf(x) === sectionOf(c));
    const i = items.findIndex((x) => x.id === c.id);
    return { first: i <= 0, last: i === items.length - 1 };
  };

  return (
    <div>
      <PageHeader
        title="Calendars"
        description="Keep the calendars you use in one place — open them in one click. Turn on Sync for an ICS feed and its events show up (locked) in your Planner and dashboard."
        actions={
          <>
            <button className="btn-ghost" onClick={() => setGroupModal({ open: true, editing: null })} aria-label="New group" title="New group">
              <FolderPlus size={16} /> <span className="hidden sm:inline">New group</span>
            </button>
            <button className="btn-primary" onClick={() => setCalModal({ open: true, editing: null, groupId: groupFilter && groupFilter !== UNGROUPED ? groupFilter : null })}>
              <Plus size={16} /> Add calendar
            </button>
          </>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">Calendar sync</h2>
            <p className="muted mt-0.5 text-sm">Synced feeds refresh every 10 minutes. Only links with Sync turned on are fetched.</p>
          </div>
          <SyncStatusPill />
        </div>
        {sync.requestError && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {sync.requestError}
          </p>
        )}
        {!sync.requestError && sync.errorCount > 0 && (
          <ul role="alert" className="mt-3 space-y-1 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {sync.syncedCalendars
              .filter((c) => sync.statuses[c.id]?.state === 'error')
              .map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>
                      {c.emoji} {c.name}:
                    </strong>{' '}
                    {sync.statuses[c.id]?.error}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <button className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink hover:underline" onClick={() => setHelpOpen((v) => !v)} aria-expanded={helpOpen}>
          <HelpCircle size={15} /> How do I find my calendar’s secret ICS address?
          <ChevronDown size={14} className={cn('transition-transform duration-fast ease-out', helpOpen && 'rotate-180')} />
        </button>
        {helpOpen && (
          <div className="mt-3 border-t border-line pt-3">
            <IcsHelp />
          </div>
        )}
      </Card>

      {/* Search and filters only earn their space once there are enough calendars to need them. */}
      {(list.length > 8 || groups.length >= 2 || filtering) && (
        <div className="mb-5 space-y-2">
          <div className="relative">
            <Search size={15} className="faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
            <input className="input !py-2 pl-9" placeholder="Search calendars" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search calendars" />
            {query && (
              <button className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="faint mr-1 text-xs font-medium">Group</span>
            <button className={groupFilter === null ? 'chip-on' : 'chip-off'} onClick={() => setGroupFilter(null)}>
              All
            </button>
            {groups.map((g) => (
              <button key={g.id} className={groupFilter === g.id ? 'chip-on' : 'chip-off'} onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}>
                <span className="h-2 w-2 rounded-full" style={{ background: calendarColor(g.color) }} /> {g.name}
              </button>
            ))}
            <button className={groupFilter === UNGROUPED ? 'chip-on' : 'chip-off'} onClick={() => setGroupFilter(groupFilter === UNGROUPED ? null : UNGROUPED)}>
              Ungrouped
            </button>
          </div>
          {presentTypes.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="faint mr-1 text-xs font-medium">Type</span>
              <button className={typeFilter === null ? 'chip-on' : 'chip-off'} onClick={() => setTypeFilter(null)}>
                All
              </button>
              {presentTypes.map((t) => (
                <button key={t} className={typeFilter === t ? 'chip-on' : 'chip-off'} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>
                  {CALENDAR_TYPES[t].emoji} {CALENDAR_TYPES[t].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <QueryState isLoading={calendars.isLoading} error={calendars.error} onRetry={() => calendars.refetch()} />
      {calendars.data && list.length === 0 && (
        <EmptyState
          emoji="📅"
          title="No calendars saved yet"
          action={
            <button className="btn-primary" onClick={() => setCalModal({ open: true, editing: null, groupId: null })}>
              <Plus size={16} /> Add calendar
            </button>
          }
        >
          Paste a link to any calendar you use (Google, Outlook, iCloud, Calendly…). To see its events in your Planner, use the calendar’s secret ICS address and turn on
          Sync — the guide above shows where to find it.
        </EmptyState>
      )}

      {list.length > 0 && (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <section aria-labelledby="pinned-h">
              <h2 id="pinned-h" className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Star size={15} className="fill-warning text-warning" aria-hidden /> Pinned
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {pinned.map((c) => {
                  const inner = (
                    <>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-lg" style={calendarTile(c.color)} aria-hidden>
                        {c.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.name}</span>
                        <TypeBadge type={detectCalendarType(c.url)} className="mt-0.5" />
                      </span>
                    </>
                  );
                  const cls = 'card card-hover flex min-w-[210px] items-center gap-3 p-3';
                  // A feed link would only download a file; synced feeds open in the Planner instead.
                  if (looksLikeFeed(c.url)) {
                    return c.sync ? (
                      <Link key={c.id} to="/app/planner" className={cls}>
                        {inner}
                        <CalendarDays size={14} className="faint ml-auto shrink-0" aria-label="view in Planner" />
                      </Link>
                    ) : (
                      <button key={c.id} className={cn(cls, 'text-left')} onClick={async () => toast((await copyText(c.url)) ? 'Link copied' : 'Could not copy — select the link instead.')}>
                        {inner}
                        <Copy size={14} className="faint ml-auto shrink-0" aria-label="copy link" />
                      </button>
                    );
                  }
                  return (
                    <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" className={cls}>
                      {inner}
                      <ExternalLink size={14} className="faint ml-auto shrink-0" aria-label="opens in a new tab" />
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {filtering && visible.length === 0 && <p className="muted text-sm">No calendars match those filters.</p>}

          {sections.map(({ id, group }) => {
            const items = visible.filter((c) => sectionOf(c) === id);
            if (items.length === 0 && (id === UNGROUPED ? !dragId : filtering)) return null;
            const isCollapsed = collapsed.includes(id);
            const isOver = dropTarget?.section === id && dragId !== null;
            return (
              <section
                key={id}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  if (dropTarget?.section !== id || dropTarget.before !== null) setDropTarget({ section: id, before: null });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(id, null);
                }}
                className={cn('rounded-2xl p-1', isOver && 'bg-ink/[0.03] ring-2 ring-ink/40')}
              >
                <div className="mb-2 flex items-center gap-2">
                  <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => toggleCollapsed(id)} aria-expanded={!isCollapsed}>
                    <ChevronDown size={18} className={cn('faint transition-transform duration-fast ease-out', isCollapsed && '-rotate-90')} />
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: group ? calendarColor(group.color) : 'rgb(var(--faint))' }} aria-hidden />
                    <h2 className="truncate text-base font-bold">{group ? group.name : 'Ungrouped'}</h2>
                    <span className="faint text-xs">{items.length}</span>
                  </button>
                  <div className="ml-auto flex items-center">
                    <button className="icon-btn h-8 w-8" onClick={() => setCalModal({ open: true, editing: null, groupId: group?.id ?? null })} aria-label={`Add calendar to ${group?.name ?? 'Ungrouped'}`}>
                      <Plus size={15} />
                    </button>
                    {group && (
                      <>
                        <button className="icon-btn h-8 w-8" onClick={() => setGroupModal({ open: true, editing: group })} aria-label={`Rename or recolor ${group.name}`}>
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn h-8 w-8" onClick={() => deleteGroup(group)} aria-label={`Delete group ${group.name}`}>
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {!isCollapsed &&
                  (items.length === 0 ? (
                    <div className="muted rounded-2xl border-2 border-dashed border-line p-5 text-center text-sm">
                      {dragId ? 'Drop here to move it into this group' : 'Nothing here yet. Add a calendar with +, or move one here from its ⋯ menu.'}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((c) => (
                        <CalendarCard
                          key={c.id}
                          calendar={c}
                          dragging={dragId === c.id}
                          dropBefore={dropTarget?.before === c.id && dragId !== c.id}
                          syncStatus={sync.statuses[c.id]}
                          onToggleSync={(enabled) => {
                            update.mutate({ id: c.id, patch: { sync: enabled } });
                            toast(enabled ? `Syncing ${c.emoji} ${c.name}…` : `Sync off for ${c.emoji} ${c.name}`);
                          }}
                          onCopy={async () => toast((await copyText(c.url)) ? 'Link copied' : 'Could not copy — select the link instead.')}
                          onEdit={() => setCalModal({ open: true, editing: c, groupId: c.group_id })}
                          onTogglePin={() => update.mutate({ id: c.id, patch: { pinned: !c.pinned } })}
                          onDelete={() => deleteCalendar(c)}
                          onMoveToGroup={groups.length ? () => setMovingCal(c) : undefined}
                          onMoveUp={neighbours(c).first ? undefined : () => moveBy(c, -1)}
                          onMoveDown={neighbours(c).last ? undefined : () => moveBy(c, 1)}
                          onDragStart={() => setDragId(c.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setDropTarget(null);
                          }}
                          onDragOver={() => dropTarget?.before !== c.id && setDropTarget({ section: id, before: c.id })}
                          onDrop={() => drop(id, c.id)}
                        />
                      ))}
                    </div>
                  ))}
              </section>
            );
          })}
        </div>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {movingCal && (
        <MoveToGroupDialog
          calendar={movingCal}
          groups={groups}
          current={sectionOf(movingCal) === UNGROUPED ? null : sectionOf(movingCal)}
          onClose={() => setMovingCal(null)}
          onMove={(groupId) => {
            place(movingCal.id, groupId ?? UNGROUPED, null);
            setMovingCal(null);
          }}
        />
      )}
      <CalendarModal open={calModal.open} initial={calModal.editing} groups={groups} defaultGroupId={calModal.groupId} onClose={() => setCalModal((m) => ({ ...m, open: false }))} onSave={saveCalendar} />
      <GroupModal
        open={groupModal.open}
        initial={groupModal.editing}
        onClose={() => setGroupModal({ open: false, editing: null })}
        onSave={(data) => {
          saveGroup.mutate({ id: groupModal.editing?.id, ...data });
          setGroupModal({ open: false, editing: null });
        }}
      />
    </div>
  );
}
