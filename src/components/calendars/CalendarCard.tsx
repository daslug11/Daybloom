import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, CalendarDays, Copy, ExternalLink, Eye, EyeOff, FolderInput, GripVertical, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { calendarTile, detectCalendarType, isGoogleEmbed, looksLikeFeed } from '../../lib/calendars';
import type { FeedStatus } from '../../hooks/useCalendarSync';
import type { CalendarLink } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Menu, MenuItem } from '../ui/Menu';
import { SyncRow } from './SyncToggle';
import { TypeBadge } from './TypeBadge';

interface Props {
  calendar: CalendarLink;
  dragging: boolean;
  dropBefore: boolean;
  syncStatus?: FeedStatus;
  onToggleSync: (enabled: boolean) => void;
  onCopy: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  /** Keyboard and touch equivalents of dragging; undefined when the card is already at that end. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Undefined when there are no groups to move to. */
  onMoveToGroup?: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function CalendarCard(p: Props) {
  const { calendar: c } = p;
  const [preview, setPreview] = useState(false);
  const reduce = useReducedMotion();
  const type = detectCalendarType(c.url);
  const embeddable = isGoogleEmbed(c.url);
  // Opening a raw .ics/webcal feed just downloads a file, so feeds open in the Planner instead.
  const feed = looksLikeFeed(c.url);
  const primary = 'mr-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-raised';

  const action = 'icon-btn h-8 w-8';

  return (
    <motion.div
      layout
      initial={false}
      animate={{ opacity: p.dragging ? 0.4 : 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      className={cn(preview && 'sm:col-span-2')}
      data-calendar-id={c.id}
    >
      {p.dropBefore && <div className="mb-2 h-0.5 rounded-full bg-ink" />}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', c.id);
          p.onDragStart();
        }}
        onDragEnd={p.onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          p.onDragOver();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          p.onDrop();
        }}
        className="card card-hover group relative flex h-full flex-col overflow-hidden"
      >
        <div className="relative flex items-start gap-3 p-4">
          <GripVertical size={16} className="muted mt-3 hidden shrink-0 cursor-grab opacity-40 group-hover:opacity-100 sm:block" />
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-xl" style={calendarTile(c.color)}>
            {c.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold">{c.name}</h3>
              {c.pinned && <Star size={13} className="shrink-0 fill-warning text-warning" aria-label="Pinned" />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <TypeBadge type={type} />
              <span className="muted truncate text-xs">{hostOf(c.url)}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <SyncRow enabled={!!c.sync} status={p.syncStatus} onToggle={p.onToggleSync} />
        </div>

        <div className="relative mt-auto flex flex-wrap items-center gap-0.5 border-t border-line px-3 py-1.5">
          {feed && c.sync ? (
            <Link to="/app/planner" className={primary}>
              <CalendarDays size={14} aria-hidden /> View in Planner
            </Link>
          ) : feed ? (
            <button className={primary} onClick={p.onCopy}>
              <Copy size={14} aria-hidden /> Copy link
            </button>
          ) : (
            <a href={c.url} target="_blank" rel="noopener noreferrer" className={primary}>
              <ExternalLink size={14} aria-hidden /> Open<span className="sr-only"> {c.name} (opens in a new tab)</span>
            </a>
          )}
          {embeddable && (
            <button className={cn(action, preview && '!text-ink')} onClick={() => setPreview((v) => !v)} title={preview ? 'Hide preview' : 'Preview'} aria-label={preview ? 'Hide preview' : 'Preview'}>
              {preview ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          <Menu label={`More actions for ${c.name}`} trigger={<MoreHorizontal size={15} />}>
            {(close) => (
              <>
                {/* An unsynced feed already has Copy link as its main action. */}
                {!(feed && !c.sync) && (
                  <MenuItem onClick={() => (close(), p.onCopy())}>
                    <Copy size={14} aria-hidden /> Copy link
                  </MenuItem>
                )}
                <MenuItem onClick={() => (close(), p.onEdit())}>
                  <Pencil size={14} aria-hidden /> Edit
                </MenuItem>
                <MenuItem onClick={() => (close(), p.onTogglePin())}>
                  <Star size={14} aria-hidden /> {c.pinned ? 'Unpin' : 'Pin to top'}
                </MenuItem>
                {p.onMoveToGroup && (
                  <MenuItem onClick={() => (close(), p.onMoveToGroup?.())}>
                    <FolderInput size={14} aria-hidden /> Move to group…
                  </MenuItem>
                )}
                <MenuItem disabled={!p.onMoveUp} onClick={() => (close(), p.onMoveUp?.())}>
                  <ArrowUp size={14} aria-hidden /> Move up
                </MenuItem>
                <MenuItem disabled={!p.onMoveDown} onClick={() => (close(), p.onMoveDown?.())}>
                  <ArrowDown size={14} aria-hidden /> Move down
                </MenuItem>
                <MenuItem danger onClick={() => (close(), p.onDelete())}>
                  <Trash2 size={14} aria-hidden /> Delete
                </MenuItem>
              </>
            )}
          </Menu>
        </div>

        <AnimatePresence>
          {preview && embeddable && (
            <motion.div initial={{ height: 0 }} animate={{ height: 420 }} exit={{ height: 0 }} className="relative overflow-hidden border-t border-line">
              <iframe
                src={c.url}
                title={`${c.name} preview`}
                className="h-[420px] w-full bg-white"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
