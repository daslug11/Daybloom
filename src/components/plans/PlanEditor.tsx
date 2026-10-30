import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { WEEKDAYS } from '../../../server/data/recurrence';
import { usePlanActions } from '../../hooks/data/plans';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { addDays } from '../../lib/dates';
import { formatMinutesShort } from '../../lib/planner';
import type { Plan, PlanSession } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { WeeksInput } from './WeeksInput';

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);
const toMinutes = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? Math.round((h * 60 + m) / 15) * 15 : null;
};

/** Edit a draft plan's sessions, length and start before adding it. Saving never uses AI. */
export function PlanEditor({ plan, onClose, layer }: { plan: Plan; onClose: () => void; layer?: string }) {
  const { today } = useToday();
  const actions = usePlanActions();
  const toast = useToast();
  const tomorrow = addDays(today, 1);
  const [title, setTitle] = useState(plan.title);
  const [weeks, setWeeks] = useState(plan.weeks);
  const [start, setStart] = useState(plan.start_date && plan.start_date > today ? plan.start_date : tomorrow);
  const [sessions, setSessions] = useState<PlanSession[]>(plan.sessions);
  const [saving, setSaving] = useState(false);
  // Errors show for a session once its title has been left, or after a save attempt, never while it's new.
  const [touched, setTouched] = useState<Set<number>>(() => new Set());
  const [tried, setTried] = useState(false);

  const set = (i: number, patch: Partial<PlanSession>) => setSessions((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  /** What's wrong with each session, by name ("Session 2 needs a title."). */
  const problems = sessions.map((s, i) =>
    !s.title.trim() ? `Session ${i + 1} needs a title.` : s.start + s.duration > 1440 ? `Session ${i + 1} ends after midnight. Start it earlier or make it shorter.` : null,
  );
  const invalid = problems.some(Boolean);
  const shown = (i: number) => (tried || touched.has(i)) && problems[i];
  const removeSession = (i: number) => {
    setSessions((l) => l.filter((_, j) => j !== i));
    setTouched((t) => new Set([...t].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
  };

  const save = async () => {
    if (!title.trim() || !sessions.length || invalid) {
      setTried(true);
      // Take the person to the first thing to fix.
      const first = problems.findIndex(Boolean);
      if (first >= 0) document.getElementById(`plan-session-${first}-${problems[first]!.includes('title') ? 'title' : 'time'}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const clean = sessions.map((s) => ({ ...s, title: s.title.trim(), details: s.details.trim() })).sort((a, b) => a.day - b.day || a.start - b.start);
      await actions.saveDraft(plan.id, { title: title.trim(), weeks, start_date: start, sessions: clean });
      onClose();
    } catch {
      toast('Could not save the plan. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit plan" description="Change anything before adding it to your Planner. Editing doesn't use AI." className="max-w-2xl" layer={layer}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_110px_150px]">
          <label>
            <span className="label">Title</span>
            <input className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            <span className="label">Weeks</span>
            <WeeksInput value={weeks} onChange={setWeeks} max={12} />
          </label>
          <label>
            <span className="label">Starts</span>
            <input className="input" type="date" min={tomorrow} value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </label>
        </div>

        <fieldset>
          <legend className="label">Weekly sessions</legend>
          <ul className="space-y-3">
            {sessions.map((s, i) => (
              <li key={i} className={cn('rounded-xl border p-3', shown(i) ? 'border-danger/60' : 'border-line')} aria-label={`Session ${i + 1}`}>
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <select className="input !py-1.5" value={s.day} onChange={(e) => set(i, { day: Number(e.target.value) })} aria-label={`Session ${i + 1} day`}>
                    {WEEKDAYS.map((d, k) => (
                      <option key={d} value={k + 1}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    id={`plan-session-${i}-time`}
                    className="input !py-1.5"
                    type="time"
                    step={900}
                    value={formatMinutesShort(s.start)}
                    onChange={(e) => {
                      const m = toMinutes(e.target.value);
                      if (m != null) set(i, { start: m });
                    }}
                    aria-label={`Session ${i + 1} time`}
                    aria-invalid={shown(i) && sessions[i].title.trim() ? true : undefined}
                    aria-describedby={shown(i) ? `plan-session-${i}-error` : undefined}
                  />
                  <select className="input !py-1.5" value={s.duration} onChange={(e) => set(i, { duration: Number(e.target.value) })} aria-label={`Session ${i + 1} duration`}>
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                  <button type="button" className="icon-btn h-9 w-9" onClick={() => removeSession(i)} aria-label={`Remove session ${i + 1}`}>
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr]">
                  <input
                    id={`plan-session-${i}-title`}
                    className="input !py-1.5"
                    maxLength={80}
                    value={s.title}
                    onChange={(e) => set(i, { title: e.target.value })}
                    onBlur={() => setTouched((t) => new Set(t).add(i))}
                    placeholder="Title"
                    aria-label={`Session ${i + 1} title`}
                    aria-invalid={shown(i) && !s.title.trim() ? true : undefined}
                    aria-describedby={shown(i) ? `plan-session-${i}-error` : undefined}
                  />
                  <input className="input !py-1.5" maxLength={160} value={s.details} onChange={(e) => set(i, { details: e.target.value })} placeholder="Details (optional)" aria-label={`Session ${i + 1} details`} />
                </div>
                {shown(i) && (
                  <p id={`plan-session-${i}-error`} className="mt-2 text-sm text-danger">
                    {problems[i]}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {sessions.length < 14 && (
            <button
              type="button"
              className="btn-ghost mt-3 !py-1.5"
              onClick={() => setSessions((l) => {
                const last = l[l.length - 1];
                return [...l, { day: last?.day ?? 1, start: last?.start ?? 18 * 60, duration: last?.duration ?? 45, title: '', details: '' }];
              })}
            >
              <Plus size={14} /> Add a session
            </button>
          )}
        </fieldset>

        {tried && !sessions.length && (
          <p role="alert" className="text-sm text-danger">
            Add at least one session.
          </p>
        )}
        {tried && invalid && (
          <p role="alert" className="text-sm text-danger">
            {problems.filter(Boolean).length === 1 ? problems.find(Boolean) : `${problems.filter(Boolean).length} sessions need fixing: ${problems.filter(Boolean).join(' ')}`}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
