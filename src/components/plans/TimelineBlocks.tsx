import { Check, Lock, MapPin, Repeat, X } from 'lucide-react';
import type { SyncedEvent } from '../../../server/calendar/types';
import type { Occurrence } from '../../../server/data/recurrence';
import { CALENDAR_COLORS } from '../../lib/calendars';
import { DAY_MINUTES, formatMinutes, rangeLabel, SNAP, type DayEvent, type Lane, type TimeBlock } from '../../lib/planner';
import { formatDuration } from '../../lib/quickAdd';
import type { Task } from '../../lib/types';
import { cn } from '../../lib/utils';
import { PRIORITY_STYLES } from '../tasks/TaskChips';
import { Modal } from '../ui/Modal';

/** Pixels per 15-minute slot. */
export const SLOT = 14;
export const PX_PER_MIN = SLOT / SNAP;
/** Id of the hidden instructions every movable block points to with aria-describedby. */
export const BLOCK_HELP_ID = 'planner-block-help';

/**
 * Small controls inside blocks keep their visual size but get a bigger invisible hit area
 * (24px with a mouse, 44px on touch) from a pseudo-element, clipped only by the block itself.
 */
const HIT = "relative before:absolute before:-inset-[5px] before:content-[''] [@media(pointer:coarse)]:before:-inset-[15px]";
/** The block is lifted (being dragged): a little shadow and, motion allowing, a tiny scale. */
const LIFTED = 'z-40 cursor-grabbing shadow-pop motion-safe:scale-[1.02]';
/** Focus ring for the block when its main button has keyboard focus (the button itself sits in a clipped box). */
const FOCUS_RING = 'has-[.block-handle:focus-visible]:ring-2 has-[.block-handle:focus-visible]:ring-ink/70 has-[.block-handle:focus-visible]:ring-offset-2 has-[.block-handle:focus-visible]:ring-offset-canvas';

export function laneStyle(lane: Lane | undefined) {
  const l = lane ?? { lane: 0, lanes: 1 };
  const width = 100 / l.lanes;
  return { left: `calc(${l.lane * width}% + 3px)`, width: `calc(${width}% - 6px)` };
}

/**
 * A synced calendar event: read-only, but a real button so keyboard and screen-reader users can
 * reach it; it opens a small details dialog (EventDetailsDialog).
 */
