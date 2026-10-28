import { Check, ChevronLeft, ChevronRight, GripVertical, Inbox, Lock, MapPin, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SyncStatusPill } from '../../components/calendars/SyncStatusPill';
import { QuickAddTask } from '../../components/tasks/QuickAddTask';
import { PRIORITY_STYLES, TaskChips } from '../../components/tasks/TaskChips';
import { AiButton } from '../../components/ui/Ai';
import { PageHeader } from '../../components/ui/PageHeader';
import { useCalendars } from '../../hooks/data/calendars';
import { useTasks, useToggleTask, useUpdateTask } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { CALENDAR_COLORS } from '../../lib/calendars';
import { parseKey } from '../../lib/dates';
import {
  addDaysKey,
  allDayEventsOn,
  clampStart,
  DAY_MINUTES,
  formatMinutes,
  hourLabel,
  layoutLanes,
  SNAP,
  snap,
  timedEventsOn,
  weekOf,
  type DayEvent,
} from '../../lib/planner';
import { formatDuration } from '../../lib/quickAdd';
import type { Task } from '../../lib/types';
import { cn } from '../../lib/utils';

/** Pixels per 15-minute slot. */
const SLOT = 14;
const PX_PER_MIN = SLOT / SNAP;
const TASK_MIME = 'application/x-daybloom-task';
const DEFAULT_DURATION = 60;
const VIEW_KEY = 'daybloom:planner-view';

