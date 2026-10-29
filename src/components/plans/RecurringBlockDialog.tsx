import { useState } from 'react';
import { planEndDate, WEEKDAYS } from '../../../server/data/recurrence';
import { usePlanActions } from '../../hooks/data/plans';
import { useToday } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { addDays } from '../../lib/dates';
import { formatMinutesShort } from '../../lib/planner';
import { Modal } from '../ui/Modal';

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

/** Create a repeating Planner block by hand: weekly on chosen days, ending after N weeks or on a date. */
export function RecurringBlockDialog({ onClose, initialDay }: { onClose: () => void; initialDay?: string }) {
  const { today } = useToday();
  const actions = usePlanActions();
  const toast = useToast();
  const startDay = initialDay && initialDay >= today ? initialDay : today;
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [days, setDays] = useState<number[]>([((new Date(`${startDay}T12:00:00`).getDay() + 6) % 7) + 1]);
  const [start, setStart] = useState(18 * 60);
  const [duration, setDuration] = useState(60);
  const [from, setFrom] = useState(startDay);
  const [endMode, setEndMode] = useState<'weeks' | 'date'>('weeks');
  const [weeks, setWeeks] = useState(4);
  const [until, setUntil] = useState(addDays(startDay, 27));
  const [saving, setSaving] = useState(false);

  const end = endMode === 'weeks' ? planEndDate(from, weeks) : until;
  const valid = !!title.trim() && days.length > 0 && start + duration <= 1440 && end >= from && end <= addDays(from, 366);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const sorted = [...days].sort((a, b) => a - b);
    try {
      await actions.createSeries({ title: title.trim(), details: details.trim(), days: sorted, start_min: start, duration_min: duration, start_date: from, end_date: end });
      toast(`Added “${title.trim()}” every ${sorted.map((d) => WEEKDAYS[d - 1]).join(', ')}`);
      onClose();
    } catch {
      toast('Could not add the repeating block.');
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New repeating block" description="A block that repeats every week on the days you pick.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="block">
          <span className="label">Title</span>
          <input autoFocus className="input" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spanish practice" />
        </label>
        <label className="block">
          <span className="label">Details (optional)</span>
          <input className="input" maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
        </label>
        <fieldset>
          <legend className="label">Repeats on</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = days.includes(i + 1);
              return (
                <button type="button" key={d} aria-pressed={on} className={on ? 'chip-on' : 'chip-off'} onClick={() => setDays(on ? days.filter((x) => x !== i + 1) : [...days, i + 1])}>
                  {d}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="grid grid-cols-3 gap-3">
          <label>
            <span className="label">Time</span>
            <input
              className="input"
              type="time"
              step={900}
              value={formatMinutesShort(start)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (Number.isFinite(h) && Number.isFinite(m)) setStart(Math.round((h * 60 + m) / 15) * 15);
              }}
            />
          </label>
          <label>
            <span className="label">Length</span>
            <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Starts</span>
            <input className="input" type="date" min={today} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
        </div>
        <fieldset className="space-y-2 text-sm">
          <legend className="label">Ends</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="end" checked={endMode === 'weeks'} onChange={() => setEndMode('weeks')} className="accent-violet-600" /> After
            <input className="input !w-20 !py-1" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.min(52, Math.max(1, Number(e.target.value) || 1)))} disabled={endMode !== 'weeks'} aria-label="Number of weeks" />
            weeks
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="end" checked={endMode === 'date'} onChange={() => setEndMode('date')} className="accent-violet-600" /> On
            <input className="input !w-44 !py-1" type="date" min={from} value={until} onChange={(e) => e.target.value && setUntil(e.target.value)} disabled={endMode !== 'date'} aria-label="End date" />
          </label>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!valid || saving}>
            Add repeating block
          </button>
        </div>
      </form>
    </Modal>
  );
}
