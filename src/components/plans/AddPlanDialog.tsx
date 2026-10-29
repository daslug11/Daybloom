import { AlertTriangle, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { findFreeSlot, overlaps, planEndDate, planOccurrences, type Busy } from '../../../server/data/recurrence';
import { usePlanActions, useRecurring, type Decision } from '../../hooks/data/plans';
import { useTasks } from '../../hooks/data/tasks';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { addDays, parseKey } from '../../lib/dates';
import { formatMinutes, timedEventsOn } from '../../lib/planner';
import type { Plan } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';

const KIND_LABEL: Record<Busy['kind'], string> = { block: 'task block', recurring: 'recurring block', event: 'calendar' };
/** How far ahead the app syncs calendar events (see useCalendarSync). */
const CALENDAR_HORIZON_DAYS = 56;

/** Preview a plan's sessions against the Planner and calendar, resolve conflicts, then add it as recurring blocks. */
export function AddPlanDialog({ plan, onClose, layer }: { plan: Plan; onClose: () => void; layer?: string }) {
  const { today } = useToday();
  const tomorrow = addDays(today, 1);
  const startDate = plan.start_date && plan.start_date > today ? plan.start_date : tomorrow;
  const endDate = planEndDate(startDate, plan.weeks);
  const actions = usePlanActions();
  const toast = useToast();
  const { data: tasks = [] } = useTasks();
  const { events } = useCalendarSync();
  const recurring = useRecurring(startDate, endDate);
  const perWeek = plan.sessions.length;
  const [habit, setHabit] = useState(false);
  const [goal, setGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState(`${perWeek}x a week: ${plan.title}`);
  const [saving, setSaving] = useState(false);

  const occurrences = useMemo(() => planOccurrences(plan.sessions, startDate, plan.weeks), [plan.sessions, startDate, plan.weeks]);
  const conflicts = useMemo(() => {
    const busyOn = new Map<string, Busy[]>();
    const add = (b: Busy) => busyOn.set(b.day, [...(busyOn.get(b.day) ?? []), b]);
    for (const t of tasks) {
      if (t.sched_date && t.sched_start != null && t.sched_duration && t.sched_date >= startDate && t.sched_date <= endDate) {
        add({ day: t.sched_date, start: t.sched_start, end: t.sched_start + t.sched_duration, title: t.title, kind: 'block' });
      }
    }
    for (const o of recurring) add({ day: o.day, start: o.start, end: o.start + o.duration, title: o.title, kind: 'recurring' });
    for (const day of new Set(occurrences.map((o) => o.day))) {
      for (const e of timedEventsOn(events, day)) add({ day, start: e.start, end: e.end, title: e.event.title, kind: 'event' });
    }
    return occurrences.flatMap((o) => {
      const busy = busyOn.get(o.day) ?? [];
      const hit = busy.find((b) => overlaps({ start: o.start, end: o.start + o.duration }, b));
      if (!hit) return [];
      // Shift within the same day, avoiding everything else and the plan's other sessions that day.
      const sameDay = occurrences.filter((x) => x.day === o.day && x !== o).map((x) => ({ start: x.start, end: x.start + x.duration }));
      return [{ key: `${o.day}:${o.session}`, occ: o, hit, shiftTo: findFreeSlot([...busy, ...sameDay], o.start, o.duration) }];
    });
  }, [occurrences, tasks, recurring, events, startDate, endDate]);

  const [choices, setChoices] = useState<Record<string, 'skip' | 'shift' | 'keep'>>({});
  const choiceFor = (c: (typeof conflicts)[number]) => choices[c.key] ?? (c.shiftTo != null ? 'shift' : 'skip');
  const setAll = (action: 'skip' | 'shift' | 'keep') =>
    setChoices(Object.fromEntries(conflicts.map((c) => [c.key, action === 'shift' && c.shiftTo == null ? 'skip' : action])));
  const skipped = conflicts.filter((c) => choiceFor(c) === 'skip').length;
  const total = occurrences.length - skipped;

  const add = async () => {
    setSaving(true);
    const decisions: Record<string, Decision> = {};
    for (const c of conflicts) {
      const choice = choiceFor(c);
      decisions[c.key] = choice === 'shift' && c.shiftTo != null ? { action: 'shift', start: c.shiftTo } : { action: choice === 'shift' ? 'skip' : choice };
    }
    try {
      const added = await actions.addToPlanner({ plan, sessions: plan.sessions, startDate, weeks: plan.weeks, decisions, habit, goalTitle: goal ? goalTitle : null });
      onClose();
      toast(`Added “${plan.title}” to your Planner · ${added.sessions} sessions`, {
        label: 'Undo',
        onClick: () =>
          actions
            .undoAdd(added)
            .then(() => toast('Removed it from your Planner.'))
            .catch(() => toast('Could not undo. Remove the plan from Planner → Plans instead.')),
      });
    } catch {
      setSaving(false);
      toast('Could not add the plan. Nothing was changed — please try again.');
    }
  };

  const dayLabel = (d: string) => parseKey(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add “${plan.title}” to your Planner`}
      description={`${perWeek} repeating block${perWeek === 1 ? '' : 's'} a week from ${dayLabel(startDate)} to ${dayLabel(endDate)} — ${occurrences.length} sessions.`}
      className="max-w-xl"
      layer={layer}
    >
      {conflicts.length ? (
        <section aria-label="Conflicts">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle size={15} aria-hidden /> {conflicts.length} session{conflicts.length === 1 ? '' : 's'} overlap{conflicts.length === 1 ? 's' : ''} something
            </p>
            <div className="ml-auto flex gap-1 text-xs">
              <button className="chip-off !py-1" onClick={() => setAll('skip')}>
                Skip all
              </button>
              <button className="chip-off !py-1" onClick={() => setAll('shift')}>
                Shift all
              </button>
              <button className="chip-off !py-1" onClick={() => setAll('keep')}>
                Add all anyway
              </button>
            </div>
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {conflicts.map((c) => {
              const choice = choiceFor(c);
              return (
                <li key={c.key} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-sm" aria-label={`Conflict on ${dayLabel(c.occ.day)}`}>
                  <p>
                    <strong>{dayLabel(c.occ.day)}</strong> · {formatMinutes(c.occ.start)} {c.occ.title}
                  </p>
                  <p className="muted text-xs">
                    Overlaps “{c.hit.title}” ({KIND_LABEL[c.hit.kind]}, {formatMinutes(c.hit.start)}–{formatMinutes(Math.min(c.hit.end, 1439))})
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`What to do on ${dayLabel(c.occ.day)}`}>
                    {(
                      [
                        ['skip', 'Skip'],
                        ['shift', c.shiftTo != null ? `Shift to ${formatMinutes(c.shiftTo)}` : 'No free time to shift'],
                        ['keep', 'Add anyway'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        role="radio"
                        aria-checked={choice === value}
                        disabled={value === 'shift' && c.shiftTo == null}
                        onClick={() => setChoices((x) => ({ ...x, [c.key]: value }))}
                        className={cn(choice === value ? 'chip-on' : 'chip-off', '!py-1 text-xs disabled:opacity-50')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
          <Check size={15} aria-hidden /> No conflicts with your Planner{events.length ? ' or calendar' : ''}.
        </p>
      )}
      {endDate > addDays(today, CALENDAR_HORIZON_DAYS) && events.length > 0 && (
        <p className="faint mt-2 text-xs">Calendar events are checked up to {dayLabel(addDays(today, CALENDAR_HORIZON_DAYS))}.</p>
      )}

      <div className="mt-4 space-y-2 border-t border-slate-900/10 pt-4 text-sm dark:border-white/10">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-violet-600" checked={habit} onChange={(e) => setHabit(e.target.checked)} />
          Also track as a habit <span className="faint text-xs">(checking off a session logs it)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-violet-600" checked={goal} onChange={(e) => setGoal(e.target.checked)} />
          Also create a goal <span className="faint text-xs">({total} sessions)</span>
        </label>
        {goal && <input className="input !py-1.5" maxLength={200} value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} aria-label="Goal title" />}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={add} disabled={saving || total === 0 || (goal && !goalTitle.trim())}>
          {saving ? 'Adding…' : `Add ${total} session${total === 1 ? '' : 's'}`}
        </button>
      </div>
    </Modal>
  );
}
