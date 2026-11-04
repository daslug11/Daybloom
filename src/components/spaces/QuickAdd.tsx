/**
 * The quick-add bar on every Space. Reads what you type with the Space's own
 * fields, locally and instantly (no AI), and shows what it understood as chips
 * before you press Enter. Pasting several lines offers to add them all.
 */
import { CornerDownLeft, ListPlus } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { parseList, parseQuickAdd, defaultValues, normalizeValues, LIMITS, type Field, type ItemValues, type SpaceDesign } from '../../lib/spaces';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';

const HINTS: Record<string, string> = {
  christmas: 'Mom airpods $130 amazon.com',
  birthdays: 'Alex concert tickets $80 dec 12',
  workouts: 'Squat 3 sets 8 reps 60kg',
  running: '5k 28:30 felt great',
  reading: 'Dune by Frank Herbert reading',
  watchlist: 'Severance watching Apple TV',
  packing: 'Phone charger tech',
  budget: 'Lunch $12 food',
  assignments: 'Lab report due friday',
  college: 'State University applying jan 15',
  jobs: 'Barista Corner Café applied',
  meals: 'Pasta dinner tomorrow',
  recipes: 'Shakshuka 30 min 5/5 #brunch',
  wishlist: 'Headphones $199 must have',
};

/** An example line built from the Space's own fields, for the placeholder. */
const NAME_HINTS: [RegExp, string][] = [
  [/christmas|gift|present|secret santa/i, 'christmas'],
  [/birthday/i, 'birthdays'],
  [/run|jog/i, 'running'],
  [/workout|gym|lift/i, 'workouts'],
  [/read|book/i, 'reading'],
  [/watch|movie|film|show/i, 'watchlist'],
  [/pack|trip/i, 'packing'],
  [/budget|spend|expense/i, 'budget'],
  [/assignment|homework|class/i, 'assignments'],
  [/college|universit/i, 'college'],
  [/job|application/i, 'jobs'],
  [/meal/i, 'meals'],
  [/recipe/i, 'recipes'],
  [/wish/i, 'wishlist'],
];

/** An example line for the placeholder: the template's own, else one built from the Space's fields. */
export function quickAddHint(design: SpaceDesign, templateId?: string | null, name = ''): string {
  if (templateId && HINTS[templateId]) return HINTS[templateId];
  const guess = NAME_HINTS.find(([re]) => re.test(name))?.[1];
  const tpl = guess ? HINTS[guess] : null;
  // Only use a guessed example if this Space can read every part of it.
  if (tpl) {
    const types = new Set(design.fields.map((f) => f.type));
    const needs: [RegExp, Field['type']][] = [[/\$\d/, 'money'], [/\.(com|org)/, 'link'], [/\d:\d\d|\d+ min/, 'duration']];
    if (needs.every(([re, t]) => !re.test(tpl) || types.has(t))) return tpl;
  }
  const bits: string[] = [];
  if (design.fields.some((f) => f.type === 'person')) bits.push('Sam');
  bits.push('something');
  for (const f of design.fields) {
    if (f.type === 'money') bits.push('$25');
    else if (f.type === 'date') bits.push('tomorrow');
    else if (f.type === 'tags') bits.push('#idea');
    else if (f.type === 'duration') bits.push('30 min');
    else if (f.type === 'link') bits.push('example.com');
    if (bits.length >= 4) break;
  }
  return bits.join(' ');
}

interface Props {
  design: SpaceDesign;
  today: string;
  people: string[];
  templateId?: string | null;
  onAdd: (values: ItemValues[], label?: string) => Promise<unknown>;
  disabled?: boolean;
  /** Space name, for labels. */
  name: string;
}

