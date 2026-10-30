import { ArrowRight, CalendarClock, Lightbulb, ListChecks, Target, Trash2, Archive } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeleteNote, useNotes, useUpdateNote } from '../../hooks/data/notes';
import { timeAgo } from '../../lib/dates';
import { Modal } from '../ui/Modal';
import { ConvertDialog, type ConvertKind } from './ConvertDialog';
import { Markdown, toggleCheckLine } from './Markdown';

/** Goes through the inbox one note at a time, oldest first. */
export function ProcessInbox({ onClose }: { onClose: () => void }) {
  const { data: notes = [] } = useNotes();
  const update = useUpdateNote();
  const del = useDeleteNote();
  // Freeze the queue when the session starts so processed notes don't reshuffle it.
  const [queue] = useState(() => notes.filter((n) => n.state === 'inbox').sort((a, b) => a.created_at.localeCompare(b.created_at)).map((n) => n.id));
  const [index, setIndex] = useState(0);
  const [convert, setConvert] = useState<ConvertKind | null>(null);
  const [handled, setHandled] = useState(0);
  const current = useMemo(() => notes.find((n) => n.id === queue[index]) ?? null, [notes, queue, index]);
  const next = () => setIndex((i) => i + 1);
  const act = (fn: () => void) => {
    fn();
    setHandled((h) => h + 1);
    next();
  };

  const done = index >= queue.length;
  return (
    <>
      <Modal open onClose={onClose} title="Process inbox" description={done ? undefined : `Note ${Math.min(index + 1, queue.length)} of ${queue.length} — decide what each one is.`} className="max-w-xl">
        {done || !current ? (
          <div className="py-6 text-center">
            <div className="text-4xl" aria-hidden>
              🎉
            </div>
            <p className="mt-3 font-semibold">{queue.length ? 'Inbox zero!' : 'Your inbox is already empty.'}</p>
            <p className="muted mt-1 text-sm">{queue.length ? `You processed ${handled} note${handled === 1 ? '' : 's'}.` : 'Capture something with N or the + button.'}</p>
            <button className="btn-primary mt-5" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full bg-accent transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
            </div>
            <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-2xl border border-line bg-raised p-4">
              <p className="faint mb-2 text-xs">Captured {timeAgo(current.created_at)}</p>
              <Markdown text={current.body} onToggleCheck={(i) => update.mutate({ id: current.id, patch: { body: toggleCheckLine(current.body, i) } })} />
            </div>
            <h3 className="mb-2 mt-4 text-sm font-semibold">What is it?</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button className="btn-ghost justify-start" onClick={() => setConvert('task')}>
                <ListChecks size={16} className="text-muted" /> Make task
              </button>
              <button className="btn-ghost justify-start" onClick={() => setConvert('block')}>
                <CalendarClock size={16} className="text-muted" /> Schedule
              </button>
              <button className="btn-ghost justify-start" onClick={() => setConvert('goal-task')}>
                <Target size={16} className="text-muted" /> Add to goal
              </button>
              <button className="btn-ghost justify-start" onClick={() => act(() => update.mutate({ id: current.id, patch: { state: 'idea' } }))}>
                <Lightbulb size={16} className="text-muted" /> Keep as idea
              </button>
              <button className="btn-ghost justify-start" onClick={() => act(() => update.mutate({ id: current.id, patch: { state: 'archived' } }))}>
                <Archive size={16} /> Archive
              </button>
              <button className="btn-ghost justify-start" onClick={() => act(() => update.mutate({ id: current.id, patch: { state: 'note' } }))}>
                📄 Keep as note
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button className="btn-ghost !px-3 !py-1.5 text-danger" onClick={() => act(() => del.mutate(current.id))}>
                <Trash2 size={14} /> Delete
              </button>
              <button className="btn-ghost !px-3 !py-1.5" onClick={next}>
                Skip <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Modal>
      {convert && current && (
        <ConvertDialog
          note={current}
          kind={convert}
          onClose={() => setConvert(null)}
          onDone={() => {
            setHandled((h) => h + 1);
            next();
          }}
        />
      )}
    </>
  );
}
