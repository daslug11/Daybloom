/** Every field of one item. Saves as you go (on blur / choice), with Undo from the toast. */
import { Copy, FolderInput, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatValue, itemTitle, normalizeValues, valueOf, type ItemValues, type SpaceDesign, type SpaceItem } from '../../lib/spaces';
import { Modal } from '../ui/Modal';
import { FieldInput } from './fields';

interface Props {
  item: SpaceItem | null;
  design: SpaceDesign;
  today: string;
  people: string[];
  onClose: () => void;
  onSave: (item: SpaceItem, values: ItemValues) => void;
  onDelete: (item: SpaceItem) => void;
  onDuplicate: (item: SpaceItem) => void;
  onMove?: (item: SpaceItem) => void;
}

export function ItemEditor({ item, design, today, people, onClose, onSave, onDelete, onDuplicate, onMove }: Props) {
  const [draft, setDraftState] = useState<ItemValues>(item?.values ?? {});
  // The latest values, so saves fired from blur handlers or timers never see a stale draft.
  const latest = useRef(draft);
  const setDraft = (v: ItemValues) => {
    latest.current = v;
    setDraftState(v);
  };
  const base = useId();
  useEffect(() => setDraft(item?.values ?? {}), [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const commit = (next = latest.current) => {
    const clean = normalizeValues(design, next);
    if (JSON.stringify(clean) !== JSON.stringify(normalizeValues(design, item.values))) onSave(item, clean);
  };
  const set = (key: string, v: unknown, saveNow = false) => {
    const next = { ...latest.current };
    if (v === undefined || v === '' || v === false) delete next[key];
    else next[key] = v;
    setDraft(next);
    if (saveNow) commit(next);
  };

  return (
    <Modal open={!!item} onClose={() => (commit(), onClose())} title={itemTitle(design, { ...item, values: draft })} description="Changes save as you go." className="sm:max-w-xl">
      <div className="space-y-4">
        {design.fields.map((f) => {
          const id = `${base}-${f.key}`;
          if (f.type === 'computed') {
            const text = formatValue(design, f, valueOf(design, f, { ...item, values: draft }, today));
            return (
              <div key={f.key}>
                <p className="label">{f.name} <span className="font-normal text-faint">· worked out for you</span></p>
                <p className="text-sm tabular-nums">{text || <span className="text-faint">Fill in {f.compute?.fields.map((k) => design.fields.find((x) => x.key === k)?.name).join(' and ')}</span>}</p>
              </div>
            );
          }
          const instant = ['status', 'rating', 'checkbox', 'image', 'date'].includes(f.type);
          return (
            <div key={f.key}>
              {f.type !== 'checkbox' && (
                <label htmlFor={id} className="label">
                  {f.name}
                  {f.private && <span className="font-normal text-faint"> · hidden on shared links</span>}
                </label>
              )}
              <FieldInput field={f} value={draft[f.key]} onChange={(v) => set(f.key, v, instant)} onCommit={() => commit()} id={id} people={people} />
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <button type="button" className="btn-ghost" onClick={() => (commit(), onDuplicate(item))}>
          <Copy size={15} aria-hidden /> Duplicate
        </button>
        {onMove && (
          <button type="button" className="btn-ghost" onClick={() => (commit(), onMove(item))}>
            <FolderInput size={15} aria-hidden /> Move to…
          </button>
        )}
        <button type="button" className="btn-danger ml-auto" onClick={() => onDelete(item)}>
          <Trash2 size={15} aria-hidden /> Delete
        </button>
      </div>
    </Modal>
  );
}
