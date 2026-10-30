import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { addDaysKey, expandSeries, planEndDate, planProgress, type Occurrence } from '../../../server/data/recurrence';
import { useGoals } from '../../hooks/data/goals';
import { useHabits } from '../../hooks/data/habits';
import { useOccurrenceRows, usePlanActions, usePlans, useSeries } from '../../hooks/data/plans';
import { useAppActions } from '../../hooks/useAppActions';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { parseKey } from '../../lib/dates';
import { formatMinutes } from '../../lib/planner';
import type { BlockSeries, OccurrenceRow, Plan } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { PlanCard } from './PlanCard';

const dayLabel = (d: string) => parseKey(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** Planner → Plans: every plan added from Atlas, with progress and check-offs. Drafts wait below. */
export function PlansSection() {
  const { data: plans = [], isLoading } = usePlans();
  const { data: series = [] } = useSeries();
  const { data: rows = [] } = useOccurrenceRows();
  const { openAtlas } = useAppActions();
  const added = plans.filter((p) => p.status === 'active' || p.status === 'paused');
  const drafts = plans.filter((p) => p.status === 'draft');

  return (
    <section id="plans" aria-labelledby="plans-title" className="mt-8 scroll-mt-20">
      <div className="mb-3">
        <h2 id="plans-title" className="text-lg font-bold">
          Plans
        </h2>
        <p className="muted text-sm">Schedules you made with Atlas — workouts, study, reading and more. Each one is a set of repeating blocks above; check sessions off here as you go.</p>
      </div>
      {!isLoading && !added.length && !drafts.length && (
        <Card className="text-sm">
          <p>
            No plans yet. Ask Atlas for one — for example “Make me a 4-week workout plan” or “A study schedule for my exams”.{' '}
            <button className="link" onClick={() => openAtlas()}>
              <Sparkles size={13} className="mr-0.5 inline" aria-hidden />
              Ask Atlas
            </button>
          </p>
        </Card>
      )}
      {added.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {added.map((p) => (
            <PlanProgress key={p.id} plan={p} series={series.filter((s) => s.plan_id === p.id)} rows={rows} />
          ))}
        </div>
      )}
      {drafts.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Drafts from Atlas <span className="muted font-normal">· not on your Planner yet</span></h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {drafts.map((p) => (
              <PlanCard key={p.id} planId={p.id} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PlanProgress({ plan, series, rows }: { plan: Plan; series: BlockSeries[]; rows: OccurrenceRow[] }) {
  const { today } = useToday();
  const actions = usePlanActions();
  const toast = useToast();
  const { data: habits = [] } = useHabits();
  const { data: goals = [] } = useGoals();
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Check-offs shown immediately while they save. */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const start = plan.start_date ?? today;
  const end = planEndDate(start, plan.weeks);
  const occ = expandSeries(series, rows, start, end, { withSkipped: true }).map((o) => {
    const k = `${o.series_id}:${o.day}`;
    return k in pending ? { ...o, done: pending[k] } : o;
  });
  const p = planProgress(start, plan.weeks, occ, today);
  const [week, setWeek] = useState(() => Math.min(Math.max(p.week, 1), plan.weeks));
  const weekStart = addDaysKey(start, (week - 1) * 7);
  const thisWeek = occ.filter((o) => o.day >= weekStart && o.day <= addDaysKey(weekStart, 6));
  const habit = habits.find((h) => h.id === plan.habit_id);
  const goal = goals.find((g) => g.id === plan.goal_id);
  const paused = plan.status === 'paused';

  const status = p.week === 0 ? `Starts ${dayLabel(start)}` : p.finished ? 'Finished' : `Week ${p.week} of ${plan.weeks}`;
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast(done);
    } catch {
      toast('That change could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (o: Occurrence) => {
    const k = `${o.series_id}:${o.day}`;
    setPending((x) => ({ ...x, [k]: !o.done }));
    try {
      await actions.setDone(o, !o.done, plan);
    } catch {
      toast('That change could not be saved. Please try again.');
    } finally {
      setPending(({ [k]: _, ...rest }) => rest);
    }
  };

  return (
    <Card aria-label={`Plan progress: ${plan.title}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">
            {plan.title} {paused && <span className="ml-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">Paused</span>}
          </h3>
          <p className="muted text-sm" data-testid="plan-progress">
            {status} · {p.done} of {p.total} sessions done
          </p>
        </div>
        <button className="icon-btn h-8 w-8" disabled={busy} onClick={() => run(() => actions.setStatus(plan, paused ? 'active' : 'paused'), paused ? 'Plan resumed' : 'Plan paused — its sessions are hidden from the Planner')} aria-label={paused ? 'Resume plan' : 'Pause plan'} title={paused ? 'Resume' : 'Pause'}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <button className="icon-btn h-8 w-8" onClick={() => setRemoving(true)} aria-label="Remove plan" title="Remove">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full bg-ink transition-all" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
      </div>
      {(habit || goal) && (
        <p className="faint mt-2 text-xs">
          {habit && `Tracked as habit ${habit.emoji} ${habit.name}`}
          {habit && goal && ' · '}
          {goal && `Goal: ${goal.title} (${goal.current}/${goal.target})`}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1">
        <button className="icon-btn h-7 w-7" disabled={week <= 1} onClick={() => setWeek(week - 1)} aria-label="Previous week">
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold">Week {week}</span>
        <button className="icon-btn h-7 w-7" disabled={week >= plan.weeks} onClick={() => setWeek(week + 1)} aria-label="Next week">
          <ChevronRight size={14} />
        </button>
      </div>
      <ul className="mt-1">
        {thisWeek.map((o) => (
          <li key={`${o.series_id}:${o.day}`}>
            {/* The whole row is the check-off target, not just the 16px box. */}
            <label className={cn('-mx-2 flex min-h-10 items-center gap-2 rounded-control px-2 text-sm', o.skipped ? 'faint' : 'cursor-pointer hover:bg-raised')}>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-ink"
                checked={o.done}
                disabled={busy || o.skipped || `${o.series_id}:${o.day}` in pending}
                onChange={() => void toggle(o)}
                aria-label={`${o.done ? 'Done' : 'Mark done'}: ${o.title} on ${dayLabel(o.day)}`}
              />
              <span className={cn('w-24 shrink-0 text-xs tabular-nums', o.day === today ? 'font-bold text-atlas' : 'muted')}>
                {dayLabel(o.day)}
              </span>
              <span className="faint w-16 shrink-0 text-xs tabular-nums">{formatMinutes(o.start)}</span>
              <span className={cn('min-w-0 flex-1 truncate', (o.done || o.skipped) && 'line-through')}>{o.title}</span>
              {o.skipped && <span className="text-xs">skipped</span>}
            </label>
          </li>
        ))}
        {!thisWeek.length && <li className="muted text-sm">No sessions this week.</li>}
      </ul>

      {removing && (
        <Modal open onClose={() => setRemoving(false)} title={`Remove “${plan.title}”?`} description="Should its upcoming Planner blocks be deleted too? Sessions already past stay in your history either way.">
          {(habit || goal) && <p className="muted mb-3 text-sm">The linked {[habit && 'habit', goal && 'goal'].filter(Boolean).join(' and ')} will be kept.</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button className="btn-ghost" onClick={() => setRemoving(false)}>
              Cancel
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => run(() => actions.removePlan(plan, false), 'Plan removed; its blocks stay on your Planner')}>
              Remove plan, keep blocks
            </button>
            <button className="btn-danger" disabled={busy} onClick={() => run(() => actions.removePlan(plan, true), 'Plan and its upcoming blocks removed')}>
              Remove plan and upcoming blocks
            </button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
