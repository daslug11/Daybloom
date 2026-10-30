import { CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, GripVertical, Inbox, Lock, Repeat, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SyncStatusPill } from '../../components/calendars/SyncStatusPill';
import { MoveRepeatDialog } from '../../components/plans/MoveRepeatDialog';
import { OccurrenceDialog } from '../../components/plans/OccurrenceDialog';
import { PlansSection } from '../../components/plans/PlansSection';
import { RecurringBlockDialog } from '../../components/plans/RecurringBlockDialog';
import { ScheduleDialog } from '../../components/plans/ScheduleDialog';
import { BLOCK_HELP_ID, EventBlock, EventDetailsDialog, laneStyle, PX_PER_MIN, RepeatBlock, SLOT, TaskBlock, TimePill } from '../../components/plans/TimelineBlocks';
import { draftKey, loadSession, saveSession } from '../../components/capture/sessionDraft';
import { QuickAddTask } from '../../components/tasks/QuickAddTask';
import { TaskChips } from '../../components/tasks/TaskChips';
import { AiButton } from '../../components/ui/Ai';
import { PageHeader } from '../../components/ui/PageHeader';
import type { SyncedEvent } from '../../../server/calendar/types';
import type { Occurrence } from '../../../server/data/recurrence';
import { useCalendars } from '../../hooks/data/calendars';
import { usePlanActions, usePlans, useRecurring, useSeries } from '../../hooks/data/plans';
import { useTasks, useToggleTask, useUpdateTask } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import { useUserId } from '../../hooks/useAuth';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { CALENDAR_COLORS } from '../../lib/calendars';
import { parseKey } from '../../lib/dates';
import {
  addDaysKey,
  allDayEventsOn,
  clampStart,
  dayLabel,
  DAY_MINUTES,
  edgeScrollSpeed,
  formatMinutes,
  hourLabel,
  layoutLanes,
  moveBlock,
  nudgeBlock,
  rangeLabel,
  resizeBlock,
  sameBlock,
  slotFloor,
  timedEventsOn,
  weekOf,
  type TimeBlock,
} from '../../lib/planner';
import { formatDuration } from '../../lib/format';
import type { Task } from '../../lib/types';
import { cn } from '../../lib/utils';

const TASK_MIME = 'application/x-daybloom-task';
const DEFAULT_DURATION = 60;
const VIEW_KEY = 'daybloom:planner-view';
/** Touch: how long to hold a block before it lifts (until then the page scrolls as usual). */
const LONG_PRESS_MS = 350;
/** Touch: moving further than this before the lift means the person is scrolling. */
const TOUCH_SLOP = 8;
/** Mouse/pen: movement before a press becomes a drag (smaller moves are clicks). */
const DRAG_THRESHOLD = 4;
/** Keyboard nudges are saved once the keys stop for this long (or on blur). */
const NUDGE_SAVE_MS = 600;

