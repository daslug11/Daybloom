import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CALENDAR_EMOJIS, detectCalendarType, gradient, isGoogleEmbed, validateCalendarUrl } from '../../lib/calendars';
import type { CalendarGroup, CalendarLink } from '../../lib/types';
import { EmojiPicker } from '../EmojiPicker';
import { Modal } from '../Modal';
import { ColorSwatches } from './ColorSwatches';
import { TypeBadge } from './TypeBadge';

export type CalendarDraft = Pick<CalendarLink, 'name' | 'url' | 'emoji' | 'color' | 'groupId'>;

interface Props {
  open: boolean;
  initial: CalendarLink | null;
  groups: CalendarGroup[];
  defaultGroupId?: string | null;
  onClose: () => void;
  onSave: (draft: CalendarDraft) => void;
}

export function CalendarModal({ open, initial, groups, defaultGroupId = null, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<CalendarDraft>({ name: '', url: '', emoji: '📅', color: 0, groupId: null });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setDraft(
      initial
        ? { name: initial.name, url: initial.url, emoji: initial.emoji, color: initial.color, groupId: initial.groupId }
        : { name: '', url: '', emoji: '📅', color: Math.floor(Math.random() * 8), groupId: defaultGroupId },
    );
  }, [open, initial, defaultGroupId]);

  const urlError = validateCalendarUrl(draft.url);
  const showError = touched && !!urlError;
  const type = detectCalendarType(draft.url);
  const nameError = touched && !draft.name.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (urlError || !draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim(), url: draft.url.trim() });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit calendar ✏️' : 'Add calendar 📅'}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {/* Live preview */}
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-900/10 bg-white/40 dark:border-white/10 dark:bg-white/5">
          <div className="h-16 w-1.5 self-stretch" style={{ background: gradient(draft.color, '180deg') }} />
          <span className="text-2xl">{draft.emoji}</span>
          <div className="min-w-0 py-3">
            <div className="truncate font-semibold">{draft.name || 'My calendar'}</div>
            <TypeBadge type={type} className="mt-1" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cal-name">Name</label>
          <input
            id="cal-name"
            autoFocus
            className="input"
            placeholder="e.g. Team standups"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-invalid={nameError}
          />
          {nameError && <p className="mt-1.5 text-xs text-rose-500">Give it a name so future-you knows what it is ✍️</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="label !mb-0" htmlFor="cal-url">URL</label>
            {draft.url.trim() && !urlError && <TypeBadge type={type} />}
          </div>
          <input
            id="cal-url"
            className={`input font-mono text-xs ${showError ? '!border-rose-400 !ring-rose-500/30' : ''}`}
            placeholder="https://calendar.google.com/calendar/embed?src=…"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            onBlur={() => draft.url && setTouched(true)}
            aria-invalid={showError}
            aria-describedby="cal-url-help"
            inputMode="url"
          />
          <AnimatePresence initial={false}>
            {showError ? (
              <motion.p
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                id="cal-url-help"
                className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-500"
              >
                <AlertCircle size={13} /> {urlError}
              </motion.p>
            ) : (
              <p id="cal-url-help" className="muted mt-1.5 text-xs">
                {isGoogleEmbed(draft.url)
                  ? '✨ Google embed link detected — you can preview it right in the card.'
                  : 'Google, Outlook, iCloud, Notion, Calendly, .ics/webcal feeds — anything with a link.'}
              </p>
            )}
          </AnimatePresence>
        </div>

        <div>
          <span className="label">Emoji</span>
          <EmojiPicker options={CALENDAR_EMOJIS} value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
        </div>

        <div>
          <span className="label">Color</span>
          <ColorSwatches value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
        </div>

        <div>
          <label className="label" htmlFor="cal-group">Group</label>
          <select
            id="cal-group"
            className="input"
            value={draft.groupId ?? ''}
            onChange={(e) => setDraft({ ...draft, groupId: e.target.value || null })}
          >
            <option value="">📂 Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <button className="btn-primary w-full" type="submit">
          {initial ? 'Save changes' : 'Add calendar'} {draft.emoji}
        </button>
      </form>
    </Modal>
  );
}
