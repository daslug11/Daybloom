/**
 * The live preview shown before a Space is saved (new, from Atlas, or ✨ Redesign):
 * the real views and summary cards rendered with sample items, next to the
 * design editor. Nothing here uses AI.
 */
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToday } from '../../hooks/useProfile';
import { SPACE_COLORS, SPACE_EMOJIS, type ItemValues, type SpaceDesign, type SpaceItem } from '../../lib/spaces';
import { cn } from '../../lib/utils';
import { DesignEditor } from './DesignEditor';
import { SpaceIcon } from './fields';
import { SummaryCards } from './SummaryCards';
import { SpaceView } from './views';

export interface DraftSpace {
  name: string;
  emoji: string;
  color: number;
  description: string;
  design: SpaceDesign;
  samples: ItemValues[];
}

export function PreviewEditor({ draft, onChange, children, customise = false }: { draft: DraftSpace; onChange: (d: DraftSpace) => void; children?: React.ReactNode; customise?: boolean }) {
  // First run shows the result, not a schema editor: fields, views and cards open on request.
  const [editing, setEditing] = useState(customise);
  const { today, tz } = useToday();
  const [view, setView] = useState(draft.design.views[0]?.id);
  const activeView = draft.design.views.find((v) => v.id === view) ?? draft.design.views[0];
  const items: SpaceItem[] = useMemo(
    () => draft.samples.map((values, i) => ({ id: `sample-${i}`, space_id: 'preview', values, meta: {}, position: i, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
    [draft.samples],
  );
  const noop = () => {};

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      {/* Preview */}
      <section aria-label="Preview" className="min-w-0 space-y-4">
        <div className="flex items-center gap-3">
          <SpaceIcon emoji={draft.emoji} color={draft.color} size="lg" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">Preview · sample items aren’t saved</p>
            <h2 className="truncate text-xl font-semibold tracking-[-0.01em]">{draft.name || 'Untitled Space'}</h2>
          </div>
        </div>
        <SummaryCards design={draft.design} items={items} today={today} tz={tz} compact />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="View">
          {draft.design.views.map((v) => (
            <button key={v.id} type="button" aria-pressed={activeView?.id === v.id} onClick={() => setView(v.id)} className={activeView?.id === v.id ? 'chip-on' : 'chip-off'}>
              {v.name}
            </button>
          ))}
        </div>
        {activeView && (
          <div className="pointer-events-auto">
            <SpaceView
              design={draft.design}
              view={activeView}
              items={items}
              today={today}
              emoji={draft.emoji}
              color={draft.color}
              selection={new Set()}
              selecting={false}
              readOnly
              handlers={{ onOpen: noop, onActions: noop, onSelect: noop, onDelete: noop, onUpdate: noop }}
              empty={<p className="card px-4 py-8 text-center text-sm text-muted">No sample items. Your Space starts empty — add the first item with the quick-add bar.</p>}
            />
          </div>
        )}
        {children}
      </section>

      {/* Editor */}
      <section aria-label="Design" className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
        <div className="card space-y-4 p-4">
          <div>
            <label htmlFor="space-name" className="label">Name</label>
            <input id="space-name" className="input" value={draft.name} maxLength={60} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <span className="label">Emoji</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Emoji">
              {[...new Set([draft.emoji, ...SPACE_EMOJIS])].slice(0, 16).map((e) => (
                <button key={e} type="button" aria-pressed={draft.emoji === e} onClick={() => onChange({ ...draft, emoji: e })} className={cn('flex h-9 w-9 items-center justify-center rounded-control text-lg transition-colors duration-fast', draft.emoji === e ? 'bg-raised ring-2 ring-ink' : 'border border-line hover:border-line-strong')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Colour</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
              {SPACE_COLORS.map((c, i) => (
                <button key={c.name} type="button" role="radio" aria-checked={draft.color === i} aria-label={c.name} title={c.name} onClick={() => onChange({ ...draft, color: i })} className={cn('hit h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition-shadow duration-fast', draft.color === i && 'ring-2 ring-ink')} style={{ background: c.hex }} />
              ))}
            </div>
          </div>
        </div>
        <div className="card p-4">
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
            <span>
              <span className="block text-sm font-semibold">Customise fields, views and cards</span>
              <span className="block text-xs text-muted">{draft.design.fields.map((f) => f.name).join(' · ')}</span>
            </span>
            <ChevronDown size={16} className={cn('shrink-0 text-muted transition-transform duration-fast', editing && 'rotate-180')} aria-hidden />
          </button>
          {editing && (
            <div className="mt-4 border-t border-line pt-4">
              <DesignEditor design={draft.design} onChange={(design) => onChange({ ...draft, design })} activeView={activeView?.id} onActiveView={setView} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
