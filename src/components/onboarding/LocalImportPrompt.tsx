import { useState, useSyncExternalStore } from 'react';
import { useUserId } from '../../hooks/useAuth';
import { useInvalidateUserData } from '../../hooks/useInvalidateAll';
import { useToast } from '../../hooks/useToast';
import { importHandled, importLocalData, localDataSummary, markImportHandled } from '../../lib/localImport';
import { Modal } from '../ui/Modal';

/*
 * Whether the import offer should be on screen, shared with the tour (which waits for it)
 * and Settings (which can bring it back).
 *  - "Don't import" and a finished import are remembered on this device (markImportHandled).
 *  - ×, Escape and the backdrop only mean "not now": the offer comes back on the next visit.
 */
let later = false;
let forced = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const importedKey = (uid: string) => `daybloom:local-imported:${uid}`;
function markImported(uid: string) {
  try {
    localStorage.setItem(importedKey(uid), '1');
  } catch {
    /* private mode */
  }
}
/** True once this account finished an import from this device (so Settings doesn't offer a second copy). */
export function importedFromThisDevice(uid: string) {
  try {
    return localStorage.getItem(importedKey(uid)) === '1';
  } catch {
    return false;
  }
}

function pending(uid: string) {
  if (!uid) return false;
  if (!forced && (later || importHandled(uid))) return false;
  return localDataSummary() !== null;
}

/** True while the import offer is (or is about to be) on screen. */
export function useLocalImportPending() {
  const uid = useUserId();
  return useSyncExternalStore(subscribe, () => pending(uid));
}

/** Re-opens the import offer (Settings → Your data). */
export function openLocalImport() {
  forced = true;
  later = false;
  notify();
}

/** On first sign-in on a device that used the old local-only Daybloom, offer to bring that data along. */
export function LocalImportPrompt() {
  const uid = useUserId();
  const open = useLocalImportPending();
  const [moods, setMoods] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const invalidate = useInvalidateUserData();

  const summary = open ? localDataSummary() : null;
  if (!summary) return null;

  const resolve = (handled: boolean) => {
    if (handled) markImportHandled(uid);
    else later = true;
    forced = false;
    setError('');
    notify();
  };
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const n = await importLocalData({ moods });
      markImported(uid);
      resolve(true);
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
    <Modal
      open
      onClose={() => !busy && resolve(false)}
      title="Bring your local data along?"
      description="This device has data from the earlier, offline-only version of Daybloom."
    >
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
      <p className="muted mt-3 text-sm">Not sure yet? Close this and we’ll ask again next time. You can also import later from Settings → Your data.</p>
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="btn-ghost" onClick={() => resolve(true)} disabled={busy}>
          Don't import
        </button>
        <button className="btn-primary" onClick={run} disabled={busy}>
          {busy ? 'Importing…' : 'Import my data'}
        </button>
      </div>
    </Modal>
  );
}
