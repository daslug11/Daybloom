import { Repeat } from 'lucide-react';
import { useState } from 'react';
import type { Occurrence } from '../../../server/data/recurrence';
import { usePlanActions } from '../../hooks/data/plans';
import { useToast } from '../../hooks/useToast';
import { parseKey } from '../../lib/dates';
import { formatMinutes, formatMinutesShort } from '../../lib/planner';
import type { BlockSeries, Plan } from '../../lib/types';
import { Modal } from '../ui/Modal';

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

/** Edit, check off or delete one session of a recurring block — "this one only" or every session of the block. */
export function OccurrenceDialog({ occ, series, plan, onClose }: { occ: Occurrence; series?: BlockSeries; plan?: Plan; onClose: () => void }) {
  const actions = usePlanActions();
  const toast = useToast();
  const [title, setTitle] = useState(occ.title);
  const [details, setDetails] = useState(occ.details);
  const [start, setStart] = useState(occ.start);
  const [duration, setDuration] = useState(occ.duration);
  const [busy, setBusy] = useState(false);
  const all = plan ? `All “${series?.title ?? occ.title}” sessions in this plan` : 'All repeats';
  const changed = title.trim() !== occ.title || details.trim() !== occ.details || start !== occ.start || duration !== occ.duration;
  const valid = !!title.trim() && start + duration <= 1440;

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast(message);
      onClose();
    } catch {
      toast('That change could not be saved. Please try again.');
      setBusy(false);
    }
  };

  const day = parseKey(occ.day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <Modal
      open
      onClose={onClose}
      title={occ.title}
      description={
        <>
          <Repeat size={13} className="mr-1 inline" aria-hidden />
          {day} · {formatMinutes(occ.start)} · repeats weekly{plan ? ` · part of “${plan.title}”` : ''}
        </>
      }
    >
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-violet-600" checked={occ.done} disabled={busy} onChange={(e) => run(() => actions.setDone(occ, e.target.checked, plan), e.target.checked ? 'Session done ✓' : 'Marked not done')} />
        Done
      </label>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label className="block">
          <span className="label">Title</span>
          <input className="input" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Details</span>
          <input className="input" maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        {!valid && <p className="text-sm text-rose-600 dark:text-rose-300">Needs a title, and must end by midnight.</p>}
        <div>
          <p className="label">Save changes for</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary !py-2"
              disabled={busy || !changed || !valid}
              onClick={() =>
                run(() => actions.editOccurrence(occ, { title: title.trim(), details: details.trim(), start_min: start, duration_min: duration }), 'Changed this session only')
              }
            >
              This one only
            </button>
            <button
              type="button"
              className="btn-ghost !py-2"
              disabled={busy || !changed || !valid}
              onClick={() =>
                run(() => actions.editSeries(occ.series_id, { title: title.trim(), details: details.trim(), start_min: start, duration_min: duration }), 'Changed every session')
              }
            >
              {all}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-5 border-t border-slate-900/10 pt-4 dark:border-white/10">
        <p className="label">Delete</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost !py-2 text-rose-600" disabled={busy} onClick={() => run(() => actions.editOccurrence(occ, { skipped: true }), 'Removed this session')}>
            This one only
          </button>
          <button
            className="btn-danger !py-2"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete every session of “${series?.title ?? occ.title}”? Checked-off history for it goes too.`)) void run(() => actions.deleteSeries(occ.series_id), 'Deleted the repeating block');
            }}
          >
            {all}
          </button>
        </div>
      </div>
    </Modal>
  );
}
