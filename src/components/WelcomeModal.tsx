import { useState } from 'react';
import { useSettings } from '../hooks/useData';
import { Modal } from './Modal';

/** First-visit "what should we call you?" prompt. */
export function WelcomeModal() {
  const [settings, setSettings] = useSettings();
  const [name, setName] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const open = !settings.name && !dismissed;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings((s) => ({ ...s, name: name.trim() || 'Friend' }));
  };

  return (
    <Modal open={open} onClose={() => setDismissed(true)} title="Welcome to Daybloom 🌸">
      <form onSubmit={save} className="space-y-5">
        <p className="muted text-sm">
          Your all-in-one life OS. Tasks, habits, focus, goals — all in one beautifully over-designed place. ✨
          Everything stays on this device.
        </p>
        <div>
          <label className="label" htmlFor="welcome-name">What should we call you?</label>
          <input
            id="welcome-name"
            autoFocus
            className="input"
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        </div>
        <button className="btn-primary w-full" type="submit">Let's bloom 🚀</button>
      </form>
    </Modal>
  );
}
