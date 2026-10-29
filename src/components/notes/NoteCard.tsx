import { Archive, ArchiveRestore, ArrowRightLeft, ListTodo, MoreHorizontal, Pencil, Pin, PinOff, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { timeAgo } from '../../lib/dates';
import type { Note } from '../../lib/types';
import { cn } from '../../lib/utils';
import type { ConvertKind } from './ConvertDialog';
import { checklistProgress, Markdown, toggleCheckLine } from './Markdown';

export type NoteAiAction = 'extract' | 'summarize' | 'plan';

const STATE_LABEL: Record<Note['state'], string> = { inbox: 'Inbox', idea: 'Idea', note: 'Note', archived: 'Archived' };
const STATE_STYLE: Record<Note['state'], string> = {
  inbox: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  idea: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  note: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  archived: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
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
}

function Menu({ label, icon, children, align = 'right' }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn h-8 w-8" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label}>
        {icon}
      </button>
      {open && (
        <div role="menu" className={cn('absolute top-full z-20 mt-1 w-56 animate-fade-in rounded-xl border border-slate-900/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#17142a]', align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Item({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button role="menuitem" disabled={disabled} onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-900/5 disabled:opacity-40 dark:hover:bg-white/5">
      {children}
    </button>
  );
}

/** A Brain Dump note with its actions. Presentational: all changes go through callbacks. */
export function NoteCard({ note, links, showState, highlight, onChange, onDelete, onConvert, onAi, aiBusy, aiDisabled }: Props) {
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
      className={cn('glass group p-4 transition', highlight && 'ring-2 ring-violet-400', note.pinned && 'border-violet-400/40')}
      aria-label={`Note from ${timeAgo(note.created_at)}`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        {note.pinned && <Pin size={12} className="text-violet-500" aria-label="Pinned" />}
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
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-900/5 pt-2 dark:border-white/5">
          {onConvert && (
            <Menu label="Convert" icon={<ArrowRightLeft size={15} />} align="left">
              {(close) => (
                <>
                  <p className="faint px-2.5 pb-1 pt-1.5 text-[11px]">Select text first to use just that part.</p>
                  <Item onClick={() => (close(), onConvert('task'))}>✅ Make task</Item>
                  <Item onClick={() => (close(), onConvert('block'))}>🗓️ Schedule in Planner</Item>
                  <Item onClick={() => (close(), onConvert('goal-task'))}>🎯 Add to a goal</Item>
                  <Item onClick={() => (close(), onConvert('habit'))}>🔁 Make habit</Item>
                  <Item onClick={() => (close(), onConvert('goal'))}>🏁 Make goal</Item>
                </>
              )}
            </Menu>
          )}
          {onAi && (
            <Menu label="AI actions" icon={aiBusy ? <Sparkles size={15} className="animate-pulse text-violet-500" /> : <Sparkles size={15} />} align="left">
              {(close) => (
                <>
                  <p className="faint px-2.5 pb-1 pt-1.5 text-[11px]">Each uses 1 of your daily ✨ AI actions.</p>
                  <Item disabled={aiDisabled || !!aiBusy} onClick={() => (close(), onAi('extract'))}>
                    ✨ Extract actions
                  </Item>
                  <Item disabled={aiDisabled || !!aiBusy} onClick={() => (close(), onAi('summarize'))}>
                    ✨ Summarize
                  </Item>
                  <Item disabled={aiDisabled || !!aiBusy} onClick={() => (close(), onAi('plan'))}>
                    ✨ Turn into a plan
                  </Item>
                </>
              )}
            </Menu>
          )}
          {onChange && note.state === 'inbox' && (
            <button className="chip-off ml-1" onClick={() => onChange({ state: 'idea' })}>
              💡 Keep as idea
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
              <Menu label="More" icon={<MoreHorizontal size={15} />}>
                {(close) => (
                  <Item onClick={() => (close(), onDelete())}>
                    <Trash2 size={14} className="text-rose-500" /> Delete note
                  </Item>
                )}
              </Menu>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
