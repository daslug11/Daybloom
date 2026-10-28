import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, GripVertical, Inbox, Lock, MapPin, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { QuickAddBar } from '../components/QuickAddBar';
import { SyncStatusPill } from '../components/SyncStatus';
import { PRIORITY_STYLES, TaskChips } from '../components/TaskChips';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { useCalendars, useTasks } from '../hooks/useData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useNow } from '../hooks/useNow';
import { useToast } from '../hooks/useToast';
import { CALENDAR_COLORS } from '../lib/calendars';
import { celebrate } from '../lib/confetti';
import { dateKey, parseKey } from '../lib/dates';
import {
  addDaysKey,
  allDayEventsOn,
  clampStart,
  DAY_MINUTES,
  formatMinutes,
  hourLabel,
  layoutLanes,
  minutesOfDay,
  SNAP,
  snap,
  timedEventsOn,
  weekOf,
  type DayEvent,
} from '../lib/planner';
import { formatDuration } from '../lib/quickAdd';
import type { Task, TaskSchedule } from '../lib/types';
import { cn } from '../lib/utils';

/** Pixels per 15-minute slot. */
const SLOT = 14;
const PX_PER_MIN = SLOT / SNAP;
const TASK_MIME = 'application/x-daybloom-task';
const DEFAULT_DURATION = 60;

type View = 'day' | 'week';

interface Interaction {
  taskId: string;
  mode: 'move' | 'resize';
  originX: number;
  originY: number;
  originScroll: number;
  orig: TaskSchedule;
  preview: TaskSchedule;
  moved: boolean;
  overSidebar: boolean;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export default function Planner() {
  const [tasks, setTasks] = useTasks();
  const [calendars] = useCalendars();
  const { events, syncing, syncedCalendars } = useCalendarSync();
  const toast = useToast();
  const now = useNow(15_000);
  const today = dateKey(now);

  const [view, setView] = useLocalStorage<View>('daybloom:planner-view', typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week');
  const [cursor, setCursor] = useState(today);
  const [ghost, setGhost] = useState<{ date: string; start: number; duration: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());

  const days = view === 'week' ? weekOf(cursor) : [cursor];
  const calById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);

  const unscheduled = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done' && !t.schedule)
        .sort(
          (a, b) =>
            (PRIORITY_ORDER[a.priority ?? 'low'] + (a.priority ? 0 : 1)) - (PRIORITY_ORDER[b.priority ?? 'low'] + (b.priority ? 0 : 1)) ||
            (a.due ?? '9999').localeCompare(b.due ?? '9999'),
        ),
    [tasks],
  );

