import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, ExternalLink, Eye, EyeOff, GripVertical, Pencil, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { detectCalendarType, gradient, isGoogleEmbed } from '../../lib/calendars';
import type { FeedStatus } from '../../hooks/useCalendarSync';
import type { CalendarLink } from '../../lib/types';
import { cn } from '../../lib/utils';
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
  const [copied, setCopied] = useState(false);
  const type = detectCalendarType(c.url);
  const embeddable = isGoogleEmbed(c.url);

  const action = 'icon-btn h-8 w-8';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: p.dragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(preview && 'sm:col-span-2')}
    >
      {p.dropBefore && <div className="mb-2 h-1 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 shadow-[0_0_12px_rgba(139,92,246,0.8)]" />}
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
        className="glass glass-hover group relative flex h-full flex-col overflow-hidden"
      >
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: gradient(c.color, '180deg') }} />
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50"
          style={{ background: gradient(c.color) }}
        />
        <div className="relative flex items-start gap-3 p-4 pl-5">
          <GripVertical size={16} className="muted mt-3 hidden shrink-0 cursor-grab opacity-40 group-hover:opacity-100 sm:block" />
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl shadow-lg" style={{ background: gradient(c.color) }}>
            {c.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold">{c.name}</h3>
              {c.pinned && <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <TypeBadge type={type} />
              <span className="muted truncate text-[11px]">{hostOf(c.url)}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <SyncRow enabled={!!c.sync} status={p.syncStatus} onToggle={p.onToggleSync} />
        </div>

        <div className="relative mt-auto flex flex-wrap items-center gap-0.5 border-t border-slate-900/5 px-3 py-1.5 dark:border-white/5">
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-500/10 dark:text-violet-300">
            <ExternalLink size={14} /> Open
          </a>
          {embeddable && (
            <button className={cn(action, preview && '!text-violet-400')} onClick={() => setPreview((v) => !v)} title={preview ? 'Hide preview' : 'Preview'} aria-label={preview ? 'Hide preview' : 'Preview'}>
              {preview ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          <button
            className={action}
            title="Copy link"
            aria-label="Copy link"
            onClick={() => {
              p.onCopy();
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          </button>
          <button className={action} title="Edit" aria-label="Edit" onClick={p.onEdit}>
            <Pencil size={15} />
          </button>
          <button className={action} title={c.pinned ? 'Unpin' : 'Pin'} aria-label={c.pinned ? 'Unpin' : 'Pin'} onClick={p.onTogglePin}>
            <Star size={15} className={c.pinned ? 'fill-amber-400 text-amber-400' : ''} />
          </button>
          <button className={cn(action, 'hover:!text-rose-400')} title="Delete" aria-label="Delete" onClick={p.onDelete}>
            <Trash2 size={15} />
          </button>
        </div>

        <AnimatePresence>
          {preview && embeddable && (
            <motion.div initial={{ height: 0 }} animate={{ height: 420 }} exit={{ height: 0 }} className="relative overflow-hidden border-t border-slate-900/5 dark:border-white/5">
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
