import { Download, RotateCcw, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCalendarGroups, useCalendars, useSettings } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { importCalendarBackup, makeCalendarBackup } from '../lib/backup';
import { seedAll } from '../lib/seed';
import { Modal } from './Modal';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useSettings();
  const [calendars, setCalendars] = useCalendars();
  const [groups, setGroups] = useCalendarGroups();
  const toast = useToast();
  const [name, setName] = useState(settings.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(settings.name);
      setConfirmReset(false);
    }
  }, [open, settings.name]);

  const saveName = () => {
    if (name.trim() && name.trim() !== settings.name) {
      setSettings((s) => ({ ...s, name: name.trim() }));
      toast('Name updated 👋');
    }
  };

  const exportCalendars = () => {
    const blob = new Blob([JSON.stringify(makeCalendarBackup(calendars, groups), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daybloom-calendars-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Calendars exported 📦');
  };

  const onImport = async (file: File) => {
    try {
      const result = importCalendarBackup(JSON.parse(await file.text()), calendars, groups);
      setGroups(result.groups);
      setCalendars(result.calendars);
      toast(`Imported ${result.added} calendar${result.added === 1 ? '' : 's'} 🎉`);
    } catch (err) {
      toast(`Import failed: ${err instanceof Error ? err.message : 'invalid file'} 😬`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings ⚙️">
      <div className="space-y-6">
        <section>
          <label className="label" htmlFor="settings-name">Your name</label>
          <div className="flex gap-2">
            <input
              id="settings-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
          </div>
        </section>

        <section>
          <span className="label">Theme</span>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSettings((s) => ({ ...s, theme: t }))}
                className={settings.theme === t ? 'chip-on' : 'chip-off'}
              >
                {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            ))}
          </div>
        </section>

        <section>
          <span className="label">Calendar links backup</span>
          <p className="muted mb-3 text-sm">Export your calendars and groups as JSON, or import a backup (merges, skipping duplicates).</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={exportCalendars}>
              <Download size={16} /> Export JSON
            </button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <span className="label !text-rose-500">Danger zone</span>
          <p className="muted mb-3 text-sm">Replace everything with fresh demo data (tasks, habits, moods, goals, notes, calendars). Your name is kept.</p>
          {confirmReset ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn bg-rose-500 text-white hover:bg-rose-600"
                onClick={() => {
                  seedAll(settings.name);
                  toast('Data reset to demo 🌱');
                  onClose();
                }}
              >
                Yes, reset everything
              </button>
              <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={16} /> Reset data
            </button>
          )}
        </section>
      </div>
    </Modal>
  );
}