  // Start the timeline an hour and a half before "now" (or at 7am on other days).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const focusMinutes = days.includes(today) ? minutesOfDay(new Date()) - 90 : 7 * 60;
    el.scrollTop = Math.max(0, focusMinutes * PX_PER_MIN);
    // Only when the visible range changes, not on every clock tick.
  }, [view, cursor]);

  const scheduleTask = useCallback(
    (id: string, schedule: TaskSchedule | undefined) =>
      setTasks((all) => all.map((t) => (t.id === id ? { ...t, schedule } : t))),
    [setTasks],
  );

  const toggleDone = (task: Task) => {
    const done = task.status !== 'done';
    if (done) celebrate();
    setTasks((all) =>
      all.map((t) => (t.id === task.id ? { ...t, status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : undefined } : t)),
    );
  };

  const minuteAt = (column: HTMLElement, clientY: number, duration: number) => {
    const rect = column.getBoundingClientRect();
    return clampStart(snap((clientY - rect.top) / PX_PER_MIN - duration / 2), duration);
  };

  // ---------- HTML5 drag from the Unscheduled list ----------
  const durationFor = (id: string | null) => tasks.find((t) => t.id === id)?.estimate ?? DEFAULT_DURATION;

  const onColumnDragOver = (e: React.DragEvent<HTMLDivElement>, date: string) => {
    if (!e.dataTransfer.types.includes(TASK_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const duration = durationFor(draggingId);
    const start = minuteAt(e.currentTarget, e.clientY, duration);
    if (!ghost || ghost.date !== date || ghost.start !== start) setGhost({ date, start, duration });
  };

  const onColumnDrop = (e: React.DragEvent<HTMLDivElement>, date: string) => {
    const id = e.dataTransfer.getData(TASK_MIME);
    setGhost(null);
    setDraggingId(null);
    if (!id) return;
    e.preventDefault();
    const duration = durationFor(id);
    const start = minuteAt(e.currentTarget, e.clientY, duration);
    scheduleTask(id, { date, start, duration });
    setSelectedId(null);
    toast(`Scheduled for ${formatMinutes(start)} 🗓️`);
  };

  // Tap-to-place: pick a task in the list, then tap the timeline (works on touch screens too).
  const onColumnClick = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if (!selectedId || e.target !== e.currentTarget) return;
    const duration = durationFor(selectedId);
    const start = clampStart(snap((e.clientY - e.currentTarget.getBoundingClientRect().top) / PX_PER_MIN), duration);
    scheduleTask(selectedId, { date, start, duration });
    setSelectedId(null);
    toast(`Scheduled for ${formatMinutes(start)} 🗓️`);
  };

  // ---------- pointer move / resize of scheduled blocks ----------
  const startInteraction = (e: React.PointerEvent, task: Task, mode: Interaction['mode']) => {
    if (e.button !== 0 || !task.schedule) return;
    e.preventDefault();
    e.stopPropagation();
    setInteraction({
      taskId: task.id,
      mode,
      originX: e.clientX,
      originY: e.clientY,
      originScroll: scrollRef.current?.scrollTop ?? 0,
      orig: task.schedule,
      preview: task.schedule,
      moved: false,
      overSidebar: false,
    });
  };

  // Mirror of `interaction` for the window listeners, so committing happens outside state updaters.
  const interactionRef = useRef<Interaction | null>(null);
  interactionRef.current = interaction;

  useEffect(() => {
    if (!interaction) return;
    const onMove = (e: PointerEvent) => {
      const cur = interactionRef.current;
      if (!cur) return;
      const scroller = scrollRef.current;
      if (scroller && cur.moved) {
        // Auto-scroll only when dragging toward an edge, not just because the block starts near one.
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 40 && e.clientY < cur.originY) scroller.scrollTop -= 12;
        else if (e.clientY > r.bottom - 40 && e.clientY > cur.originY) scroller.scrollTop += 12;
      }
      const dy = e.clientY - cur.originY + ((scroller?.scrollTop ?? 0) - cur.originScroll);
      const deltaMin = snap(dy / PX_PER_MIN);
      const moved = cur.moved || Math.abs(e.clientX - cur.originX) > 3 || Math.abs(e.clientY - cur.originY) > 3;
      let preview: TaskSchedule;
      if (cur.mode === 'resize') {
        preview = { ...cur.orig, duration: Math.max(SNAP, Math.min(DAY_MINUTES - cur.orig.start, cur.orig.duration + deltaMin)) };
      } else {
        let date = cur.orig.date;
        for (const [key, el] of columnRefs.current) {
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX < r.right) date = key;
        }
        preview = { ...cur.orig, date, start: clampStart(cur.orig.start + deltaMin, cur.orig.duration) };
      }
      const sb = sidebarRef.current?.getBoundingClientRect();
      const overSidebar = cur.mode === 'move' && !!sb && e.clientX >= sb.left && e.clientX <= sb.right && e.clientY >= sb.top && e.clientY <= sb.bottom;
      setInteraction({ ...cur, preview, moved, overSidebar });
    };
    const onUp = () => {
      const cur = interactionRef.current;
      setInteraction(null);
      if (!cur?.moved) return;
      if (cur.overSidebar) {
        scheduleTask(cur.taskId, undefined);
        toast('Moved back to Unscheduled 📥');
      } else scheduleTask(cur.taskId, cur.preview);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // Re-bind only when a new interaction starts.
  }, [interaction?.taskId, interaction?.mode, scheduleTask, toast]);

  const scheduleOf = (t: Task) => (interaction?.taskId === t.id ? interaction.preview : t.schedule);

  const shift = (dir: number) => setCursor((c) => addDaysKey(c, dir * (view === 'week' ? 7 : 1)));
  const rangeLabel =
    view === 'week'
      ? `${parseKey(days[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parseKey(days[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : parseKey(cursor).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const selectedTask = tasks.find((t) => t.id === selectedId);
  const nowMinutes = minutesOfDay(now);

  return (
    <div className={cn(interaction && 'select-none')}>
      <PageHeader
        title="Planner"
        subtitle="Time-block your day. Drag tasks onto the timeline, drag to move, pull the bottom edge to resize. ⏱️"
        action={<SyncStatusPill />}
      />

      <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
        {/* ---------- Unscheduled sidebar ---------- */}
        <div ref={sidebarRef} className="lg:sticky lg:top-20 lg:self-start">
          <Card
            hover={false}
            className={cn('!p-4 transition', interaction?.overSidebar && 'border-violet-400/70 shadow-[0_0_40px_-8px_rgba(139,92,246,0.7)]')}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Inbox size={16} className="text-violet-400" /> Unscheduled
              </h2>
              <span className="muted rounded-full bg-slate-900/5 px-2 py-0.5 text-xs dark:bg-white/5">{unscheduled.length}</span>
            </div>
            <QuickAddBar className="mb-3" placeholder="Add… “review PR 3pm for 30m”" />
            {interaction?.overSidebar && (
              <div className="mb-2 rounded-xl border-2 border-dashed border-violet-400/60 p-3 text-center text-xs text-violet-600 dark:text-violet-300">
                Drop to unschedule 📥
              </div>
            )}
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-20rem)]">
              {unscheduled.length === 0 && (
                <div className="py-6 text-center">
                  <div className="text-3xl">🧘</div>
                  <p className="mt-1 text-sm font-medium">Everything's scheduled!</p>
                  <p className="muted text-xs">Add a task above, or drag a block here to unschedule it.</p>
                </div>
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
                    setGhost(null);
                  }}
                  onClick={() => setSelectedId((s) => (s === t.id ? null : t.id))}
                  className={cn(
                    'group flex cursor-grab items-start gap-2 rounded-xl border bg-white/70 p-2.5 text-sm transition active:cursor-grabbing dark:bg-white/[0.06]',
                    selectedId === t.id
                      ? 'border-violet-400 ring-2 ring-violet-400/40'
                      : 'border-slate-900/5 hover:border-violet-400/40 dark:border-white/10',
                    draggingId === t.id && 'opacity-40',
                  )}
                >
                  <GripVertical size={14} className="muted mt-0.5 shrink-0 opacity-50" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{t.title}</p>
                    <TaskChips className="mt-1.5" due={t.due} time={t.dueTime} tags={t.tags} priority={t.priority} duration={t.estimate} />
                  </div>
                </div>
              ))}
            </div>
            <p className="muted mt-3 text-[11px]">Tip: drag a task onto the timeline — or tap it, then tap a time slot.</p>
          </Card>
        </div>

        {/* ---------- Timeline ---------- */}
        <Card hover={false} className="min-w-0 !p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/5 p-3 dark:border-white/5">
            <div className="flex rounded-xl border border-slate-900/10 bg-white/50 p-0.5 dark:border-white/10 dark:bg-white/5">
              {(['day', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition',
                    view === v ? 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow' : 'muted',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center">
              <button className="icon-btn h-8 w-8" onClick={() => shift(-1)} aria-label={`Previous ${view}`}>
                <ChevronLeft size={16} />
              </button>
              <button className="chip-off" onClick={() => setCursor(today)}>Today</button>
              <button className="icon-btn h-8 w-8" onClick={() => shift(1)} aria-label={`Next ${view}`}>
                <ChevronRight size={16} />
              </button>
            </div>
            <h2 className="text-sm font-bold">{rangeLabel}</h2>
            {syncing && !events.length && syncedCalendars.length > 0 && <span className="muted ml-auto text-xs">Loading events…</span>}
          </div>

          <AnimatePresence>
            {selectedTask && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 bg-violet-500/10 px-4 py-2 text-xs text-violet-700 dark:text-violet-200">
                  👆 Tap a time slot to schedule <strong className="truncate">“{selectedTask.title}”</strong>
                  <button className="ml-auto underline" onClick={() => setSelectedId(null)}>Cancel</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-x-auto">
            <div className={cn(view === 'week' && 'min-w-[760px]')}>
              {/* Day headers + all-day row */}
              <div className="flex border-b border-slate-900/5 dark:border-white/5">
                <div className="w-14 shrink-0" />
                {days.map((d) => {
                  const date = parseKey(d);
                  const allDay = allDayEventsOn(events, d);
                  return (
                    <div key={d} className="min-w-0 flex-1 border-l border-slate-900/5 px-1.5 py-2 dark:border-white/5">
                      <button
                        className="flex w-full items-baseline justify-center gap-1.5"
                        onClick={() => {
                          setCursor(d);
                          setView('day');
                        }}
                        title="Open day view"
                      >
                        <span className="muted text-[11px] font-semibold uppercase">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                        <span
                          className={cn(
                            'flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-bold',
                            d === today && 'bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-[0_0_16px_rgba(168,85,247,0.7)]',
                          )}
                        >
                          {date.getDate()}
                        </span>
                      </button>
                      {allDay.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {allDay.map((e) => (
                            <EventChip key={e.id} title={e.title} color={calById.get(e.calendarId)?.color ?? 0} emoji={calById.get(e.calendarId)?.emoji} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Scrollable timeline */}
              <div ref={scrollRef} className="relative max-h-[68vh] overflow-y-auto">
                <div className="flex" style={{ height: DAY_MINUTES * PX_PER_MIN }}>
                  <div className="relative w-14 shrink-0">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="muted absolute right-2 -translate-y-1/2 text-[10px] tabular-nums" style={{ top: h * 60 * PX_PER_MIN }}>
                        {h === 0 ? '' : hourLabel(h)}
                      </div>
                    ))}
                  </div>

                  {days.map((d) => {
                    const dayEvents = timedEventsOn(events, d);
                    const dayTasks = tasks
                      .map((t) => ({ task: t, schedule: scheduleOf(t) }))
                      .filter((x): x is { task: Task; schedule: TaskSchedule } => x.schedule?.date === d);
                    const lanes = layoutLanes([
                      ...dayEvents.map((e) => ({ id: `e:${e.event.id}`, start: e.start, end: e.end })),
                      ...dayTasks.map((x) => ({ id: `t:${x.task.id}`, start: x.schedule.start, end: x.schedule.start + x.schedule.duration })),
                    ]);
                    return (
                      <div
                        key={d}
                        ref={(el) => {
                          if (el) columnRefs.current.set(d, el);
                          else columnRefs.current.delete(d);
                        }}
                        data-date={d}
                        onDragOver={(e) => onColumnDragOver(e, d)}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) setGhost(null);
                        }}
                        onDrop={(e) => onColumnDrop(e, d)}
                        onClick={(e) => onColumnClick(e, d)}
                        className={cn(
                          'relative min-w-0 flex-1 border-l border-slate-900/5 dark:border-white/5',
                          d === today && 'bg-violet-500/[0.03]',
                          selectedId && 'cursor-copy',
                        )}
                        style={{
                          backgroundImage: `repeating-linear-gradient(to bottom, var(--hour-line) 0 1px, transparent 1px ${SLOT * 4}px), repeating-linear-gradient(to bottom, var(--slot-line) 0 1px, transparent 1px ${SLOT}px)`,
                        }}
                      >
                        {dayEvents.map((de) => (
                          <EventBlock key={de.event.id} de={de} lane={lanes.get(`e:${de.event.id}`)} calendar={calById.get(de.event.calendarId)} />
                        ))}

                        {dayTasks.map(({ task, schedule }) => (
                          <TaskBlock
                            key={task.id}
                            task={task}
                            schedule={schedule}
                            lane={lanes.get(`t:${task.id}`)}
                            active={interaction?.taskId === task.id}
                            fading={interaction?.taskId === task.id && interaction.overSidebar}
                            onMoveStart={(e) => startInteraction(e, task, 'move')}
                            onResizeStart={(e) => startInteraction(e, task, 'resize')}
                            onToggleDone={() => toggleDone(task)}
                            onUnschedule={() => {
                              scheduleTask(task.id, undefined);
                              toast('Moved back to Unscheduled 📥');
                            }}
                          />
                        ))}

                        {ghost?.date === d && (
                          <div
                            className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed border-violet-400 bg-violet-500/15 px-2 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-200"
                            style={{ top: ghost.start * PX_PER_MIN, height: ghost.duration * PX_PER_MIN }}
                          >
                            {formatMinutes(ghost.start)} – {formatMinutes(ghost.start + ghost.duration)}
                          </div>
                        )}

                        {d === today && (
                          <div className="pointer-events-none absolute inset-x-0 z-30 transition-[top] duration-1000 ease-linear" style={{ top: nowMinutes * PX_PER_MIN }}>
                            <div className="relative h-0.5 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 shadow-[0_0_12px_2px_rgba(236,72,153,0.7)]">
                              <span className="absolute -left-1.5 -top-[5px] h-3 w-3 animate-pulse rounded-full bg-pink-500 shadow-[0_0_14px_4px_rgba(236,72,153,0.8)]" />
                              {view === 'day' && (
                                <span className="absolute -top-5 right-2 rounded-md bg-pink-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {formatMinutes(nowMinutes)}
                                </span>
                              )}
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

          <div className="muted flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-900/5 px-4 py-2.5 text-[11px] dark:border-white/5">
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-gradient-to-r from-violet-500 to-blue-500" /> Your tasks</span>
            <span className="flex items-center gap-1.5"><span className="striped h-3 w-5 rounded" style={{ '--stripe': 'rgba(59,130,246,0.55)' } as React.CSSProperties} /> Synced events (locked)</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.9)]" /> Now</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EventChip({ title, color, emoji }: { title: string; color: number; emoji?: string }) {
  const c = CALENDAR_COLORS[color] ?? CALENDAR_COLORS[0];
  return (
    <div
      className="striped flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 dark:text-white"
      style={{ '--stripe': `${c.from}55`, borderLeft: `3px solid ${c.from}` } as React.CSSProperties}
      title={`${title} (all day, synced)`}
    >
      <Lock size={9} className="shrink-0 opacity-60" /> {emoji} {title}
    </div>
  );
}

function laneStyle(lane: { lane: number; lanes: number } | undefined) {
  const l = lane ?? { lane: 0, lanes: 1 };
  const width = 100 / l.lanes;
  return { left: `calc(${l.lane * width}% + 3px)`, width: `calc(${width}% - 6px)` };
}

function EventBlock({ de, lane, calendar }: { de: DayEvent; lane?: { lane: number; lanes: number }; calendar?: { color: number; emoji: string; name: string } }) {
  const c = CALENDAR_COLORS[calendar?.color ?? 1] ?? CALENDAR_COLORS[1];
  const height = (de.end - de.start) * PX_PER_MIN;
  const tooltip = [de.event.title, `${formatMinutes(de.start)} – ${formatMinutes(de.end % DAY_MINUTES)}`, de.event.location, calendar && `${calendar.emoji} ${calendar.name} (synced, read-only)`]
    .filter(Boolean)
    .join('\n');
  return (
    <div
      className="striped absolute z-10 cursor-not-allowed overflow-hidden rounded-lg border px-1.5 py-0.5 text-slate-800 dark:text-white"
      style={{
        ...laneStyle(lane),
        top: de.start * PX_PER_MIN,
        height: Math.max(height, SLOT) - 1,
        '--stripe': `${c.from}40`,
        borderColor: `${c.from}80`,
        borderLeftWidth: 3,
        borderLeftColor: c.from,
      } as React.CSSProperties}
      title={tooltip}
      aria-label={`Synced event: ${tooltip}`}
    >
      <div className="flex items-center gap-1 truncate text-[10px] font-semibold leading-tight">
        <Lock size={9} className="shrink-0 opacity-60" />
        <span className="truncate">{de.event.title}</span>
      </div>
      {height >= 34 && (
        <div className="truncate text-[10px] opacity-75">
          {formatMinutes(de.start)} – {formatMinutes(de.end % DAY_MINUTES)}
          {de.event.location && (
            <span className="ml-1 inline-flex items-center gap-0.5">
              · <MapPin size={9} /> {de.event.location}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskBlockProps {
  task: Task;
  schedule: TaskSchedule;
  lane?: { lane: number; lanes: number };
  active: boolean;
  fading: boolean;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onToggleDone: () => void;
  onUnschedule: () => void;
}

function TaskBlock({ task, schedule, lane, active, fading, onMoveStart, onResizeStart, onToggleDone, onUnschedule }: TaskBlockProps) {
  const height = schedule.duration * PX_PER_MIN;
  const done = task.status === 'done';
  const gradientClass = task.priority ? PRIORITY_STYLES[task.priority].block : 'from-violet-600/90 to-blue-500/90';
  const compact = height < 40;
  return (
    <div
      onPointerDown={onMoveStart}
      className={cn(
        'group absolute z-20 cursor-grab touch-none overflow-hidden rounded-lg bg-gradient-to-br text-white shadow-lg ring-1 ring-white/20 transition-[box-shadow,opacity]',
        gradientClass,
        active ? 'z-40 cursor-grabbing shadow-[0_0_30px_-4px_rgba(139,92,246,0.9)] ring-2 ring-white/70' : 'hover:shadow-[0_0_24px_-6px_rgba(139,92,246,0.8)]',
        done && 'opacity-55',
        fading && 'opacity-30',
      )}
      style={{ ...laneStyle(lane), top: schedule.start * PX_PER_MIN, height: height - 1 }}
      title={`${task.title}\n${formatMinutes(schedule.start)} – ${formatMinutes(schedule.start + schedule.duration)} (${formatDuration(schedule.duration)})`}
    >
      <div className={cn('flex h-full gap-1 px-1.5', compact ? 'items-center py-0' : 'items-start py-1')}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleDone}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          className={cn('mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-white/80', done && 'bg-white text-violet-600')}
        >
          {done && <Check size={10} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-[11px] font-semibold leading-tight', done && 'line-through')}>{task.title}</div>
          {!compact && (
            <div className="truncate text-[10px] text-white/80">
              {formatMinutes(schedule.start)} – {formatMinutes(schedule.start + schedule.duration)} · {formatDuration(schedule.duration)}
            </div>
          )}
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onUnschedule}
          aria-label="Unschedule"
          title="Back to Unscheduled"
          className="shrink-0 rounded p-0.5 opacity-0 transition hover:bg-white/20 group-hover:opacity-100"
        >
          <X size={11} />
        </button>
      </div>
      <div
        onPointerDown={onResizeStart}
        className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center"
        aria-label="Resize"
        role="separator"
      >
        <span className="h-0.5 w-6 rounded-full bg-white/70 opacity-0 transition group-hover:opacity-100" />
      </div>
    </div>
  );
}
