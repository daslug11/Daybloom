import { useState } from 'react';
import { DAY_MINUTES, formatMinutesShort, parseTimeInput, rangeLabel, type TimeBlock } from '../../lib/planner';
import { formatDuration } from '../../lib/quickAdd';
import { Modal } from '../ui/Modal';

/** 15 minutes to 8 hours, in 15-minute steps. */
const DURATIONS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15);

interface Props {
  title: string;
  initial: TimeBlock;
  /** True when the task already has a block (the dialog edits it instead of creating one). */
  scheduled: boolean;
  onSave: (b: TimeBlock) => void;
  onUnschedule?: () => void;
  onClose: () => void;
}

/**
 * The keyboard and touch way to put a task on the Planner (or change its block):
 * pick a day, a start time and a length. Every value lands on the 15-minute grid.
 */
export function ScheduleDialog({ title, initial, scheduled, onSave, onUnschedule, onClose }: Props) {
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(formatMinutesShort(initial.start));
  const [duration, setDuration] = useState(initial.duration);
  const start = parseTimeInput(time);
  const error = !date ? 'Pick a day.' : start === null ? 'Pick a start time.' : start + duration > DAY_MINUTES ? 'The block has to end by midnight. Pick an earlier time or a shorter length.' : null;
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

  return (
    <Modal open onClose={onClose} title={scheduled ? 'Change time' : 'Schedule task'} description={`“${title}”`}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (error || start === null) return;
          onSave({ date, start, duration });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">Day</span>
            <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Start</span>
            <input className="input" type="time" step={900} required autoFocus value={time} onChange={(e) => setTime(e.target.value)} aria-describedby="schedule-error" />
          </label>
          <label className="block">
            <span className="label">Length</span>
            <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {durations.map((d) => (
                <option key={d} value={d}>
                  {formatDuration(d)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p id="schedule-error" className={error ? 'text-sm text-danger' : 'muted text-sm tabular-nums'} aria-live="polite">
          {error ?? (start !== null ? rangeLabel(start, duration) : '')}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {scheduled && onUnschedule && (
            <button type="button" className="btn-ghost sm:mr-auto" onClick={onUnschedule}>
              Move to Unscheduled
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!!error}>
            {scheduled ? 'Save time' : 'Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