type View = 'day' | 'week';
type Block = TimeBlock;
interface Ghost extends Block {
  task_id: string;
  title: string;
  reason: string;
}
type DragTarget = { kind: 'task'; id: string } | { kind: 'repeat'; id: string; occ: Occurrence };
interface Drag {
  target: DragTarget;
  mode: 'move' | 'resize';
  pointerId: number;
  touch: boolean;
  /** pressing: touch waiting for the long-press · pending: mouse down, not moved yet · dragging: lifted. */
  phase: 'pressing' | 'pending' | 'dragging';
  originX: number;
  originY: number;
  originScroll: number;
  x: number;
  y: number;
  orig: Block;
  preview: Block;
  overSidebar: boolean;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const blockOf = (t: Task): Block | null => (t.sched_date && t.sched_start != null && t.sched_duration ? { date: t.sched_date, start: t.sched_start, duration: t.sched_duration } : null);
const repeatKey = (o: Occurrence) => `${o.series_id}:${o.day}`;

export default function Planner() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: calendars = [] } = useCalendars();
  const { events } = useCalendarSync();
  const update = useUpdateTask();
  const toggle = useToggleTask();
  const toast = useToast();
  const { today, minutes: nowMinutes } = useToday(15_000);
  const planDay = useAi<{ blocks: Ghost[] }>('plan_day');
  const planWeek = useAi<{ blocks: Ghost[] }>('plan_week');

  const [view, setViewState] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || (window.innerWidth < 768 ? 'day' : 'week');
    } catch {
      return 'week';
    }
  });
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const [cursor, setCursor] = useState(today);
  const [dropGhost, setDropGhost] = useState<Block | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Phones: Unscheduled starts folded so the timeline is near the top; picking a task folds it again.
  const wide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  const [listOpen, setListOpen] = useState(wide);
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedId || wide()) return;
    setListOpen(false);
    timelineRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [selectedId]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [nudge, setNudge] = useState<{ id: string; orig: Block; preview: Block } | null>(null);
  const [scheduling, setScheduling] = useState<{ task: Task; initial: Block; scheduled: boolean } | null>(null);
  const [movingRepeat, setMovingRepeat] = useState<{ occ: Occurrence; start: number; duration: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [openOcc, setOpenOcc] = useState<Occurrence | null>(null);
  const [openEvent, setOpenEvent] = useState<SyncedEvent | null>(null);
  /** Repeating-block check-offs in flight: a second tap waits, so a linked goal is never counted twice. */
  const [doneBusy, setDoneBusy] = useState<Set<string>>(() => new Set());
  const doneBusyRef = useRef(new Set<string>());
  const [newRepeat, setNewRepeat] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const days = view === 'week' ? weekOf(cursor) : [cursor];

  // ✨ suggestions survive a reload (this tab only), stored per visible range ("2026-10-26…2026-11-01").
  // Only the range on screen is shown and counted, and suggestions for tasks that have since been
  // scheduled, completed or deleted drop out.
  const uid = useUserId();
  const ghostKey = draftKey(`planner-ghosts:${days[0]}…${days[days.length - 1]}`, uid);
  const [ghostState, setGhostState] = useState<{ key: string; list: Ghost[] }>(() => ({ key: ghostKey, list: loadSession<Ghost[]>(ghostKey) ?? [] }));
  if (ghostState.key !== ghostKey) setGhostState({ key: ghostKey, list: loadSession<Ghost[]>(ghostKey) ?? [] });
  const setGhosts = useCallback((next: Ghost[] | ((list: Ghost[]) => Ghost[])) => {
    setGhostState((st) => {
      const list = typeof next === 'function' ? next(st.list) : next;
      saveSession(st.key, list.length ? list : null);
      return { key: st.key, list };
    });
  }, []);
  const ghosts = useMemo(() => {
    const open = new Set(tasks.filter((t) => !t.done && !t.sched_date).map((t) => t.id));
    return (ghostState.key === ghostKey ? ghostState.list : []).filter((g) => open.has(g.task_id) && days.includes(g.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostState, ghostKey, tasks, days.join()]);
  const calById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const recurring = useRecurring(days[0], days[days.length - 1]);
  const { data: plans = [] } = usePlans();
  const { data: allSeries = [] } = useSeries();
  const planActions = usePlanActions();

  /** Polite screen-reader announcement; a trailing space toggles so repeating the same words is still read. */
  const announce = useCallback((text: string) => setAnnouncement((prev) => (prev === text ? `${text} ` : text)), []);

  // Planner#plans (from a plan card) scrolls to the Plans section once it has rendered.
  useEffect(() => {
    if (window.location.hash !== '#plans') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => document.getElementById('plans')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }), 400);
    return () => window.clearTimeout(id);
  }, []);

  const unscheduled = useMemo(
    () =>
      tasks
        .filter((t) => !t.done && !t.sched_date && !t.parent_id)
        .sort(
          (a, b) =>
            (b.top_date === today ? 1 : 0) - (a.top_date === today ? 1 : 0) ||
            (a.priority ? PRIORITY_ORDER[a.priority] : 3) - (b.priority ? PRIORITY_ORDER[b.priority] : 3) ||
            (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
        ),
    [tasks, today],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const focus = days.includes(today) ? nowMinutes - 90 : 7 * 60;
    el.scrollTop = Math.max(0, focus * PX_PER_MIN);
    // Only when the visible range changes, not on every clock tick.
  }, [view, cursor, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const schedule = useCallback(
    (id: string, b: Block | null) =>
      update.mutate({ id, patch: b ? { sched_date: b.date, sched_start: b.start, sched_duration: b.duration } : { sched_date: null, sched_start: null, sched_duration: null } }),
    [update],
  );
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  /** Schedules (or moves) a task and offers Undo back to where it was. */
  const scheduleWithUndo = useCallback(
    (task: { id: string; title: string }, b: Block | null, before: Block | null, message: string) => {
      scheduleRef.current(task.id, b);
      toast(message, { label: 'Undo', onClick: () => scheduleRef.current(task.id, before) });
    },
    [toast],
  );

  const durationFor = (id: string | null) => {
    const t = tasks.find((x) => x.id === id);
    return Math.max(15, Math.round((t?.estimate_min ?? DEFAULT_DURATION) / 15) * 15);
  };
  /** One anchor rule for drop and tap: the block starts in the 15-minute slot under the pointer. */
  const minuteAt = (column: HTMLElement, clientY: number, duration: number) => clampStart(slotFloor((clientY - column.getBoundingClientRect().top) / PX_PER_MIN), duration);

  /** A sensible first suggestion for the schedule dialog: the next quarter hour today, or 9:00. */
  const suggestBlock = (task: Task): Block => {
    const duration = durationFor(task.id);
    const date = days.includes(today) ? today : days[0];
    const start = date === today ? Math.ceil((nowMinutes + 1) / 15) * 15 : 9 * 60;
    return { date, duration, start: clampStart(start, duration) };
  };
  const openScheduler = (task: Task) => {
    const b = blockOf(task);
    setScheduling({ task, initial: b ?? suggestBlock(task), scheduled: !!b });
  };

  // ---- drag from the Unscheduled list (HTML5 DnD, mouse) ----
  const onColumnDragOver = (e: React.DragEvent<HTMLDivElement>, date: string) => {
    if (!e.dataTransfer.types.includes(TASK_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const duration = durationFor(draggingId);
    const start = minuteAt(e.currentTarget, e.clientY, duration);
    if (!dropGhost || dropGhost.date !== date || dropGhost.start !== start) setDropGhost({ date, start, duration });
  };
  const onColumnDrop = (e: React.DragEvent<HTMLDivElement>, date: string) => {
    const id = e.dataTransfer.getData(TASK_MIME);
    setDropGhost(null);
    setDraggingId(null);
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    e.preventDefault();
    const duration = durationFor(id);
    const start = minuteAt(e.currentTarget, e.clientY, duration);
    scheduleWithUndo(task, { date, start, duration }, null, `Scheduled for ${formatMinutes(start)}`);
    setSelectedId(null);
  };
  // ---- tap to place (touch screens) ----
  const onColumnClick = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    const task = tasks.find((t) => t.id === selectedId);
    if (!task || e.target !== e.currentTarget) return;
    const duration = durationFor(task.id);
    const start = minuteAt(e.currentTarget, e.clientY, duration);
    scheduleWithUndo(task, { date, start, duration }, null, `Scheduled for ${formatMinutes(start)}`);
    setSelectedId(null);
  };

  // ---- move / resize blocks (pointer events) ----
  // The live gesture is kept in a ref; React state only changes when what's drawn changes
  // (phase, the snapped preview, or the sidebar hover), not on every pointermove.
  const dragRef = useRef<Drag | null>(null);
  const longPress = useRef(0);
  const suppressClick = useRef(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const publish = (next: Drag | null) => {
    const prev = dragRef.current;
    dragRef.current = next;
    if (!next || !prev || prev.phase !== next.phase || prev.overSidebar !== next.overSidebar || !sameBlock(prev.preview, next.preview) || prev.target.id !== next.target.id) setDrag(next);
  };

  const previewAt = (cur: Drag): Drag => {
    const scroller = scrollRef.current;
    const dy = cur.y - cur.originY + ((scroller?.scrollTop ?? 0) - cur.originScroll);
    const delta = dy / PX_PER_MIN;
    if (cur.mode === 'resize') return { ...cur, preview: resizeBlock(cur.orig, delta), overSidebar: false };
    let date = cur.orig.date;
    if (cur.target.kind === 'task') {
      for (const [key, el] of columnRefs.current) {
        const r = el.getBoundingClientRect();
        if (cur.x >= r.left && cur.x < r.right) date = key;
      }
    }
    const sb = sidebarRef.current?.getBoundingClientRect();
    const overSidebar = cur.target.kind === 'task' && !!sb && cur.x >= sb.left && cur.x <= sb.right && cur.y >= sb.top && cur.y <= sb.bottom;
    return { ...cur, preview: moveBlock(cur.orig, delta, date), overSidebar };
  };

  const endDrag = useCallback(() => {
    window.clearTimeout(longPress.current);
    dragRef.current = null;
    setDrag(null);
  }, []);

  const startDrag = (e: React.PointerEvent, target: DragTarget, block: Block, mode: Drag['mode']) => {
    // One gesture at a time: a second finger never takes over the first drag.
    if (e.button !== 0 || dragRef.current) return;
    e.stopPropagation();
    const touch = e.pointerType === 'touch';
    const d: Drag = {
      target,
      mode,
      pointerId: e.pointerId,
      touch,
      phase: touch ? 'pressing' : 'pending',
      originX: e.clientX,
      originY: e.clientY,
      originScroll: scrollRef.current?.scrollTop ?? 0,
      x: e.clientX,
      y: e.clientY,
      orig: block,
      preview: block,
      overSidebar: false,
    };
    publish(d);
    if (touch) {
      longPress.current = window.setTimeout(() => {
        const cur = dragRef.current;
        if (!cur || cur.pointerId !== d.pointerId || cur.phase !== 'pressing') return;
        navigator.vibrate?.(10);
        publish({ ...cur, phase: 'dragging' });
      }, LONG_PRESS_MS);
    }
  };

  const commitDrag = useCallback(
    (cur: Drag) => {
      if (cur.target.kind === 'repeat') {
        if (!sameBlock(cur.preview, cur.orig)) setMovingRepeat({ occ: cur.target.occ, start: cur.preview.start, duration: cur.preview.duration });
        return;
      }
      const task = tasksRef.current.find((t) => t.id === cur.target.id);
      if (!task) return;
      if (cur.overSidebar) return scheduleWithUndo(task, null, cur.orig, 'Moved back to Unscheduled');
      if (sameBlock(cur.preview, cur.orig)) return;
      const p = cur.preview;
      const message =
        cur.mode === 'resize'
          ? `Now ${rangeLabel(p.start, p.duration)} (${formatDuration(p.duration)})`
          : `Moved to ${p.date !== cur.orig.date ? `${dayLabel(p.date)}, ` : ''}${rangeLabel(p.start, p.duration)}`;
      scheduleWithUndo(task, p, cur.orig, message);
    },
    [scheduleWithUndo],
  );

  // Window-level listeners for the gesture in progress.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur || e.pointerId !== cur.pointerId) return;
      const dist = Math.hypot(e.clientX - cur.originX, e.clientY - cur.originY);
      if (cur.phase === 'pressing') {
        // Moved before the long-press: they're scrolling, so let the page have it.
        if (dist > TOUCH_SLOP) endDrag();
        return;
      }
      let next: Drag = { ...cur, x: e.clientX, y: e.clientY };
      if (cur.phase === 'pending') {
        if (dist < DRAG_THRESHOLD) return;
        next.phase = 'dragging';
      }
      next = previewAt(next);
      publish(next);
    };
    const onUp = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur || e.pointerId !== cur.pointerId) return;
      endDrag();
      if (cur.phase !== 'dragging') return;
      // The click that follows a drag must not open the block's dialog.
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      commitDrag(cur);
    };
    const cancel = (announceIt: boolean) => {
      const cur = dragRef.current;
      if (!cur) return;
      endDrag();
      if (cur.phase === 'dragging') {
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 400);
        if (announceIt) announce('Move cancelled');
      }
    };
    const onCancel = (e: PointerEvent) => {
      if (dragRef.current && e.pointerId === dragRef.current.pointerId) cancel(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !dragRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      cancel(true);
    };
    const onBlur = () => cancel(false);
    // Once a touch drag has lifted, the finger moves the block, not the page.
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.touch && dragRef.current.phase === 'dragging' && e.cancelable) e.preventDefault();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [commitDrag, endDrag, announce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll while dragging near the top or bottom of the timeline: faster the closer to the edge,
  // and it keeps going while the pointer rests there.
  const dragging = drag?.phase === 'dragging';
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const tick = () => {
      const cur = dragRef.current;
      const scroller = scrollRef.current;
      if (cur && scroller) {
        const r = scroller.getBoundingClientRect();
        const speed = edgeScrollSpeed(cur.y, r.top, r.bottom);
        if (speed) {
          const before = scroller.scrollTop;
          scroller.scrollTop += speed;
          if (scroller.scrollTop !== before) publish(previewAt(cur));
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- keyboard: ↑/↓ move, Shift+↑/↓ resize, ←/→ change day, Escape reverts ----
  const nudgeRef = useRef(nudge);
  nudgeRef.current = nudge;
  const nudgeTimer = useRef(0);
  const refocus = useRef<string | null>(null);

  const saveNudge = useCallback(() => {
    window.clearTimeout(nudgeTimer.current);
    const n = nudgeRef.current;
    if (!n) return;
    nudgeRef.current = null;
    setNudge(null);
    if (!sameBlock(n.preview, n.orig)) scheduleRef.current(n.id, n.preview);
  }, []);
  useEffect(() => () => saveNudge(), [saveNudge]);

  const onBlockKey = (e: React.KeyboardEvent, task: Task, block: Block) => {
    if (e.key === 'Escape') {
      const n = nudgeRef.current;
      if (!n || n.id !== task.id) return;
      e.preventDefault();
      e.stopPropagation();
      window.clearTimeout(nudgeTimer.current);
      nudgeRef.current = null;
      setNudge(null);
      refocus.current = task.id;
      if (n.orig.date !== n.preview.date && !days.includes(n.orig.date)) setCursor(n.orig.date);
      announce(`Change undone. ${dayLabel(n.orig.date)}, ${rangeLabel(n.orig.start, n.orig.duration)}`);
      return;
    }
    const current = nudgeRef.current?.id === task.id ? nudgeRef.current : null;
    const base = current?.preview ?? block;
    const next = nudgeBlock(base, e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    if (current === null && nudgeRef.current) saveNudge();
    const n = { id: task.id, orig: current?.orig ?? block, preview: next };
    nudgeRef.current = n;
    setNudge(n);
    if (next.date !== base.date) {
      refocus.current = task.id;
      if (!days.includes(next.date)) setCursor(next.date);
    }
    if (sameBlock(next, base)) announce(e.shiftKey ? 'Can’t change the length any further' : 'Can’t move any further');
    else if (e.shiftKey) announce(`Length ${formatDuration(next.duration)}, ends ${formatMinutes((next.start + next.duration) % DAY_MINUTES)}`);
    else announce(`${next.date !== base.date ? `${dayLabel(next.date)}, ` : ''}${rangeLabel(next.start, next.duration)}`);
    window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(saveNudge, NUDGE_SAVE_MS);
  };
  const onBlockBlur = (id: string) => {
    // Moving to another day re-mounts the block; focus comes straight back, so don't save yet.
    window.setTimeout(() => {
      if ((document.activeElement as HTMLElement | null)?.dataset?.blockHandle !== id && refocus.current !== id) saveNudge();
    }, 0);
  };
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    const el = document.querySelector<HTMLElement>(`[data-block-handle="${id}"]`);
    if (el && document.activeElement !== el) el.focus({ preventScroll: false });
    if (el) refocus.current = null;
  });

  const blockFor = (t: Task) => {
    if (drag?.target.kind === 'task' && drag.target.id === t.id) return drag.preview;
    if (nudge?.id === t.id) return nudge.preview;
    return blockOf(t);
  };
  const repeatBlockFor = (o: Occurrence): Block => {
    if (drag?.target.kind === 'repeat' && drag.target.id === repeatKey(o)) return drag.preview;
    if (movingRepeat && repeatKey(movingRepeat.occ) === repeatKey(o)) return { date: o.day, start: movingRepeat.start, duration: movingRepeat.duration };
    return { date: o.day, start: o.start, duration: o.duration };
  };
  const afterClick = (fn: () => void) => () => {
    if (suppressClick.current) return;
    fn();
  };

  // ---- ✨ plan my day / week ----
  const runPlan = () => {
    // Saved under the range it was asked for, even if the view has moved on by the time it answers.
    const key = ghostKey;
    const opts = {
      onSuccess: (r: { result: { blocks: Ghost[] } }) => {
        const list = r.result.blocks.map((b) => ({ ...b, start: b.start, duration: b.duration }));
        saveSession(key, list.length ? list : null);
        setGhostState((st) => (st.key === key ? { key, list } : st));
        if (!r.result.blocks.length) toast('No free slots or suitable tasks to plan.');
      },
    };
    if (view === 'day') planDay.mutate({ date: cursor }, opts);
    else planWeek.mutate({ date: cursor }, opts);
  };
  const sameGhost = (a: Ghost, b: Ghost) => a.task_id === b.task_id && a.date === b.date && a.start === b.start;
  const acceptGhost = (g: Ghost) => {
    schedule(g.task_id, { date: g.date, start: g.start, duration: g.duration });
    setGhosts((list) => list.filter((x) => !sameGhost(x, g)));
  };
  /** Dismissing one suggestion, or discarding them all, can be undone (they cost an ✨ action). */
  const dismissGhosts = (gone: Ghost[]) => {
    if (!gone.length) return;
    setGhosts((list) => list.filter((x) => !gone.some((g) => sameGhost(x, g))));
    const message = gone.length === 1 ? `Dismissed the suggestion for “${gone[0].title}”` : `Discarded ${gone.length} suggestions`;
    toast(message, { label: 'Undo', onClick: () => setGhosts((list) => [...list.filter((x) => !gone.some((g) => sameGhost(x, g))), ...gone]) });
  };
  const toggleRepeatDone = (occ: Occurrence) => {
    const k = repeatKey(occ);
    // The ref catches a second tap in the same frame, before React has re-rendered.
    if (doneBusyRef.current.has(k)) return;
    doneBusyRef.current.add(k);
    setDoneBusy((st) => new Set(st).add(k));
    planActions
      .setDone(occ, !occ.done, plans.find((p) => p.id === occ.plan_id))
      .catch(() => toast('That change could not be saved.'))
      .finally(() => {
        doneBusyRef.current.delete(k);
        setDoneBusy((st) => {
          const n = new Set(st);
          n.delete(k);
          return n;
        });
      });
  };

  const shift = (dir: number) => setCursor((c) => addDaysKey(c, dir * (view === 'week' ? 7 : 1)));
  const rangeTitle =
    view === 'week'
      ? `${parseKey(days[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parseKey(days[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : parseKey(cursor).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedTask = tasks.find((t) => t.id === selectedId);
  const lifted = drag?.phase === 'dragging' ? drag : null;
  const pillLabel = (d: Drag) => `${view === 'week' && d.preview.date !== d.orig.date ? `${dayLabel(d.preview.date)} · ` : ''}${rangeLabel(d.preview.start, d.preview.duration)}`;

  return (
    <div className={cn(lifted && 'select-none')}>
      <PageHeader
        title="Planner"
        description="Time-block your day: drag a task onto the timeline, or tap it and then a time. Drag blocks to move them and pull the bottom edge to resize (on a touch screen, press and hold first). Synced calendar events are locked."
        actions={
          <>
            <button className="chip-off" onClick={() => setNewRepeat(true)}>
              <Repeat size={13} aria-hidden /> Repeating block
            </button>
            <SyncStatusPill />
          </>
        }
      />

      <p id={BLOCK_HELP_ID} className="sr-only">
        Up and down arrows move the block 15 minutes. Shift with up or down changes its length. Left and right arrows move it a day. Escape undoes the change. Enter opens its time.
      </p>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div ref={sidebarRef} className="lg:sticky lg:top-20 lg:self-start" data-tour="planner-unscheduled">
          <div className={cn('card p-4 transition-colors', lifted?.overSidebar && 'border-ink/40 ring-2 ring-ink/30')}>
            <h2 className="text-sm font-semibold">
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 text-left lg:pointer-events-none lg:min-h-0"
                onClick={() => setListOpen((o) => !o)}
                aria-expanded={listOpen}
                aria-controls="planner-unscheduled"
              >
                <Inbox size={16} className="text-muted" aria-hidden /> Unscheduled
                <span className="faint ml-auto text-xs font-normal">{unscheduled.length}</span>
                <ChevronDown size={16} className={cn('faint transition-transform duration-fast ease-out lg:hidden', listOpen && 'rotate-180')} aria-hidden />
              </button>
            </h2>
            <div id="planner-unscheduled" className={cn('mt-3', !listOpen && 'hidden lg:block')}>
            <QuickAddTask inset className="mb-3" placeholder="Add… “review PR 3pm for 30m”" />
            {lifted?.overSidebar && <div className="mb-2 rounded-control border-2 border-dashed border-ink/40 p-3 text-center text-xs font-medium">Drop to unschedule</div>}
            <div className="-mx-1 max-h-56 divide-y divide-line overflow-y-auto px-1 lg:max-h-[calc(100vh-22rem)]">
              {!isLoading && unscheduled.length === 0 && (
                <p className="muted py-4 text-center text-sm">Everything open is scheduled. Add a task above, or drag a block here to unschedule it.</p>
              )}
              {unscheduled.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TASK_MIME, t.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingId(t.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropGhost(null);
                  }}
                  className={cn(
                    'flex cursor-grab items-start gap-1 rounded-control text-sm transition-colors duration-fast active:cursor-grabbing',
                    selectedId === t.id ? 'bg-raised ring-2 ring-inset ring-ink' : 'hover:bg-raised',
                    draggingId === t.id && 'opacity-40',
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedId === t.id}
                    onClick={() => setSelectedId((s) => (s === t.id ? null : t.id))}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelectedId((s) => (s === t.id ? null : t.id)))}
                    className="flex min-w-0 flex-1 items-start gap-2 rounded-control py-2.5 pl-1.5"
                  >
                    <GripVertical size={14} className="faint mt-0.5 shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">
                        {t.top_date === today && '⭐ '}
                        {t.title}
                      </p>
                      <TaskChips className="mt-1" due={t.due_date ?? undefined} tags={t.tags} priority={t.priority ?? undefined} duration={t.estimate_min ?? undefined} size={10} />
                    </div>
                  </div>
                  <button className="icon-btn my-1.5 h-9 w-9 shrink-0" onClick={() => openScheduler(t)} aria-label={`Pick a time for “${t.title}”`} title="Pick a time">
                    <CalendarClock size={16} />
                  </button>
                </div>
              ))}
            </div>
            <p className="faint mt-3 text-xs">Tip: tap a task, then tap a time on the timeline, or use its clock button to pick a day and time.</p>
            </div>
          </div>
        </div>

        <div ref={timelineRef} className="card min-w-0 scroll-mt-20 !p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div
              className="flex rounded-xl border border-line p-0.5"
              role="tablist"
              aria-label="View"
              onKeyDown={(e) => {
                // APG tabs: the arrows, Home and End switch view; focus follows.
                const to = e.key === 'ArrowLeft' || e.key === 'Home' ? 'day' : e.key === 'ArrowRight' || e.key === 'End' ? 'week' : null;
                if (!to) return;
                e.preventDefault();
                setView(to);
                document.getElementById(`planner-tab-${to}`)?.focus();
              }}
            >
              {(['day', 'week'] as const).map((v) => (
                <button
                  key={v}
                  id={`planner-tab-${v}`}
                  role="tab"
                  aria-selected={view === v}
                  aria-controls="planner-timeline"
                  tabIndex={view === v ? 0 : -1}
                  onClick={() => setView(v)}
                  className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize', view === v ? 'bg-accent text-accent-ink' : 'muted')}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center">
              <button className="icon-btn h-8 w-8" onClick={() => shift(-1)} aria-label={`Previous ${view}`}>
                <ChevronLeft size={16} />
              </button>
              <button className="chip-off" onClick={() => setCursor(today)}>
                Today
              </button>
              <button className="icon-btn h-8 w-8" onClick={() => shift(1)} aria-label={`Next ${view}`}>
                <ChevronRight size={16} />
              </button>
            </div>
            <h2 className="text-sm font-bold">{rangeTitle}</h2>
            <AiButton size="sm" className="ml-auto" loading={planDay.isPending || planWeek.isPending} onClick={runPlan} hint="Suggest time blocks for your open tasks around your calendar">
              Plan my {view}
            </AiButton>
          </div>

          {ghosts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-ink/40 bg-ink/[0.06] px-4 py-2 text-sm">
              <span>
                ✨ {ghosts.length} suggested block{ghosts.length === 1 ? '' : 's'} (dashed). Accept the ones you like.
              </span>
              <button
                className="btn-primary ml-auto !px-3 !py-1"
                onClick={() => {
                  ghosts.forEach((g) => schedule(g.task_id, { date: g.date, start: g.start, duration: g.duration }));
                  toast(`Scheduled ${ghosts.length} block${ghosts.length === 1 ? '' : 's'}`);
                  setGhosts((list) => list.filter((x) => !ghosts.some((g) => sameGhost(x, g))));
                }}
              >
                Accept all
              </button>
              <button className="btn-ghost !px-3 !py-1" onClick={() => dismissGhosts(ghosts)}>
                Discard
              </button>
            </div>
          )}
          {selectedTask && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-ink/[0.06] px-4 py-2 text-xs">
              <span className="min-w-0">
                Tap a time to schedule <strong>“{selectedTask.title}”</strong>
              </span>
              <span className="ml-auto flex items-center gap-3">
                <button className="link" onClick={() => openScheduler(selectedTask)}>
                  Pick a time…
                </button>
                <button className="link" onClick={() => setSelectedId(null)}>
                  Cancel
                </button>
              </span>
            </div>
          )}

          <div id="planner-timeline" role="tabpanel" aria-labelledby={`planner-tab-${view}`} className="overflow-x-auto">
            <div className={cn(view === 'week' && 'min-w-[760px]')}>
              <div className="flex border-b border-line">
                <div className="w-14 shrink-0" />
                {days.map((d) => {
                  const date = parseKey(d);
                  const allDay = allDayEventsOn(events, d);
                  return (
                    <div key={d} className="min-w-0 flex-1 border-l border-line px-1.5 py-2">
                      <button
                        className="flex w-full items-baseline justify-center gap-1.5"
                        onClick={() => {
                          setCursor(d);
                          setView('day');
                        }}
                        aria-label={`Open ${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} in day view`}
                      >
                        <span className="muted text-xs font-medium">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                        <span className={cn('flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-bold', d === today && 'bg-accent text-accent-ink')}>{date.getDate()}</span>
                      </button>
                      {allDay.map((e) => {
                        const c = CALENDAR_COLORS[calById.get(e.calendarId)?.color ?? 1] ?? CALENDAR_COLORS[1];
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setOpenEvent(e)}
                            aria-haspopup="dialog"
                            aria-label={`All-day calendar event: ${e.title} (synced, read-only)`}
                            className="striped mt-1 flex w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-left text-xs font-semibold"
                            style={{ '--stripe': `${c.hex}55`, borderColor: `${c.hex}99` } as React.CSSProperties}
                            title={`${e.title} (all day, synced)`}
                          >
                            <Lock size={9} className="shrink-0 opacity-60" aria-hidden /> <span className="truncate">{e.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div ref={scrollRef} className="relative max-h-[68vh] overflow-y-auto">
                <div className="flex" style={{ height: DAY_MINUTES * PX_PER_MIN }}>
                  <div className="relative w-14 shrink-0" aria-hidden>
                    {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                      <div key={h} className="faint absolute right-2 -translate-y-1/2 text-xs tabular-nums" style={{ top: h * 60 * PX_PER_MIN }}>
                        {hourLabel(h)}
                      </div>
                    ))}
                  </div>
                  {days.map((d) => {
                    const dayEvents = timedEventsOn(events, d);
                    const dayTasks = tasks.map((t) => ({ task: t, block: blockFor(t) })).filter((x): x is { task: Task; block: Block } => x.block?.date === d);
                    const dayGhosts = ghosts.filter((g) => g.date === d);
                    const dayRepeats = recurring.filter((o) => o.day === d).map((o) => ({ occ: o, block: repeatBlockFor(o) }));
                    const lanes = layoutLanes([
                      ...dayRepeats.map(({ occ, block }) => ({ id: `r:${occ.series_id}`, start: block.start, end: block.start + block.duration })),
                      ...dayEvents.map((e) => ({ id: `e:${e.event.id}`, start: e.start, end: e.end })),
                      ...dayTasks.map((x) => ({ id: `t:${x.task.id}`, start: x.block.start, end: x.block.start + x.block.duration })),
                      ...dayGhosts.map((g) => ({ id: `g:${g.task_id}`, start: g.start, end: g.start + g.duration })),
                    ]);
                    const liftedLane = lifted && lifted.preview.date === d ? lanes.get(lifted.target.kind === 'task' ? `t:${lifted.target.id}` : `r:${lifted.target.occ.series_id}`) : undefined;
                    return (
                      <div
                        key={d}
                        ref={(el) => {
                          if (el) columnRefs.current.set(d, el);
                          else columnRefs.current.delete(d);
                        }}
                        data-date={d}
                        onDragOver={(e) => onColumnDragOver(e, d)}
                        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropGhost(null)}
                        onDrop={(e) => onColumnDrop(e, d)}
                        onClick={(e) => onColumnClick(e, d)}
                        className={cn('relative min-w-0 flex-1 border-l border-line', d === today && 'bg-ink/[0.03]', selectedId && 'cursor-copy')}
                        style={{
                          backgroundImage: `repeating-linear-gradient(to bottom, var(--hour-line) 0 1px, transparent 1px ${SLOT * 4}px), repeating-linear-gradient(to bottom, var(--slot-line) 0 1px, transparent 1px ${SLOT}px)`,
                        }}
                      >
                        {/* Where the lifted block came from, so the move is easy to judge (and to abandon with Escape). */}
                        {lifted && lifted.orig.date === d && !sameBlock(lifted.preview, lifted.orig) && (
                          <div
                            className="pointer-events-none absolute inset-x-1 z-10 rounded-lg border-2 border-dashed border-ink/30"
                            style={{ top: lifted.orig.start * PX_PER_MIN, height: lifted.orig.duration * PX_PER_MIN - 1 }}
                            aria-hidden
                          />
                        )}
                        {dayEvents.map((de) => (
                          <EventBlock key={de.event.id} de={de} lane={lanes.get(`e:${de.event.id}`)} calendar={calById.get(de.event.calendarId)} onOpen={() => setOpenEvent(de.event)} />
                        ))}
                        {dayRepeats.map(({ occ, block }) => (
                          <RepeatBlock
                            key={repeatKey(occ)}
                            occ={occ}
                            block={block}
                            lane={lanes.get(`r:${occ.series_id}`)}
                            lifted={lifted?.target.id === repeatKey(occ)}
                            onMoveStart={(e) => startDrag(e, { kind: 'repeat', id: repeatKey(occ), occ }, { date: occ.day, start: occ.start, duration: occ.duration }, 'move')}
                            onResizeStart={(e) => startDrag(e, { kind: 'repeat', id: repeatKey(occ), occ }, { date: occ.day, start: occ.start, duration: occ.duration }, 'resize')}
                            onOpen={afterClick(() => setOpenOcc(occ))}
                            doneBusy={doneBusy.has(repeatKey(occ))}
                            onToggleDone={() => toggleRepeatDone(occ)}
                          />
                        ))}
                        {dayTasks.map(({ task, block }) => (
                          <TaskBlock
                            key={task.id}
                            task={task}
                            block={block}
                            lane={lanes.get(`t:${task.id}`)}
                            lifted={lifted?.target.id === task.id}
                            fading={lifted?.target.id === task.id && lifted.overSidebar}
                            onMoveStart={(e) => {
                              saveNudge();
                              startDrag(e, { kind: 'task', id: task.id }, block, 'move');
                            }}
                            onResizeStart={(e) => {
                              saveNudge();
                              startDrag(e, { kind: 'task', id: task.id }, block, 'resize');
                            }}
                            onOpen={afterClick(() => {
                              saveNudge();
                              openScheduler(task);
                            })}
                            onKeyDown={(e) => onBlockKey(e, task, block)}
                            onBlur={() => onBlockBlur(task.id)}
                            onToggleDone={() => toggle(task)}
                            onUnschedule={() => scheduleWithUndo(task, null, blockOf(task), 'Moved back to Unscheduled')}
                          />
                        ))}
                        {lifted && lifted.preview.date === d && !lifted.overSidebar && <TimePill block={lifted.preview} lane={liftedLane} label={pillLabel(lifted)} />}
                        {dayGhosts.map((g) => (
                          <div
                            key={`g-${g.task_id}`}
                            className="absolute z-20 overflow-hidden rounded-lg border-2 border-dashed border-ink/50 bg-surface/90 px-1.5 py-0.5 text-xs text-ink"
                            style={{ ...laneStyle(lanes.get(`g:${g.task_id}`)), top: g.start * PX_PER_MIN, height: g.duration * PX_PER_MIN - 1 }}
                            title={`Suggested: ${g.title} — ${g.reason}`}
                          >
                            <div className="flex items-start gap-1.5">
                              <span className="min-w-0 flex-1 truncate font-semibold">✨ {g.title}</span>
                              <button
                                className="relative -my-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-accent-ink before:absolute before:-inset-1 before:content-[''] [@media(pointer:coarse)]:before:-inset-2.5"
                                onClick={() => acceptGhost(g)}
                                aria-label={`Accept suggested block for ${g.title}`}
                              >
                                <Check size={13} />
                              </button>
                              <button
                                className="relative -my-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-raised"
                                onClick={() => dismissGhosts([g])}
                                aria-label={`Dismiss suggestion for ${g.title}`}
                              >
                                <X size={13} />
                              </button>
                            </div>
                            {g.duration >= 45 && (
                              <div className="truncate opacity-80">
                                {formatMinutes(g.start)} · {g.reason}
                              </div>
                            )}
                          </div>
                        ))}
                        {dropGhost?.date === d && (
                          <div
                            className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed border-ink/40 bg-ink/[0.06] px-2 py-1 text-xs font-semibold tabular-nums"
                            style={{ top: dropGhost.start * PX_PER_MIN, height: dropGhost.duration * PX_PER_MIN }}
                          >
                            {rangeLabel(dropGhost.start, dropGhost.duration)}
                          </div>
                        )}
                        {d === today && (
                          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 transition-transform duration-1000 ease-linear" style={{ transform: `translateY(${nowMinutes * PX_PER_MIN}px)` }} aria-hidden>
                            <div className="relative h-0.5 bg-danger">
                              <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-danger" />
                              {view === 'day' && <span className="absolute -top-5 right-2 rounded-md bg-danger px-1.5 py-0.5 text-xs font-semibold tabular-nums text-canvas">{formatMinutes(nowMinutes)}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="faint flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded bg-accent" /> Your tasks
            </span>
            <span className="flex items-center gap-1.5">
              <span className="striped h-3 w-5 rounded" style={{ '--stripe': 'rgb(var(--faint) / 0.55)' } as React.CSSProperties} /> Calendar events (locked)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded border border-line-strong bg-raised" /> Repeating blocks &amp; plans
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded border-2 border-dashed border-ink/40" /> ✨ Suggestions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-5 bg-danger" /> Now
            </span>
          </div>
        </div>
      </div>

      <PlansSection />

      {openOcc && (
        <OccurrenceDialog
          occ={openOcc}
          series={allSeries.find((x) => x.id === openOcc.series_id)}
          plan={plans.find((p) => p.id === openOcc.plan_id)}
          onClose={() => setOpenOcc(null)}
        />
      )}
      {movingRepeat && (
        <MoveRepeatDialog
          occ={movingRepeat.occ}
          series={allSeries.find((x) => x.id === movingRepeat.occ.series_id)}
          start={movingRepeat.start}
          duration={movingRepeat.duration}
          onClose={() => setMovingRepeat(null)}
        />
      )}
      {scheduling && (
        <ScheduleDialog
          title={scheduling.task.title}
          initial={scheduling.initial}
          scheduled={scheduling.scheduled}
          onClose={() => setScheduling(null)}
          onUnschedule={() => {
            scheduleWithUndo(scheduling.task, null, scheduling.initial, 'Moved back to Unscheduled');
            setScheduling(null);
          }}
          onSave={(b) => {
            const { task, initial, scheduled } = scheduling;
            setScheduling(null);
            setSelectedId(null);
            if (scheduled && sameBlock(b, initial)) return;
            scheduleWithUndo(task, b, scheduled ? initial : null, `${scheduled ? 'Moved to' : 'Scheduled for'} ${dayLabel(b.date)}, ${rangeLabel(b.start, b.duration)}`);
            // Keyboard users carry on from the block itself (arrows nudge it).
            refocus.current = task.id;
            // Show the day the block landed on.
            if (!days.includes(b.date)) setCursor(b.date);
          }}
        />
      )}
      {openEvent && <EventDetailsDialog event={openEvent} calendar={calById.get(openEvent.calendarId)} onClose={() => setOpenEvent(null)} />}
      {newRepeat && <RecurringBlockDialog onClose={() => setNewRepeat(false)} initialDay={cursor} />}
    </div>
  );
}
