import { ArrowLeft, ArrowRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNotes, useUpdateNote } from '../../hooks/data/notes';
import { timeAgo } from '../../lib/dates';
import type { Note } from '../../lib/types';
import { LoadingList } from '../ui/States';
import { Menu, MenuItem } from '../ui/Menu';
import { Modal } from '../ui/Modal';
import { ConvertDialog, type ConvertKind } from './ConvertDialog';
import { Markdown, toggleCheckLine } from './Markdown';
import { OUTCOMES, STATE_LABEL, type Outcome } from './outcomes';

/** The six main decisions get number keys 1–6; habit and goal sit under "More". */
const MAIN = OUTCOMES.slice(0, 6);
const EXTRA = OUTCOMES.slice(6);

type Decision = Outcome['id'] | 'delete';
const TALLY: Record<Decision, [string, string]> = {
  task: ['task', 'tasks'],
  block: ['time block', 'time blocks'],
  'goal-task': ['goal step', 'goal steps'],
  habit: ['habit', 'habits'],
  goal: ['goal', 'goals'],
  idea: ['idea', 'ideas'],
  reference: ['reference', 'references'],
  archive: ['archived', 'archived'],
  delete: ['deleted', 'deleted'],
};

interface Props {
  onClose: () => void;
  /** Moves a note (with an Undo toast). */
  onChange: (note: Note, patch: Partial<Note>) => void;
  /** Deletes a note (with an Undo toast). */
  onDelete: (note: Note) => void;
}