type View = 'day' | 'week';
interface Block {
  date: string;
  start: number;
  duration: number;
}
interface Ghost extends Block {
  task_id: string;
  title: string;
  reason: string;
}
interface Interaction {
  taskId: string;
  mode: 'move' | 'resize';
  originX: number;
  originY: number;
  originScroll: number;
  orig: Block;
  preview: Block;
  moved: boolean;
  overSidebar: boolean;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const blockOf = (t: Task): Block | null => (t.sched_date && t.sched_start != null && t.sched_duration ? { date: t.sched_date, start: t.sched_start, duration: t.sched_duration } : null);

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
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const days = view === 'week' ? weekOf(cursor) : [cursor];
  const calById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);

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

  const durationFor = (id: string | null) => {
    const t = tasks.find((x) => x.id === id);
    return Math.max(15, Math.round((t?.estimate_min ?? DEFAULT_DURATION) / 15) * 15);
  };
  const minuteAt = (column: HTMLElement, clientY: number, duration: number) => clampStart(snap((clientY - column.getBoundingClientRect().top) / PX_PER_MIN - duration / 2), duration);

  // ---- drag from the Unscheduled list (HTML5 DnD) ----
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
    if (!id) return;
    e.preventDefault();
    const duration = durationFor(id);
    const start = minuteAt(e.currentTarget, e.clientY, duration);
    schedule(id, { date, start, duration });
    setSelectedId(null);
    toast(`Scheduled for ${formatMinutes(start)}`);
  };
  // ---- tap to place (touch screens) ----
  const onColumnClick = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if (!selectedId || e.target !== e.currentTarget) return;
    const duration = durationFor(selectedId);
    const start = clampStart(snap((e.clientY - e.currentTarget.getBoundingClientRect().top) / PX_PER_MIN), duration);
    schedule(selectedId, { date, start, duration });
    setSelectedId(null);
    toast(`Scheduled for ${formatMinutes(start)}`);
  };

  // ---- move / resize scheduled blocks (pointer events) ----
  const interactionRef = useRef<Interaction | null>(null);
  interactionRef.current = interaction;
  const startInteraction = (e: React.PointerEvent, task: Task, mode: Interaction['mode']) => {
    const b = blockOf(task);
    if (e.button !== 0 || !b) return;
    e.preventDefault();
    e.stopPropagation();
    setInteraction({ taskId: task.id, mode, originX: e.clientX, originY: e.clientY, originScroll: scrollRef.current?.scrollTop ?? 0, orig: b, preview: b, moved: false, overSidebar: false });
  };
  useEffect(() => {
    if (!interaction) return;
    const onMove = (e: PointerEvent) => {
      const cur = interactionRef.current;
      if (!cur) return;
      const scroller = scrollRef.current;
      if (scroller && cur.moved) {
        const r = scroller.getBoundingClientRect();
        if (e.clientY < r.top + 40 && e.clientY < cur.originY) scroller.scrollTop -= 12;
        else if (e.clientY > r.bottom - 40 && e.clientY > cur.originY) scroller.scrollTop += 12;
      }
      const dy = e.clientY - cur.originY + ((scroller?.scrollTop ?? 0) - cur.originScroll);
      const delta = snap(dy / PX_PER_MIN);
      const moved = cur.moved || Math.abs(e.clientX - cur.originX) > 3 || Math.abs(e.clientY - cur.originY) > 3;
      let preview: Block;
      if (cur.mode === 'resize') preview = { ...cur.orig, duration: Math.max(SNAP, Math.min(DAY_MINUTES - cur.orig.start, cur.orig.duration + delta)) };
      else {
        let date = cur.orig.date;
        for (const [key, el] of columnRefs.current) {
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX < r.right) date = key;
        }
        preview = { ...cur.orig, date, start: clampStart(cur.orig.start + delta, cur.orig.duration) };
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
        schedule(cur.taskId, null);
        toast('Moved back to Unscheduled');
      } else schedule(cur.taskId, cur.preview);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [interaction?.taskId, interaction?.mode, schedule, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const blockFor = (t: Task) => (interaction?.taskId === t.id ? interaction.preview : blockOf(t));

  // ---- ✨ plan my day / week ----
  const runPlan = () => {
    const opts = { onSuccess: (r: { result: { blocks: Ghost[] } }) => {
      setGhosts(r.result.blocks.map((b) => ({ ...b, start: b.start, duration: b.duration })));
      if (!r.result.blocks.length) toast('No free slots or suitable tasks to plan.');
    } };
    if (view === 'day') planDay.mutate({ date: cursor }, opts);
    else planWeek.mutate({ date: cursor }, opts);
  };
  const acceptGhost = (g: Ghost) => {
    schedule(g.task_id, { date: g.date, start: g.start, duration: g.duration });
    setGhosts((list) => list.filter((x) => x !== g));
  };

  const shift = (dir: number) => setCursor((c) => addDaysKey(c, dir * (view === 'week' ? 7 : 1)));
  const rangeLabel =
    view === 'week'
      ? `${parseKey(days[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parseKey(days[6]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : parseKey(cursor).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedTask = tasks.find((t) => t.id === selectedId);

  return (
    <div className={cn(interaction && 'select-none')}>
      <PageHeader
        title="Planner"
        description="Time-block your day. Drag tasks onto the timeline (or tap a task, then a time), drag blocks to move them, and pull the bottom edge to resize. Synced calendar events are locked."
        actions={<SyncStatusPill />}
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div ref={sidebarRef} className="lg:sticky lg:top-20 lg:self-start" data-tour="planner-unscheduled">
          <div className={cn('glass p-4 transition', interaction?.overSidebar && 'border-violet-400 ring-2 ring-violet-400/50')}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Inbox size={16} className="text-violet-500" aria-hidden /> Unscheduled
              </h2>
              <span className="faint text-xs">{unscheduled.length}</span>
            </div>
            <QuickAddTask className="mb-3 !p-1.5 !shadow-none" placeholder="Add… “review PR 3pm for 30m”" />
            {interaction?.overSidebar && <div className="mb-2 rounded-xl border-2 border-dashed border-violet-400 p-3 text-center text-xs font-medium">Drop to unschedule</div>}
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-22rem)]">
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
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedId === t.id}
                  onClick={() => setSelectedId((s) => (s === t.id ? null : t.id))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelectedId((s) => (s === t.id ? null : t.id)))}
                  className={cn(
                    'flex cursor-grab items-start gap-2 rounded-xl border bg-white/80 p-2.5 text-sm active:cursor-grabbing dark:bg-white/[0.05]',
                    selectedId === t.id ? 'border-violet-500 ring-2 ring-violet-400/40' : 'border-slate-900/5 hover:border-violet-400/40 dark:border-white/10',
                    draggingId === t.id && 'opacity-40',
                  )}
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
              ))}
            </div>
            <p className="faint mt-3 text-[11px]">Tip: tap a task, then tap a time on the timeline — works on phones too.</p>
          </div>
        </div>

        <div className="glass min-w-0 !p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/5 p-3 dark:border-white/5">
            <div className="flex rounded-xl border border-slate-900/10 p-0.5 dark:border-white/10" role="tablist" aria-label="View">
              {(['day', 'week'] as const).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize', view === v ? 'bg-violet-600 text-white' : 'muted')}>
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
            <h2 className="text-sm font-bold">{rangeLabel}</h2>
            <AiButton size="sm" className="ml-auto" loading={planDay.isPending || planWeek.isPending} onClick={runPlan} hint="Suggest time blocks for your open tasks around your calendar">
              Plan my {view}
            </AiButton>
          </div>

          {ghosts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm">
              <span>
                ✨ {ghosts.length} suggested block{ghosts.length === 1 ? '' : 's'} (dashed). Accept the ones you like.
              </span>
              <button
                className="btn-primary ml-auto !px-3 !py-1"
                onClick={() => {
                  ghosts.forEach((g) => schedule(g.task_id, g));
                  toast(`Scheduled ${ghosts.length} block${ghosts.length === 1 ? '' : 's'}`);
                  setGhosts([]);
                }}
              >
                Accept all
              </button>
              <button className="btn-ghost !px-3 !py-1" onClick={() => setGhosts([])}>
                Discard
              </button>
            </div>
          )}
          {selectedTask && (
            <div className="flex items-center gap-2 bg-violet-500/10 px-4 py-2 text-xs">
              Tap a time to schedule <strong className="truncate">“{selectedTask.title}”</strong>
              <button className="link ml-auto" onClick={() => setSelectedId(null)}>
                Cancel
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <div className={cn(view === 'week' && 'min-w-[760px]')}>
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
                        aria-label={`Open ${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} in day view`}
                      >
                        <span className="muted text-[11px] font-semibold uppercase">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                        <span className={cn('flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-bold', d === today && 'bg-violet-600 text-white')}>{date.getDate()}</span>
                      </button>
                      {allDay.map((e) => {
                        const c = CALENDAR_COLORS[calById.get(e.calendarId)?.color ?? 1] ?? CALENDAR_COLORS[1];
                        return (
                          <div key={e.id} className="striped mt-1 flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ '--stripe': `${c.from}55`, borderLeft: `3px solid ${c.from}` } as React.CSSProperties} title={`${e.title} (all day, synced)`}>
                            <Lock size={9} className="shrink-0 opacity-60" aria-hidden /> {e.title}
                          </div>
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
                      <div key={h} className="faint absolute right-2 -translate-y-1/2 text-[10px] tabular-nums" style={{ top: h * 60 * PX_PER_MIN }}>
                        {hourLabel(h)}
                      </div>
                    ))}
                  </div>
                  {days.map((d) => {
                    const dayEvents = timedEventsOn(events, d);
                    const dayTasks = tasks.map((t) => ({ task: t, block: blockFor(t) })).filter((x): x is { task: Task; block: Block } => x.block?.date === d);
                    const dayGhosts = ghosts.filter((g) => g.date === d);
                    const lanes = layoutLanes([
                      ...dayEvents.map((e) => ({ id: `e:${e.event.id}`, start: e.start, end: e.end })),
                      ...dayTasks.map((x) => ({ id: `t:${x.task.id}`, start: x.block.start, end: x.block.start + x.block.duration })),
                      ...dayGhosts.map((g) => ({ id: `g:${g.task_id}`, start: g.start, end: g.start + g.duration })),
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
                        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropGhost(null)}
                        onDrop={(e) => onColumnDrop(e, d)}
                        onClick={(e) => onColumnClick(e, d)}
                        className={cn('relative min-w-0 flex-1 border-l border-slate-900/5 dark:border-white/5', d === today && 'bg-violet-500/[0.03]', selectedId && 'cursor-copy')}
                        style={{
                          backgroundImage: `repeating-linear-gradient(to bottom, var(--hour-line) 0 1px, transparent 1px ${SLOT * 4}px), repeating-linear-gradient(to bottom, var(--slot-line) 0 1px, transparent 1px ${SLOT}px)`,
                        }}
                      >
                        {dayEvents.map((de) => (
                          <EventBlock key={de.event.id} de={de} lane={lanes.get(`e:${de.event.id}`)} calendar={calById.get(de.event.calendarId)} />
                        ))}
                        {dayTasks.map(({ task, block }) => (
                          <TaskBlock
                            key={task.id}
                            task={task}
                            block={block}
                            lane={lanes.get(`t:${task.id}`)}
                            active={interaction?.taskId === task.id}
                            fading={interaction?.taskId === task.id && interaction.overSidebar}
                            onMoveStart={(e) => startInteraction(e, task, 'move')}
                            onResizeStart={(e) => startInteraction(e, task, 'resize')}
                            onToggleDone={() => toggle(task)}
                            onUnschedule={() => {
                              schedule(task.id, null);
                              toast('Moved back to Unscheduled');
                            }}
                          />
                        ))}
                        {dayGhosts.map((g) => (
                          <div
                            key={`g-${g.task_id}`}
                            className="absolute z-20 overflow-hidden rounded-lg border-2 border-dashed border-violet-500 bg-violet-500/15 px-1.5 py-0.5 text-[11px] text-violet-900 dark:text-violet-100"
                            style={{ ...laneStyle(lanes.get(`g:${g.task_id}`)), top: g.start * PX_PER_MIN, height: g.duration * PX_PER_MIN - 1 }}
                            title={`Suggested: ${g.title} — ${g.reason}`}
                          >
                            <div className="flex items-start gap-1">
                              <span className="min-w-0 flex-1 truncate font-semibold">✨ {g.title}</span>
                              <button className="rounded bg-violet-600 p-0.5 text-white" onClick={() => acceptGhost(g)} aria-label={`Accept suggested block for ${g.title}`}>
                                <Check size={11} />
                              </button>
                              <button className="rounded p-0.5 hover:bg-violet-500/20" onClick={() => setGhosts((l) => l.filter((x) => x !== g))} aria-label={`Dismiss suggestion for ${g.title}`}>
                                <X size={11} />
                              </button>
                            </div>
                            {g.duration >= 45 && <div className="truncate opacity-80">{formatMinutes(g.start)} · {g.reason}</div>}
                          </div>
                        ))}
                        {dropGhost?.date === d && (
                          <div className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed border-violet-500 bg-violet-500/15 px-2 py-1 text-[11px] font-semibold" style={{ top: dropGhost.start * PX_PER_MIN, height: dropGhost.duration * PX_PER_MIN }}>
                            {formatMinutes(dropGhost.start)} – {formatMinutes(dropGhost.start + dropGhost.duration)}
                          </div>
                        )}
                        {d === today && (
                          <div className="pointer-events-none absolute inset-x-0 z-30 transition-[top] duration-1000 ease-linear" style={{ top: nowMinutes * PX_PER_MIN }} aria-hidden>
                            <div className="relative h-0.5 bg-pink-500 shadow-[0_0_8px_1px_rgba(236,72,153,0.7)]">
                              <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-pink-500" />
                              {view === 'day' && <span className="absolute -top-5 right-2 rounded-md bg-pink-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{formatMinutes(nowMinutes)}</span>}
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

          <div className="faint flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-900/5 px-4 py-2.5 text-[11px] dark:border-white/5">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded bg-violet-600" /> Your tasks
            </span>
            <span className="flex items-center gap-1.5">
              <span className="striped h-3 w-5 rounded" style={{ '--stripe': 'rgba(59,130,246,0.55)' } as React.CSSProperties} /> Calendar events (locked)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded border-2 border-dashed border-violet-500" /> ✨ Suggestions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-5 bg-pink-500" /> Now
            </span>
          </div>
        </div>
      </div>
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
  const label = [de.event.title, `${formatMinutes(de.start)} – ${formatMinutes(de.end % DAY_MINUTES)}`, de.event.location, calendar && `${calendar.emoji} ${calendar.name} (synced, read-only)`].filter(Boolean).join('\n');
  return (
    <div
      className="striped absolute z-10 cursor-not-allowed overflow-hidden rounded-lg border px-1.5 py-0.5"
      style={{ ...laneStyle(lane), top: de.start * PX_PER_MIN, height: Math.max(height, SLOT) - 1, '--stripe': `${c.from}40`, borderColor: `${c.from}80`, borderLeftWidth: 3, borderLeftColor: c.from } as React.CSSProperties}
      title={label}
      aria-label={`Calendar event: ${label}`}
    >
      <div className="flex items-center gap-1 truncate text-[10px] font-semibold leading-tight">
        <Lock size={9} className="shrink-0 opacity-60" aria-hidden />
        <span className="truncate">{de.event.title}</span>
      </div>
      {height >= 34 && (
        <div className="truncate text-[10px] opacity-75">
          {formatMinutes(de.start)} – {formatMinutes(de.end % DAY_MINUTES)}
          {de.event.location && (
            <span className="ml-1 inline-flex items-center gap-0.5">
              · <MapPin size={9} aria-hidden /> {de.event.location}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskBlockProps {
  task: Task;
  block: Block;
  lane?: { lane: number; lanes: number };
  active: boolean;
  fading: boolean;
  onMoveStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onToggleDone: () => void;
  onUnschedule: () => void;
}

function TaskBlock({ task, block, lane, active, fading, onMoveStart, onResizeStart, onToggleDone, onUnschedule }: TaskBlockProps) {
  const height = block.duration * PX_PER_MIN;
  const compact = height < 40;
  const gradient = task.priority ? PRIORITY_STYLES[task.priority].block : 'from-violet-600 to-indigo-600';
  return (
    <div
      onPointerDown={onMoveStart}
      className={cn(
        'group absolute z-20 cursor-grab touch-none overflow-hidden rounded-lg bg-gradient-to-br text-white shadow ring-1 ring-white/20',
        gradient,
        active && 'z-40 cursor-grabbing ring-2 ring-white/80',
        task.done && 'opacity-55',
        fading && 'opacity-30',
      )}
      style={{ ...laneStyle(lane), top: block.start * PX_PER_MIN, height: height - 1 }}
      title={`${task.title}\n${formatMinutes(block.start)} – ${formatMinutes(block.start + block.duration)} (${formatDuration(block.duration)})`}
    >
      <div className={cn('flex h-full gap-1 px-1.5', compact ? 'items-center' : 'items-start py-1')}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleDone}
          aria-label={task.done ? `Mark “${task.title}” not done` : `Complete “${task.title}”`}
          className={cn('mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-white/80', task.done && 'bg-white text-violet-700')}
        >
          {task.done && <Check size={10} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-[11px] font-semibold leading-tight', task.done && 'line-through')}>{task.title}</div>
          {!compact && (
            <div className="truncate text-[10px] text-white/85">
              {formatMinutes(block.start)} – {formatMinutes(block.start + block.duration)}
            </div>
          )}
        </div>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onUnschedule} aria-label={`Unschedule “${task.title}”`} className="shrink-0 rounded p-0.5 opacity-70 hover:bg-white/20 hover:opacity-100 focus:opacity-100">
          <X size={11} />
        </button>
      </div>
      <div onPointerDown={onResizeStart} className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center" aria-hidden>
        <span className="h-0.5 w-6 rounded-full bg-white/70 opacity-0 group-hover:opacity-100" />
      </div>
    </div>
  );
}
