import { useEffect, useState } from 'react';
import { useUserId } from '../../hooks/useAuth';
import { useInvalidateUserData } from '../../hooks/useInvalidateAll';
import { useToast } from '../../hooks/useToast';
import { importHandled, importLocalData, localDataSummary, markImportHandled, type LocalSummary } from '../../lib/localImport';
import { Modal } from '../ui/Modal';

/** On first sign-in on a device that used the old local-only Daybloom, offer to bring that data along. */
export function LocalImportPrompt() {
  const uid = useUserId();
  const [summary, setSummary] = useState<LocalSummary | null>(null);
  const [moods, setMoods] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const invalidate = useInvalidateUserData();

  useEffect(() => {
    if (uid && !importHandled(uid)) setSummary(localDataSummary());
  }, [uid]);

  if (!summary) return null;
  const close = () => {
    markImportHandled(uid);
    setSummary(null);
  };
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const n = await importLocalData({ moods });
      markImportHandled(uid);
      setSummary(null);
      invalidate();
      toast(`Imported ${n} item${n === 1 ? '' : 's'} from this device ✅`);
    } catch (err) {
      setError(`Import stopped part-way: ${(err as Error).message}. Anything already imported is safe in your account.`);
    } finally {
      setBusy(false);
    }
  };
  const parts = Object.entries(summary)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k === 'moods' ? 'mood check-ins' : k}`);
  return (
    <Modal open onClose={close} title="Bring your local data along?" description="This device has data from the earlier, offline-only version of Daybloom.">
      <p className="text-sm">
        Found <strong>{parts.join(', ')}</strong>. Importing copies it into your account so it syncs across devices. Demo data that version created automatically is
        skipped.
      </p>
      {summary.moods > 0 && (
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={moods} onChange={(e) => setMoods(e.target.checked)} className="mt-1 accent-ink" />
          <span>
            Include mood check-ins <span className="muted">(untick if you never used the mood tracker — the old version pre-filled some days)</span>
          </span>
        </label>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={close} disabled={busy}>
          Don't import
        </button>
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? 'Importing…' : 'Import my data'}
        </button>
      </div>
    </Modal>
  );
}