export function QuickAdd({ design, today, people, templateId, onAdd, disabled, name }: Props) {
  const [text, setText] = useState('');
  const [paste, setPaste] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, design, { today, people }) : null), [text, design, today, people]);
  const primary = design.fields.find((f) => f.key === design.primary);

  const submit = async () => {
    if (!parsed || !text.trim()) return;
    const values = normalizeValues(design, { ...defaultValues(design, today), ...parsed.values });
    setText('');
    await onAdd([values]);
    input.current?.focus();
  };

  return (
    <>
      <form
        className="card flex items-center gap-2 p-2 pl-3 focus-within:border-ink/60"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="space-quick-add" className="sr-only">Add to {name}</label>
        <input
          id="space-quick-add"
          ref={input}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none placeholder:text-faint focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
          placeholder={`Add… e.g. ${quickAddHint(design, templateId, name)}`}
          value={text}
          disabled={disabled}
          maxLength={500}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            if (t.split(/\r?\n/).filter((l) => l.trim()).length > 1) {
              e.preventDefault();
              setPaste(t);
            }
          }}
          aria-describedby="space-quick-add-chips"
        />
        <button type="button" className="icon-btn" onClick={() => setPaste('')} aria-label="Paste a list" title="Paste a list">
          <ListPlus size={17} aria-hidden />
        </button>
        <button type="submit" className={cn('!min-h-9 !px-3 !py-1.5', text.trim() ? 'btn-primary' : 'btn-ghost')} disabled={!text.trim() || disabled} aria-label="Add">
          <CornerDownLeft size={15} aria-hidden />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>
      <div id="space-quick-add-chips" aria-live="polite" className={cn('flex min-h-0 flex-wrap gap-1.5 px-1 transition-opacity duration-fast', parsed ? 'mt-2 opacity-100' : 'h-0 opacity-0')}>
        {parsed && (
          <>
            {parsed.chips.map((c) => (
              <span key={c.field} className="inline-flex max-w-full items-center truncate rounded-full border border-line-strong bg-raised px-2.5 py-0.5 text-xs font-medium">
                {c.label}
              </span>
            ))}
            {primary && typeof parsed.values[primary.key] === 'string' && (
              <span className="inline-flex max-w-full items-center truncate rounded-full border border-ink/40 bg-ink/[0.06] px-2.5 py-0.5 text-xs font-medium">
                {primary.name}: {String(parsed.values[primary.key]).slice(0, 60)}
              </span>
            )}
          </>
        )}
      </div>
      <PasteDialog open={paste !== null} initial={paste ?? ''} onClose={() => setPaste(null)} design={design} today={today} people={people} onAdd={onAdd} />
    </>
  );
}

export function PasteDialog({ open, initial, onClose, design, today, people, onAdd }: { open: boolean; initial: string; onClose: () => void; design: SpaceDesign; today: string; people: string[]; onAdd: Props['onAdd'] }) {
  const [text, setText] = useState(initial);
  const [last, setLast] = useState(initial);
  if (initial !== last) {
    setLast(initial);
    setText(initial);
  }
  const rows = useMemo(() => parseList(text, design, { today, people }, LIMITS.pasteLines), [text, design, today, people]);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const primary = design.fields.find((f) => f.key === design.primary);
  return (
    <Modal open={open} onClose={onClose} title="Paste a list" description="One item per line, from Notes, a message or a web page. Bullets, numbers and checkboxes are cleaned up; a line like “Mom:” sets the person for the lines under it.">
      <label htmlFor="paste-list" className="label">List</label>
      <textarea id="paste-list" className="input min-h-[140px] font-mono !text-sm" value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={'- scarf $40\n- book\n- socks'} />
      {rows.length > 0 && (
        <div className="mt-4">
          <p className="label">Preview · {rows.length} item{rows.length === 1 ? '' : 's'}{lines > LIMITS.pasteLines ? ` (first ${LIMITS.pasteLines} lines)` : ''}</p>
          <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-control border border-line">
            {rows.slice(0, 100).map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">{primary ? String(r.values[primary.key] ?? '—') : '—'}</span>
                {r.chips.map((c) => (
                  <span key={c.field} className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{c.label}</span>
                ))}
              </li>
            ))}
            {rows.length > 100 && <li className="px-3 py-2 text-xs text-muted">…and {rows.length - 100} more</li>}
          </ul>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn-primary"
          disabled={!rows.length}
          onClick={async () => {
            const values = rows.map((r) => normalizeValues(design, { ...defaultValues(design, today), ...r.values }));
            onClose();
            await onAdd(values, `Added ${values.length} item${values.length === 1 ? '' : 's'} from your list`);
          }}
        >
          Add {rows.length || ''} item{rows.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
