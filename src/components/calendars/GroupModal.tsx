import { useEffect, useState } from 'react';
import type { CalendarGroup } from '../../lib/types';
import { Modal } from '../ui/Modal';
import { ColorSwatches } from './ColorSwatches';

const SUGGESTIONS = ['💼 Work', '🏠 Personal', '🎓 School', '🏋️ Fitness', '👨‍👩‍👧 Family', '🎉 Social'];

interface Props {
  open: boolean;
  initial: CalendarGroup | null;
  onClose: () => void;
  onSave: (data: { name: string; color: number }) => void;
}

export function GroupModal({ open, initial, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(0);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setColor(initial?.color ?? Math.floor(Math.random() * 8));
  }, [open, initial]);

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit group 🗂️' : 'New group 🗂️'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave({ name: name.trim(), color });
        }}
        className="space-y-5"
      >
        <div>
          <label className="label" htmlFor="group-name">Name (emojis encouraged)</label>
          <input id="group-name" autoFocus className="input" placeholder="🏋️ Fitness" value={name} onChange={(e) => setName(e.target.value)} />
          {!initial && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button type="button" key={s} className="chip-off" onClick={() => setName(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="label">Color</span>
          <ColorSwatches value={color} onChange={setColor} />
        </div>
        <button className="btn-primary w-full" disabled={!name.trim()}>{initial ? 'Save group' : 'Create group'}</button>
      </form>
    </Modal>
  );
}
