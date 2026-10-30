import { Archive, ArchiveRestore, ArrowRightLeft, Lightbulb, ListTodo, Loader2, MoreHorizontal, Pencil, Pin, PinOff, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { timeAgo } from '../../lib/dates';
import type { Note } from '../../lib/types';
import { cn } from '../../lib/utils';
import type { ConvertKind } from './ConvertDialog';
import { checklistProgress, Markdown, toggleCheckLine } from './Markdown';
import { Menu, MenuItem } from '../ui/Menu';
import { CONVERSIONS, STATE_LABEL } from './outcomes';

export type NoteAiAction = 'extract' | 'summarize' | 'plan';

/** What the card says while a ✨ action runs on it (plain text, so it also shows under reduced motion). */
const AI_PROGRESS: Record<NoteAiAction, string> = { extract: 'Finding actions…', summarize: 'Summarizing…', plan: 'Drafting a plan…' };

const STATE_STYLE: Record<Note['state'], string> = {
  inbox: 'bg-ink text-canvas',
  idea: 'border border-line-strong text-ink',
  note: 'border border-line-strong text-muted',
  archived: 'bg-raised text-faint',
};

interface Props {
  note: Note;
  /** e.g. "2 tasks · 1 habit" created from this note. */
  links?: string;
  showState?: boolean;
  highlight?: boolean;
  onChange?: (patch: Partial<Note>) => void;
  onDelete?: () => void;
  onConvert?: (kind: ConvertKind) => void;
  onAi?: (action: NoteAiAction) => void;
  aiBusy?: NoteAiAction | null;
  aiDisabled?: boolean;
  className?: string;
}

/** A Brain Dump note with its actions. Presentational: all changes go through callbacks. */
export function NoteCard({ note, links, showState, highlight, onChange, onDelete, onConvert, onAi, aiBusy, aiDisabled, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const progress = checklistProgress(note.body);
  const long = note.body.length > 600;

  useEffect(() => setDraft(note.body), [note.body]);

  const saveEdit = () => {
    setEditing(false);
    if (draft.trim() && draft !== note.body) onChange?.({ body: draft.trim() });
  };

  return (
    <article
      id={`note-${note.id}`}
      data-note-id={note.id}
      className={cn('card group p-4 transition-colors duration-fast', highlight && 'ring-2 ring-ink/40', note.pinned && 'border-ink/40', className)}
      aria-label={`Note from ${timeAgo(note.created_at)}`}
      aria-busy={aiBusy ? true : undefined}
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        {note.pinned && <Pin size={12} className="text-ink" aria-label="Pinned" />}
        {showState && <span className={cn('rounded-full px-2 py-0.5 font-semibold', STATE_STYLE[note.state])}>{STATE_LABEL[note.state]}</span>}
        <time className="faint" dateTime={note.created_at}>
          {timeAgo(note.created_at)}
        </time>
        {progress.total > 0 && (
          <span className="faint inline-flex items-center gap-1">
            <ListTodo size={12} aria-hidden /> {progress.done}/{progress.total}
          </span>
        )}
        {links && <span className="faint truncate">→ {links}</span>}
        {/* Always rendered, so screen readers announce the text when it appears. */}
        {onAi && (
          <span role="status" className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-atlas">
            {aiBusy && (
              <>
                <Sparkles size={12} aria-hidden /> {AI_PROGRESS[aiBusy]}
              </>
            )}
          </span>
        )}
      </div>

      {editing ? (
        <div>
          <label htmlFor={`edit-${note.id}`} className="sr-only">
            Edit note
          </label>
          <textarea
            id={`edit-${note.id}`}
            autoFocus
            className="input min-h-[120px] resize-y text-sm"
            value={draft}
            maxLength={20000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
              if (e.key === 'Escape') {
                setDraft(note.body);
                setEditing(false);
              }
            }}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button className="btn-ghost !px-3 !py-1.5" onClick={() => (setDraft(note.body), setEditing(false))}>
              Cancel
            </button>
            <button className="btn-primary !px-3 !py-1.5" onClick={saveEdit}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div onDoubleClick={() => onChange && setEditing(true)}>
          <Markdown text={note.body} maxLines={long ? 14 : undefined} onToggleCheck={onChange ? (i) => onChange({ body: toggleCheckLine(note.body, i) }) : undefined} />
        </div>
      )}

      {!editing && (onChange || onConvert || onAi) && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-2">
          {onConvert && (
            <Menu label="Convert" trigger={<ArrowRightLeft size={15} />} align="left">
              {(close) => (
                <>
                  <p className="faint px-2.5 pb-1 pt-1.5 text-xs">Select text first to use just that part.</p>
                  {CONVERSIONS.map(({ id, label, icon: Icon, convert }) => (
                    <MenuItem key={id} onClick={() => (close(), onConvert(convert!))}>
                      <Icon size={15} className="text-muted" aria-hidden /> {label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
          )}
          {onAi && (
            <Menu label="AI actions" trigger={aiBusy ? <Loader2 size={15} className="animate-spin text-ink" aria-hidden /> : <Sparkles size={15} />} align="left">
              {(close) => (
                <>
                  <p className="faint px-2.5 pb-1 pt-1.5 text-xs">Each uses 1 of your daily ✨ AI actions.</p>
                  <MenuItem disabled={aiDisabled || !!aiBusy} onClick={() => (close(), onAi('extract'))}>
                    ✨ Extract actions
                  </MenuItem>
                  <MenuItem disabled={aiDisabled || !!aiBusy} onClick={() => (close(), onAi('summarize'))}>
                    ✨ Summarize
                  </MenuItem>
                  <MenuItem disabled={aiDisabled || !!aiBusy} onClick={() => (close(), onAi('plan'))}>
                    ✨ Turn into a plan
                  </MenuItem>
                </>
              )}
            </Menu>
          )}
          {onChange && note.state === 'inbox' && (
            <button className="chip-off ml-1 inline-flex items-center gap-1.5" onClick={() => onChange({ state: 'idea' })}>
              <Lightbulb size={13} aria-hidden /> Keep as idea
            </button>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            {onChange && (
              <>
                <button className="icon-btn h-8 w-8" onClick={() => onChange({ pinned: !note.pinned })} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} title={note.pinned ? 'Unpin' : 'Pin to top'}>
                  {note.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                </button>
                <button className="icon-btn h-8 w-8" onClick={() => setEditing(true)} aria-label="Edit note" title="Edit">
                  <Pencil size={15} />
                </button>
                {note.state === 'archived' ? (
                  <button className="icon-btn h-8 w-8" onClick={() => onChange({ state: 'note' })} aria-label="Restore note" title="Restore">
                    <ArchiveRestore size={15} />
                  </button>
                ) : (
                  <button className="icon-btn h-8 w-8" onClick={() => onChange({ state: 'archived' })} aria-label="Archive note" title="Archive">
                    <Archive size={15} />
                  </button>
                )}
              </>
            )}
            {onDelete && (
              <Menu label="More" trigger={<MoreHorizontal size={15} />}>
                {(close) => (
                  <MenuItem danger onClick={() => (close(), onDelete())}>
                    <Trash2 size={14} className="text-danger" /> Delete note
                  </MenuItem>
                )}
              </Menu>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
