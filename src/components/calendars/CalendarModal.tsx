import { AlertCircle, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CALENDAR_EMOJIS, calendarColor, detectCalendarType, calendarTile, isGoogleEmbed, looksLikeFeed, suggestCalendarName, validateCalendarUrl } from '../../lib/calendars';
import type { CalendarGroup, CalendarLink } from '../../lib/types';
import type { CalendarDraft } from '../../hooks/data/calendars';
import { EmojiPicker } from '../ui/EmojiPicker';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { ColorSwatches } from './ColorSwatches';
import { IcsHelp } from './IcsHelp';
import { TypeBadge } from './TypeBadge';

export type { CalendarDraft };

interface Props {
  open: boolean;
  initial: CalendarLink | null;
  groups: CalendarGroup[];
  defaultGroupId?: string | null;
  onClose: () => void;
  onSave: (draft: CalendarDraft) => void;
}

export function CalendarModal({ open, initial, groups, defaultGroupId = null, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<CalendarDraft>({ name: '', url: '', emoji: '📅', color: 0, group_id: null, sync: false });
  const [touched, setTouched] = useState(false);
  /** Until the user flips the switch, sync follows "does this URL look like a feed?". */
  const [syncTouched, setSyncTouched] = useState(false);
  /** Until the user types a name, it follows the link ("Google Calendar", the host name…). */
  const [nameTouched, setNameTouched] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setSyncTouched(!!initial);
    setNameTouched(!!initial);
    setShowHelp(false);
    setDraft(
      initial
        ? { name: initial.name, url: initial.url, emoji: initial.emoji, color: initial.color, group_id: initial.group_id, sync: !!initial.sync }
        : { name: '', url: '', emoji: '📅', color: Math.floor(Math.random() * 8), group_id: defaultGroupId, sync: false },
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
    <Modal open={open} onClose={onClose} title={initial ? 'Edit calendar' : 'Add calendar'}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {/* Live preview */}
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface">
          <span className="ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-2xl" style={calendarTile(draft.color)}>
            {draft.emoji}
          </span>
          <div className="min-w-0 py-3">
            <div className="truncate font-semibold">{draft.name || 'My calendar'}</div>
            <TypeBadge type={type} className="mt-1" />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="label !mb-0" htmlFor="cal-url">Link</label>
            {draft.url.trim() && !urlError && <TypeBadge type={type} />}
          </div>
          <input
            id="cal-url"
            autoFocus
            className={`input font-mono text-base sm:text-xs ${showError ? '!border-danger !ring-danger/30' : ''}`}
            placeholder="webcal://… or https://…/basic.ics"
            value={draft.url}
            onChange={(e) =>
              setDraft({
                ...draft,
                url: e.target.value,
                name: nameTouched ? draft.name : suggestCalendarName(e.target.value),
                sync: syncTouched ? draft.sync : looksLikeFeed(e.target.value),
              })
            }
            onBlur={() => draft.url && setTouched(true)}
            aria-invalid={showError}
            aria-describedby="cal-url-help"
            inputMode="url"
          />
          {showError ? (
            <p id="cal-url-help" className="mt-1.5 flex animate-fade items-center gap-1.5 text-xs text-danger">
              <AlertCircle size={13} /> {urlError}
            </p>
          ) : (
            <p id="cal-url-help" className="muted mt-1.5 text-xs">
              {isGoogleEmbed(draft.url)
                ? 'Google embed link: you can preview it in the card, but it can’t sync events. For that, use the secret iCal address.'
                : 'To see its events in your Planner, paste the calendar’s secret ICS (iCal) address. Any other calendar link works as a shortcut.'}
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="cal-name">Name</label>
          <input
            id="cal-name"
            className="input"
            placeholder="e.g. Lecture timetable"
            value={draft.name}
            onChange={(e) => {
              setNameTouched(true);
              setDraft({ ...draft, name: e.target.value });
            }}
            aria-invalid={nameError}
          />
          {nameError && <p className="mt-1.5 text-xs text-danger">Give the calendar a name.</p>}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={!!draft.sync}
              onChange={(v) => {
                setSyncTouched(true);
                setDraft({ ...draft, sync: v });
              }}
              label="Sync events into the Planner"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">🔄 Sync events into the Planner</p>
              <p className="muted text-xs">Needs the calendar's ICS / iCal feed address.</p>
            </div>
          </div>
          {draft.sync && draft.url && !looksLikeFeed(draft.url) && !urlError && (
            <p className="mt-2 text-xs text-warning">
              ⚠️ This doesn't look like an ICS feed{isGoogleEmbed(draft.url) ? ' (it\'s a Google embed link)' : ''}. Sync may fail — use the secret iCal address.
            </p>
          )}
          <button type="button" className="mt-2 text-xs font-semibold text-ink hover:underline" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
            {showHelp ? 'Hide' : '🕵️ How do I find my secret ICS address?'}
          </button>
          {showHelp && (
            <div className="mt-3 border-t border-line pt-3">
              <IcsHelp />
            </div>
          )}
        </div>

        <details className="group rounded-2xl border border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Appearance
            <span className="muted ml-auto flex items-center gap-2 font-normal">
              <span aria-hidden>{draft.emoji}</span>
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: calendarColor(draft.color) }} aria-hidden />
              <ChevronDown size={16} className="transition-transform duration-fast ease-out group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <div className="space-y-4 border-t border-line p-3">
            <div>
              <span className="label">Emoji</span>
              <EmojiPicker options={CALENDAR_EMOJIS} value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
            </div>
            <div>
              <span className="label">Colour</span>
              <ColorSwatches value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
            </div>
          </div>
        </details>

        <div>
          <label className="label" htmlFor="cal-group">Group</label>
          <select
            id="cal-group"
            className="input"
            value={draft.group_id ?? ''}
            onChange={(e) => setDraft({ ...draft, group_id: e.target.value || null })}
          >
            <option value="">📂 Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <button className="btn-primary w-full" type="submit">
          {initial ? 'Save changes' : 'Add calendar'}
        </button>
      </form>
    </Modal>
  );
}
