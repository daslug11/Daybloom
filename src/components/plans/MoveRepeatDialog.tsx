import { useState } from 'react';
import type { Occurrence } from '../../../server/data/recurrence';
import { usePlanActions } from '../../hooks/data/plans';
import { useToast } from '../../hooks/useToast';
import { dayLabel, rangeLabel } from '../../lib/planner';
import type { BlockSeries } from '../../lib/types';
import { Modal } from '../ui/Modal';

/** After a repeating block is dragged: apply the new time to this session only, or to every session. */
export function MoveRepeatDialog({ occ, series, start, duration, onClose }: { occ: Occurrence; series?: BlockSeries; start: number; duration: number; onClose: () => void }) {
  const actions = usePlanActions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const resized = duration !== occ.duration && start === occ.start;
  const patch = { start_min: start, duration_min: duration };

  const run = async (fn: () => Promise<unknown>, message: string, undo: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast(message, { label: 'Undo', onClick: () => void undo().catch(() => toast('That change could not be undone.')) });
      onClose();
    } catch {
      toast('That change could not be saved. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${resized ? 'Change the length of' : 'Move'} “${occ.title}”?`}
      description={`${dayLabel(occ.day)} · ${rangeLabel(occ.start, occ.duration)} → ${rangeLabel(start, duration)}`}
    >
      <p className="muted mb-4 text-sm">This block repeats every week.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={() =>
            run(
              // A session with its own time keeps it unless it changes too.
              async () => {
                await actions.editSeries(occ.series_id, patch);
                if (occ.edited) await actions.editOccurrence(occ, patch);
              },
              'Changed every session',
              async () => {
                await actions.editSeries(occ.series_id, { start_min: series?.start_min ?? occ.start, duration_min: series?.duration_min ?? occ.duration });
                if (occ.edited) await actions.editOccurrence(occ, { start_min: occ.start, duration_min: occ.duration });
              },
            )
          }
        >
          Every session
        </button>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() =>
            run(
              () => actions.editOccurrence(occ, patch),
              'Changed this session only',
              () => actions.editOccurrence(occ, { start_min: occ.start, duration_min: occ.duration }),
            )
          }
        >
          This session only
        </button>
      </div>
    </Modal>
  );
}
