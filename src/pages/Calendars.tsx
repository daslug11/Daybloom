import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, ExternalLink, FolderPlus, HelpCircle, Pencil, Plus, RefreshCw, Search, Star, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { CalendarCard } from '../components/calendars/CalendarCard';
import { CalendarModal, type CalendarDraft } from '../components/calendars/CalendarModal';
import { GroupModal } from '../components/calendars/GroupModal';
import { TypeBadge } from '../components/calendars/TypeBadge';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { SyncStatusPill } from '../components/SyncStatus';
import { IcsHelp } from '../components/calendars/IcsHelp';
import { useApp } from '../hooks/useApp';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { useCalendarGroups, useCalendars } from '../hooks/useData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useToast } from '../hooks/useToast';
import { CALENDAR_TYPES, detectCalendarType, gradient } from '../lib/calendars';
import { KEYS } from '../lib/storage';
import type { CalendarGroup, CalendarLink, CalendarType } from '../lib/types';
import { cn, uid } from '../lib/utils';

const UNGROUPED = '__ungrouped__';

/** Palette "Add calendar" requests already handled, so remounting the page doesn't reopen the modal. */
let handledAddRequest = 0;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

export default function Calendars() {
  const [calendars, setCalendars] = useCalendars();
  const [groups, setGroups] = useCalendarGroups();
  const [collapsed, setCollapsed] = useLocalStorage<string[]>(KEYS.calendarsCollapsed, []);
  const { addCalendarRequested, navigate } = useApp();
  const toast = useToast();
  const calendarSync = useCalendarSync();
  const [helpOpen, setHelpOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<CalendarType | null>(null);

  const [calModal, setCalModal] = useState<{ open: boolean; editing: CalendarLink | null; groupId: string | null }>({ open: false, editing: null, groupId: null });
  const [groupModal, setGroupModal] = useState<{ open: boolean; editing: CalendarGroup | null }>({ open: false, editing: null });

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ section: string; before: string | null } | null>(null);

  useEffect(() => {
    if (addCalendarRequested > handledAddRequest) {
      handledAddRequest = addCalendarRequested;
      setCalModal({ open: true, editing: null, groupId: null });
    }
  }, [addCalendarRequested]);

  // ---------- filtering ----------
  const filtering = !!query.trim() || groupFilter !== null || typeFilter !== null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calendars.filter((c) => {
      if (q && !`${c.name} ${c.url} ${c.emoji}`.toLowerCase().includes(q)) return false;
      if (groupFilter && (c.groupId ?? UNGROUPED) !== groupFilter) return false;
      if (typeFilter && detectCalendarType(c.url) !== typeFilter) return false;
      return true;
    });
  }, [calendars, query, groupFilter, typeFilter]);

  const presentTypes = useMemo(
    () => (Object.keys(CALENDAR_TYPES) as CalendarType[]).filter((t) => calendars.some((c) => detectCalendarType(c.url) === t)),
    [calendars],
  );
  const pinned = visible.filter((c) => c.pinned);
  const groupIds = new Set(groups.map((g) => g.id));
  const sectionOf = (c: CalendarLink) => (c.groupId && groupIds.has(c.groupId) ? c.groupId : UNGROUPED);

  const sections: { id: string; group: CalendarGroup | null }[] = [
    ...groups.map((g) => ({ id: g.id, group: g })),
    { id: UNGROUPED, group: null },
  ].filter((s) => !groupFilter || s.id === groupFilter);

  // ---------- calendar CRUD ----------
  const saveCalendar = (draft: CalendarDraft) => {
    if (calModal.editing) {
      const id = calModal.editing.id;
      setCalendars((all) => all.map((c) => (c.id === id ? { ...c, ...draft } : c)));
      toast(`${draft.emoji} Calendar updated`);
    } else {
      setCalendars((all) => [...all, { id: uid(), ...draft, pinned: false, createdAt: new Date().toISOString() }]);
      toast(`${draft.emoji} ${draft.name} added — nice!`);
    }
    setCalModal((m) => ({ ...m, open: false }));
  };

  const deleteCalendar = (cal: CalendarLink) => {
    const index = calendars.findIndex((c) => c.id === cal.id);
    setCalendars((all) => all.filter((c) => c.id !== cal.id));
    toast(`Deleted ${cal.emoji} ${cal.name}`, {
      label: 'Undo',
      onClick: () =>
        setCalendars((all) => (all.some((c) => c.id === cal.id) ? all : [...all.slice(0, index), cal, ...all.slice(index)])),
    });
  };

  const toggleSync = (cal: CalendarLink, enabled: boolean) => {
    setCalendars((all) => all.map((c) => (c.id === cal.id ? { ...c, sync: enabled } : c)));
    toast(enabled ? `🔄 Syncing ${cal.emoji} ${cal.name}…` : `Sync off for ${cal.emoji} ${cal.name}`);
  };

  const togglePin = (cal: CalendarLink) => {
    setCalendars((all) => all.map((c) => (c.id === cal.id ? { ...c, pinned: !c.pinned } : c)));
    toast(cal.pinned ? 'Unpinned' : '⭐ Pinned to the top (and your dashboard)');
  };

  // ---------- groups ----------
  const saveGroup = (data: { name: string; color: number }) => {
    if (groupModal.editing) {
      const id = groupModal.editing.id;
      setGroups((all) => all.map((g) => (g.id === id ? { ...g, ...data } : g)));
      toast('Group updated 🗂️');
    } else {
      setGroups((all) => [...all, { id: uid(), ...data }]);
      toast(`${data.name} created 🗂️`);
    }
    setGroupModal({ open: false, editing: null });
  };

  const deleteGroup = (group: CalendarGroup) => {
    const gIndex = groups.findIndex((g) => g.id === group.id);
    const moved = calendars.filter((c) => c.groupId === group.id).map((c) => c.id);
    setGroups((all) => all.filter((g) => g.id !== group.id));
    setCalendars((all) => all.map((c) => (c.groupId === group.id ? { ...c, groupId: null } : c)));
    if (groupFilter === group.id) setGroupFilter(null);
    toast(`Deleted ${group.name}${moved.length ? ` · ${moved.length} moved to Ungrouped` : ''}`, {
      label: 'Undo',
      onClick: () => {
        setGroups((all) => (all.some((g) => g.id === group.id) ? all : [...all.slice(0, gIndex), group, ...all.slice(gIndex)]));
        setCalendars((all) => all.map((c) => (moved.includes(c.id) && c.groupId === null ? { ...c, groupId: group.id } : c)));
      },
    });
  };

  const toggleCollapsed = (id: string) =>
    setCollapsed((all) => (all.includes(id) ? all.filter((x) => x !== id) : [...all, id]));

  // ---------- drag & drop ----------
  const drop = (section: string, beforeId: string | null) => {
    const id = dragId;
    setDragId(null);
    setDropTarget(null);
    if (!id || id === beforeId) return;
    const groupId = section === UNGROUPED ? null : section;
    setCalendars((all) => {
      const moving = all.find((c) => c.id === id);
      if (!moving) return all;
      const rest = all.filter((c) => c.id !== id);
      let idx = beforeId ? rest.findIndex((c) => c.id === beforeId) : -1;
      if (idx === -1) {
        // Append after the last calendar in the target section.
        let last = -1;
        rest.forEach((c, i) => {
          if ((c.groupId && groupIds.has(c.groupId) ? c.groupId : UNGROUPED) === section) last = i;
        });
        idx = last === -1 ? rest.length : last + 1;
      }
      rest.splice(idx, 0, { ...moving, groupId });
      return rest;
    });
    const target = groups.find((g) => g.id === groupId);
    const from = calendars.find((c) => c.id === id);
    if (from && (from.groupId ?? null) !== groupId) toast(`Moved to ${target ? target.name : '📂 Ungrouped'}`);
  };

  const renderCard = (c: CalendarLink, section: string) => (
    <CalendarCard
      key={c.id}
      calendar={c}
      dragging={dragId === c.id}
      dropBefore={dropTarget?.before === c.id && dragId !== c.id}
      syncStatus={calendarSync.statuses[c.id]}
      onToggleSync={(enabled) => toggleSync(c, enabled)}
      onCopy={() => {
        copyText(c.url);
        toast('Link copied 📋');
      }}
      onEdit={() => setCalModal({ open: true, editing: c, groupId: c.groupId })}
      onTogglePin={() => togglePin(c)}
      onDelete={() => deleteCalendar(c)}
      onDragStart={() => setDragId(c.id)}
      onDragEnd={() => {
        setDragId(null);
        setDropTarget(null);
      }}
      onDragOver={() => {
        if (dropTarget?.before !== c.id) setDropTarget({ section, before: c.id });
      }}
      onDrop={() => drop(section, c.id)}
    />
  );

  return (
    <div>
      <PageHeader
        title="Calendars"
        subtitle="All your calendar links, one glassy home. 📅"
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setGroupModal({ open: true, editing: null })}>
              <FolderPlus size={16} /> <span className="hidden sm:inline">New group</span>
            </button>
            <button className="btn-primary" onClick={() => setCalModal({ open: true, editing: null, groupId: groupFilter && groupFilter !== UNGROUPED ? groupFilter : null })}>
              <Plus size={16} /> Add calendar
            </button>
          </div>
        }
      />

      {/* Calendar sync */}
      <Card className="mb-6" hover={false}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-semibold">
              <RefreshCw size={16} className="text-violet-400" /> Calendar sync
            </h2>
            <p className="muted mt-0.5 text-sm">
              Turn on <strong>Sync</strong> for an ICS feed and its events appear as locked blocks in the{' '}
              <button className="font-semibold text-violet-600 hover:underline dark:text-violet-300" onClick={() => navigate('planner')}>Planner</button>{' '}
              and in “Next up”. Feeds refresh every 10 minutes.
            </p>
          </div>
          <SyncStatusPill />
        </div>
        {calendarSync.requestError && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {calendarSync.requestError}
          </p>
        )}
        {!calendarSync.requestError && calendarSync.errorCount > 0 && (
          <ul role="alert" className="mt-3 space-y-1 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">
            {calendarSync.syncedCalendars
              .filter((c) => calendarSync.statuses[c.id]?.state === 'error')
              .map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{c.emoji} {c.name}:</strong> {calendarSync.statuses[c.id]?.error}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <button className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:underline dark:text-violet-300" onClick={() => setHelpOpen((v) => !v)} aria-expanded={helpOpen}>
          <HelpCircle size={15} /> How do I find my calendar's secret ICS address?
          <ChevronDown size={14} className={cn('transition', helpOpen && 'rotate-180')} />
        </button>
        <AnimatePresence initial={false}>
          {helpOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 border-t border-slate-900/10 pt-3 dark:border-white/10">
                <IcsHelp />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Search + filters */}
      <Card className="mb-6 space-y-3 !p-3" hover={false}>
        <div className="relative">
          <Search size={16} className="muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input className="input pl-10" placeholder="Search calendars…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search calendars" />
          {query && (
            <button className="icon-btn absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="muted mr-1 text-[11px] font-semibold uppercase tracking-wider">Group</span>
          <button className={groupFilter === null ? 'chip-on' : 'chip-off'} onClick={() => setGroupFilter(null)}>All</button>
          {groups.map((g) => (
            <button key={g.id} className={groupFilter === g.id ? 'chip-on' : 'chip-off'} onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}>
              <span className="h-2 w-2 rounded-full" style={{ background: gradient(g.color) }} />
              {g.name}
            </button>
          ))}
          <button className={groupFilter === UNGROUPED ? 'chip-on' : 'chip-off'} onClick={() => setGroupFilter(groupFilter === UNGROUPED ? null : UNGROUPED)}>📂 Ungrouped</button>
        </div>
        {presentTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="muted mr-1 text-[11px] font-semibold uppercase tracking-wider">Type</span>
            <button className={typeFilter === null ? 'chip-on' : 'chip-off'} onClick={() => setTypeFilter(null)}>All</button>
            {presentTypes.map((t) => (
              <button key={t} className={typeFilter === t ? 'chip-on' : 'chip-off'} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>
                {CALENDAR_TYPES[t].emoji} {CALENDAR_TYPES[t].label}
              </button>
            ))}
          </div>
        )}
      </Card>

      {calendars.length === 0 ? (
        <Card>
          <EmptyState emoji="📅" hint="Add a Google, Outlook, iCloud, Notion or Calendly link to get started." />
          <div className="flex justify-center pb-4">
            <button className="btn-primary" onClick={() => setCalModal({ open: true, editing: null, groupId: null })}>
              <Plus size={16} /> Add calendar
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pinned row */}
          {pinned.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Star size={15} className="fill-amber-400 text-amber-400" /> ⭐ Pinned
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {pinned.map((c) => (
                  <motion.a
                    key={c.id}
                    layout
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ y: -3 }}
                    className="glass group relative flex min-w-[220px] items-center gap-3 overflow-hidden p-3 pr-4 hover:shadow-[0_0_30px_-6px_rgba(139,92,246,0.6)]"
                  >
                    <div className="absolute inset-0 opacity-15 transition group-hover:opacity-25" style={{ background: gradient(c.color) }} />
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: gradient(c.color) }}>
                      {c.emoji}
                    </span>
                    <span className="relative min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <TypeBadge type={detectCalendarType(c.url)} className="mt-0.5" />
                    </span>
                    <ExternalLink size={14} className="muted relative ml-auto shrink-0" />
                  </motion.a>
                ))}
              </div>
            </motion.section>
          )}

          {filtering && visible.length === 0 && (
            <Card>
              <div className="py-6 text-center">
                <div className="text-4xl">🔍</div>
                <p className="mt-2 font-semibold">No calendars match those filters</p>
                <button
                  className="btn-ghost mt-3"
                  onClick={() => {
                    setQuery('');
                    setGroupFilter(null);
                    setTypeFilter(null);
                  }}
                >
                  Clear filters
                </button>
              </div>
            </Card>
          )}

          {/* Group sections */}
          {sections.map(({ id, group }, si) => {
            const items = visible.filter((c) => sectionOf(c) === id);
            const total = calendars.filter((c) => sectionOf(c) === id).length;
            // Hide empty Ungrouped (unless dragging, so it can be a drop target) and empty groups while filtering.
            if (items.length === 0 && (id === UNGROUPED ? !dragId : filtering)) return null;
            const isCollapsed = collapsed.includes(id);
            const isOver = dropTarget?.section === id && dragId !== null;
            return (
              <motion.section
                key={id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * si }}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  if (dropTarget?.section !== id || dropTarget.before !== null) setDropTarget({ section: id, before: null });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(id, null);
                }}
                className={cn('rounded-2xl p-2 transition', isOver && 'bg-violet-500/5 ring-2 ring-violet-400/50')}
              >
                <div className="group/header mb-3 flex items-center gap-2">
                  <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => toggleCollapsed(id)} aria-expanded={!isCollapsed}>
                    <motion.span animate={{ rotate: isCollapsed ? -90 : 0 }} className="muted">
                      <ChevronDown size={18} />
                    </motion.span>
                    <span
                      className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.6)]"
                      style={{ background: group ? gradient(group.color) : 'rgba(148,163,184,0.6)' }}
                    />
                    <h2 className="truncate text-base font-bold">{group ? group.name : '📂 Ungrouped'}</h2>
                    <span className="muted rounded-full bg-slate-900/5 px-2 py-0.5 text-xs dark:bg-white/5">{filtering ? `${items.length}/${total}` : total}</span>
                  </button>
                  <div className="ml-auto flex items-center opacity-100 transition md:opacity-0 md:group-hover/header:opacity-100">
                    <button className="icon-btn h-8 w-8" title="Add calendar to this group" aria-label="Add calendar to this group" onClick={() => setCalModal({ open: true, editing: null, groupId: group?.id ?? null })}>
                      <Plus size={15} />
                    </button>
                    {group && (
                      <>
                        <button className="icon-btn h-8 w-8" title="Rename / recolor" aria-label="Edit group" onClick={() => setGroupModal({ open: true, editing: group })}>
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn h-8 w-8 hover:!text-rose-400" title="Delete group" aria-label="Delete group" onClick={() => deleteGroup(group)}>
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      {items.length === 0 ? (
                        <div className="rounded-2xl border-2 border-dashed border-slate-900/10 p-6 text-center text-sm dark:border-white/10">
                          <span className="muted">{dragId ? 'Drop here to move it into this group ✨' : 'Empty group — drag a calendar here or add one.'}</span>
                        </div>
                      ) : (
                        <div className="grid gap-3 p-0.5 sm:grid-cols-2 xl:grid-cols-3">
                          <AnimatePresence>{items.map((c) => renderCard(c, id))}</AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            );
          })}
          <p className="muted text-center text-xs">
            Tip: drag cards to reorder or move between groups · Google <em>embed</em> links can be previewed inline · ⌘K → “Open calendar…”
          </p>
        </div>
      )}

      <CalendarModal
        open={calModal.open}
        initial={calModal.editing}
        groups={groups}
        defaultGroupId={calModal.groupId}
        onClose={() => setCalModal((m) => ({ ...m, open: false }))}
        onSave={saveCalendar}
      />
      <GroupModal open={groupModal.open} initial={groupModal.editing} onClose={() => setGroupModal({ open: false, editing: null })} onSave={saveGroup} />
    </div>
  );
}