/** Goes through the inbox one note at a time, oldest first. Every decision can be undone, and Back revisits the last note. */
export function ProcessInbox({ onClose, onChange, onDelete }: Props) {
  const notes = useNotes();
  const all = useMemo(() => notes.data ?? [], [notes.data]);
  const update = useUpdateNote();
  // Freeze the queue once the notes have loaded, so processed notes don't reshuffle it.
  const [queue, setQueue] = useState<string[] | null>(null);
  useEffect(() => {
    if (queue || !notes.data) return;
    setQueue(notes.data.filter((n) => n.state === 'inbox').sort((a, b) => a.created_at.localeCompare(b.created_at)).map((n) => n.id));
  }, [notes.data, queue]);
  const [index, setIndex] = useState(0);
  const [convert, setConvert] = useState<ConvertKind | null>(null);
  // What was decided for each note, so the summary is a real count (and Back + a new choice replaces the old one).
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const body = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(all.map((n) => [n.id, n])), [all]);
  const ids = queue ?? [];
  const current = byId.get(ids[index]) ?? null;
  const done = !!queue && index >= ids.length;

  // A note deleted elsewhere (or just now) is skipped rather than shown as blank.
  useEffect(() => {
    if (queue && !done && !current) setIndex((i) => i + 1);
  }, [queue, done, current]);

  const next = () => setIndex((i) => i + 1);
  const prevIndex = (() => {
    for (let j = Math.min(index, ids.length) - 1; j >= 0; j--) if (byId.has(ids[j])) return j;
    return -1;
  })();
  const back = () => prevIndex >= 0 && setIndex(prevIndex);
  const decide = (id: string, d: Decision) => setDecisions((m) => ({ ...m, [id]: d }));

  const choose = (o: Outcome) => {
    if (!current) return;
    if (o.convert) return setConvert(o.convert);
    if (o.state && o.state !== current.state) onChange(current, { state: o.state });
    decide(current.id, o.id);
    next();
  };
  const remove = () => {
    if (!current) return;
    onDelete(current);
    decide(current.id, 'delete');
    next();
  };

  // Keyboard: 1–6 choose, ← goes back, → skips. Ignored while typing or when another layer is on top.
  const keys = useRef({ choose, back, next });
  keys.current = { choose, back, next };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (convert || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const dialog = body.current?.closest('[role="dialog"]');
      const active = document.activeElement as HTMLElement | null;
      if (!dialog || (active && active !== document.body && !dialog.contains(active))) return;
      if (active?.matches('input, textarea, select, [contenteditable="true"]') || active?.closest('[role="menu"]')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= MAIN.length) keys.current.choose(MAIN[n - 1]);
      else if (e.key === 'ArrowLeft') keys.current.back();
      else if (e.key === 'ArrowRight') keys.current.next();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [convert]);

  // An honest summary: only count decisions that still hold (an Undo puts the note back in the inbox).
  const counted = Object.entries(decisions).filter(([id, d]) => {
    const n = byId.get(id);
    if (d === 'delete') return !n;
    if (!n) return false;
    const o = OUTCOMES.find((x) => x.id === d);
    return o?.state ? n.state === o.state : true;
  });
  const tally = Object.entries(
    counted.reduce<Partial<Record<Decision, number>>>((acc, [, d]) => ((acc[d] = (acc[d] ?? 0) + 1), acc), {}),
  )
    .map(([d, c]) => `${c} ${TALLY[d as Decision][c === 1 ? 0 : 1]}`)
    .join(' · ');
  const stillInInbox = all.filter((n) => n.state === 'inbox').length;
  const sorted = ids.filter((id) => byId.get(id)?.state !== 'inbox').length;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Process inbox"
        description={!queue || done || !current ? undefined : `Note ${Math.min(index + 1, ids.length)} of ${ids.length} — decide what each one is.`}
        className="max-w-2xl"
      >
        <div ref={body}>
          {!queue ? (
            <LoadingList rows={3} label="Loading your inbox" />
          ) : done || !current ? (
            <div className="py-6 text-center motion-safe:animate-fade-in">
              {ids.length && stillInInbox === 0 ? (
                <>
                  <p className="text-3xl" aria-hidden>
                    🌸
                  </p>
                  <p className="mt-3 text-lg font-semibold">Inbox zero</p>
                  <p className="muted mt-1 text-sm">Everything you captured has a place. Clear head.</p>
                </>
              ) : ids.length ? (
                <>
                  <p className="text-lg font-semibold">That’s the lot for now</p>
                  <p className="muted mt-1 text-sm">
                    {stillInInbox} note{stillInInbox === 1 ? '' : 's'} still in your inbox for next time.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">Your inbox is already empty</p>
                  <p className="muted mt-1 text-sm">Capture something with N or the + button.</p>
                </>
              )}
              {counted.length > 0 && (
                <p className="faint mt-3 text-xs">
                  You processed {counted.length} note{counted.length === 1 ? '' : 's'}: {tally}.
                </p>
              )}
              <div className="mt-5 flex justify-center gap-2">
                {prevIndex >= 0 && (
                  <button className="btn-ghost" onClick={back}>
                    <ArrowLeft size={15} aria-hidden /> Back
                  </button>
                )}
                <button className="btn-primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div className="h-full origin-left bg-accent transition-transform duration-base ease-out" style={{ transform: `scaleX(${sorted / ids.length})` }} />
                </div>
                <span className="faint shrink-0 text-xs tabular-nums">
                  {sorted} sorted · {ids.length - sorted} left
                </span>
              </div>
              <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-2xl border border-line bg-raised p-4">
                <p className="faint mb-2 text-xs">
                  Captured {timeAgo(current.created_at)}
                  {current.state !== 'inbox' && <span className="font-medium text-ink"> · Already sorted: {STATE_LABEL[current.state]}</span>}
                </p>
                <Markdown text={current.body} onToggleCheck={(i) => update.mutate({ id: current.id, patch: { body: toggleCheckLine(current.body, i) } })} />
              </div>
              <h3 className="mb-2 mt-4 text-sm font-semibold">What is it?</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MAIN.map((o, i) => (
                  <button key={o.id} className="btn-ghost justify-start" onClick={() => choose(o)} title={o.hint} aria-keyshortcuts={String(i + 1)}>
                    <o.icon size={16} className="shrink-0 text-muted" aria-hidden /> <span className="min-w-0 flex-1 whitespace-normal text-left leading-tight">{o.label}</span>
                    <kbd className="kbd hidden !px-1 !py-0 sm:inline-flex" aria-hidden>
                      {i + 1}
                    </kbd>
                  </button>
                ))}
              </div>
              <p className="faint mt-2 text-xs">
                {MAIN.find((o) => o.id === 'reference')!.label}: {MAIN.find((o) => o.id === 'reference')!.hint}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button className="btn-ghost !px-3" onClick={back} disabled={prevIndex < 0} aria-keyshortcuts="ArrowLeft">
                  <ArrowLeft size={14} aria-hidden /> Back
                </button>
                <Menu
                  label="More choices"
                  triggerClassName="btn-ghost !px-3"
                  align="left"
                  trigger={
                    <>
                      <MoreHorizontal size={14} aria-hidden /> More
                    </>
                  }
                >
                  {(close) => (
                    <>
                      {EXTRA.map((o) => (
                        <MenuItem key={o.id} onClick={() => (close(), choose(o))}>
                          <o.icon size={15} className="text-muted" aria-hidden /> {o.label}
                        </MenuItem>
                      ))}
                      <MenuItem danger onClick={() => (close(), remove())}>
                        <Trash2 size={15} aria-hidden /> Delete note
                      </MenuItem>
                    </>
                  )}
                </Menu>
                <button className="btn-ghost ml-auto !px-3" onClick={next} aria-keyshortcuts="ArrowRight">
                  Skip <ArrowRight size={14} aria-hidden />
                </button>
              </div>
              <p className="faint mt-3 hidden text-xs sm:block">
                Keys: <kbd className="kbd">1</kbd>–<kbd className="kbd">6</kbd> choose, <kbd className="kbd">←</kbd> back, <kbd className="kbd">→</kbd> skip. Every choice can be undone.
              </p>
            </div>
          )}
        </div>
      </Modal>
      {convert && current && (
        <ConvertDialog
          note={current}
          kind={convert}
          onClose={() => setConvert(null)}
          onDone={() => {
            decide(current.id, convert);
            next();
          }}
        />
      )}
    </>
  );
}