export function EventBlock({ de, lane, calendar, onOpen }: { de: DayEvent; lane?: Lane; calendar?: { color: number; emoji: string; name: string }; onOpen: () => void }) {
  const c = CALENDAR_COLORS[calendar?.color ?? 1] ?? CALENDAR_COLORS[1];
  const height = (de.end - de.start) * PX_PER_MIN;
  const label = [de.event.title, `${formatMinutes(de.start)} – ${formatMinutes(de.end % DAY_MINUTES)}`, de.event.location, calendar && `${calendar.emoji} ${calendar.name} (synced, read-only)`].filter(Boolean).join('\n');
  return (
    <button
      type="button"
      data-event-id={de.event.id}
      onClick={onOpen}
      className="striped absolute z-10 block overflow-hidden rounded-lg border px-1.5 py-0.5 text-left focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      style={{ ...laneStyle(lane), top: de.start * PX_PER_MIN, height: Math.max(height, SLOT) - 1, '--stripe': `${c.hex}40`, borderColor: `${c.hex}99` } as React.CSSProperties}
      title={label}
      aria-label={`Calendar event: ${label.replace(/\n/g, ', ')}${calendar ? '' : ' (synced, read-only)'}`}
      aria-haspopup="dialog"
    >
      <span className="flex items-center gap-1 truncate text-xs font-semibold leading-tight">
        <Lock size={9} className="shrink-0 opacity-60" aria-hidden />
        <span className="truncate">{de.event.title}</span>
      </span>
      {height >= 34 && (
        <span className="block truncate text-xs opacity-75">
          {formatMinutes(de.start)} – {formatMinutes(de.end % DAY_MINUTES)}
          {de.event.location && (
            <span className="ml-1 inline-flex items-center gap-0.5">
              · <MapPin size={9} aria-hidden /> {de.event.location}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/** Read-only details for a synced event (timed or all-day). Daybloom never edits outside calendars. */
export function EventDetailsDialog({ event, calendar, onClose }: { event: SyncedEvent; calendar?: { emoji: string; name: string }; onClose: () => void }) {
  const when = event.allDay
    ? (() => {
        const [y, m, d] = event.start.split('-').map(Number);
        const [ey, em, ed] = event.end.split('-').map(Number);
        const start = new Date(y, m - 1, d);
        const last = new Date(ey, em - 1, ed - 1);
        const fmt = (x: Date) => x.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        return last > start ? `All day, ${fmt(start)} – ${fmt(last)}` : `All day, ${fmt(start)}`;
      })()
    : (() => {
        const s = new Date(event.start);
        const e = new Date(event.end);
        const day = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        const t = (x: Date) => x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        return `${day}, ${t(s)} – ${t(e)}`;
      })();
  return (
    <Modal open onClose={onClose} title={event.title} className="max-w-sm">
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="label">When</dt>
          <dd>{when}</dd>
        </div>
        {event.location && (
          <div>
            <dt className="label">Where</dt>
            <dd>{event.location}</dd>
          </div>
        )}
        <div>
          <dt className="label">Calendar</dt>
          <dd>{calendar ? `${calendar.emoji} ${calendar.name}` : 'Synced calendar'}</dd>
        </div>
      </dl>
      <p className="muted mt-4 flex items-start gap-1.5 text-sm">
        <Lock size={14} className="mt-0.5 shrink-0" aria-hidden /> Synced and read-only. Change it in the calendar it comes from; Daybloom picks up the change on the next sync.
      </p>
      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

/** Bottom-edge grip. On short blocks it sits just below the block so it can't steal a move. */
function ResizeHandle({ compact, onPointerDown, tone }: { compact: boolean; onPointerDown: (e: React.PointerEvent) => void; tone: 'ink' | 'raised' }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={cn('absolute inset-x-1 z-10 flex cursor-ns-resize items-center justify-center', compact ? '-bottom-2.5 h-2.5' : '-bottom-1 h-3.5')}
      aria-hidden
    >
      <span
        className={cn(
          'h-1 w-8 rounded-full opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-60',
          tone === 'ink' ? 'bg-canvas/80' : 'bg-ink/50',
          compact && 'bg-ink/60',
        )}
      />
    </div>
  );
}

interface RepeatBlockProps {
  occ: Occurrence;
  block: TimeBlock;
  lane?: Lane;
  lifted: boolean;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onOpen: () => void;
  onToggleDone: () => void;
  /** A check-off is saving: the box ignores taps until it's done. */
  doneBusy?: boolean;
}

export function RepeatBlock({ occ, block, lane, lifted, onMoveStart, onResizeStart, onOpen, onToggleDone, doneBusy }: RepeatBlockProps) {
  const height = block.duration * PX_PER_MIN;
  const compact = height < 40;
  const label = `${occ.title}, ${rangeLabel(block.start, block.duration)}`;
  return (
    <div
      onPointerDown={onMoveStart}
      onContextMenu={(e) => lifted && e.preventDefault()}
      className={cn(
        'group absolute z-20 cursor-grab select-none rounded-lg border border-line-strong bg-raised text-ink shadow-card transition-[transform,box-shadow] duration-fast ease-out [-webkit-touch-callout:none] [touch-action:pan-x_pan-y] hover:border-ink/40',
        occ.done && 'bg-surface text-muted',
        lifted && LIFTED,
        FOCUS_RING,
      )}
      style={{ ...laneStyle(lane), top: block.start * PX_PER_MIN, height: height - 1 }}
      title={`${label}${occ.details ? `\n${occ.details}` : ''}\nRepeats weekly`}
    >
      <div className={cn('flex h-full gap-1 overflow-hidden rounded-lg px-1.5', compact ? 'items-center' : 'items-start py-1')}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => !doneBusy && onToggleDone()}
          aria-disabled={doneBusy || undefined}
          aria-busy={doneBusy || undefined}
          aria-label={occ.done ? `Mark “${occ.title}” not done` : `Mark “${occ.title}” done`}
          className={cn(HIT, 'mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-control', occ.done && 'border-ink bg-ink text-canvas', doneBusy && 'opacity-60')}
        >
          {occ.done && <Check size={10} strokeWidth={3} className="animate-check-pop" />}
        </button>
        <button
          className="block-handle min-w-0 flex-1 cursor-[inherit] text-left focus-visible:ring-0"
          onClick={onOpen}
          aria-label={`Repeating block: ${label}`}
          aria-describedby={BLOCK_HELP_ID}
        >
          <span className={cn('flex items-center gap-1 truncate text-xs font-semibold leading-tight', occ.done && 'line-through')}>
            <Repeat size={9} className="shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{occ.title}</span>
          </span>
          {!compact && <span className="muted block truncate text-xs tabular-nums">{rangeLabel(block.start, block.duration)}</span>}
        </button>
      </div>
      <ResizeHandle compact={block.duration < 30} onPointerDown={onResizeStart} tone="raised" />
    </div>
  );
}

interface TaskBlockProps {
  task: Task;
  block: TimeBlock;
  lane?: Lane;
  lifted: boolean;
  fading: boolean;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onOpen: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  onToggleDone: () => void;
  onUnschedule: () => void;
}

export function TaskBlock({ task, block, lane, lifted, fading, onMoveStart, onResizeStart, onOpen, onKeyDown, onBlur, onToggleDone, onUnschedule }: TaskBlockProps) {
  const height = block.duration * PX_PER_MIN;
  const compact = height < 40;
  const range = rangeLabel(block.start, block.duration);
  return (
    <div
      onPointerDown={onMoveStart}
      onContextMenu={(e) => lifted && e.preventDefault()}
      className={cn(
        'group absolute z-20 cursor-grab select-none rounded-lg bg-ink text-canvas shadow-card ring-1 ring-canvas/10 transition-[transform,box-shadow,opacity] duration-fast ease-out [-webkit-touch-callout:none] [touch-action:pan-x_pan-y]',
        lifted && cn(LIFTED, 'ring-2 ring-canvas/60'),
        task.done && 'opacity-55',
        fading && 'opacity-30',
        FOCUS_RING,
      )}
      style={{ ...laneStyle(lane), top: block.start * PX_PER_MIN, height: height - 1 }}
      title={`${task.title}\n${range} (${formatDuration(block.duration)})`}
    >
      <div className={cn('flex h-full gap-1 overflow-hidden rounded-lg px-1.5', compact ? 'items-center' : 'items-start py-1')}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleDone}
          aria-label={task.done ? `Mark “${task.title}” not done` : `Complete “${task.title}”`}
          className={cn(HIT, 'mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-canvas/70', task.done && 'bg-canvas text-ink')}
        >
          {task.done && <Check size={10} strokeWidth={3} className="animate-check-pop" />}
        </button>
        <button
          data-block-handle={task.id}
          className="block-handle min-w-0 flex-1 cursor-[inherit] text-left focus-visible:ring-0"
          onClick={onOpen}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          aria-label={`Task block: ${task.title}${task.priority ? `, ${PRIORITY_STYLES[task.priority].label.toLowerCase()} priority` : ''}, ${range}`}
          aria-describedby={BLOCK_HELP_ID}
        >
          <span className={cn('flex items-center gap-1 truncate text-xs font-semibold leading-tight', task.done && 'line-through')}>
            {task.priority && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_STYLES[task.priority].dot)} aria-hidden />}
            <span className="truncate">{task.title}</span>
          </span>
          {!compact && <span className="block truncate text-xs tabular-nums text-canvas/75">{range}</span>}
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onUnschedule}
          aria-label={`Unschedule “${task.title}”`}
          className={cn(HIT, 'shrink-0 rounded p-0.5 opacity-70 hover:bg-canvas/20 hover:opacity-100 focus:opacity-100')}
        >
          <X size={11} />
        </button>
      </div>
      <ResizeHandle compact={block.duration < 30} onPointerDown={onResizeStart} tone="ink" />
    </div>
  );
}

/** Floating "2:15 PM – 3:00 PM" readout above (or below, near the top) a block being dragged or resized. */
export function TimePill({ block, lane, label }: { block: TimeBlock; lane?: Lane; label: string }) {
  const top = block.start * PX_PER_MIN;
  const below = top < 26;
  return (
    <div
      className="pointer-events-none absolute z-50 flex justify-center"
      style={{ ...laneStyle(lane), top: below ? top + block.duration * PX_PER_MIN + 4 : top - 24 }}
      aria-hidden
    >
      <span className="whitespace-nowrap rounded-md border border-line-strong bg-overlay px-1.5 py-0.5 text-xs font-semibold tabular-nums text-ink shadow-pop">{label}</span>
    </div>
  );
}
