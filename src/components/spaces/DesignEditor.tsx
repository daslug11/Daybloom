/**
 * Edits a Space's design without AI: rename, reorder, add or remove fields;
 * switch, add or remove views; add or remove summary cards. Every change goes
 * through the same validator as AI designs, so the result is always valid.
 */
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import {
  COMPUTE_KINDS,
  COMPUTE_LABELS,
  CURRENCIES,
  FIELD_LABELS,
  FIELD_TYPES,
  GROUPABLE_TYPES,
  LIMITS,
  normalizeDesign,
  NUMERIC_TYPES,
  slugKey,
  STATUS_CLASSES,
  STATUS_COLORS,
  SUMMARY_KINDS,
  SUMMARY_LABELS,
  VIEW_LABELS,
  VIEW_TYPES,
  type ComputeKind,
  type Field,
  type FieldType,
  type SpaceDesign,
  type Summary,
  type SummaryKind,
  type View,
  type ViewType,
} from '../../lib/spaces';
import { cn } from '../../lib/utils';
import { Menu, MenuItem } from '../ui/Menu';

interface Props {
  design: SpaceDesign;
  onChange: (d: SpaceDesign) => void;
  /** Which view is shown in the preview. */
  activeView?: string;
  onActiveView?: (id: string) => void;
}

const uniq = (base: string, taken: string[]) => {
  let k = base;
  for (let i = 2; taken.includes(k); i++) k = `${base.slice(0, 21)}_${i}`;
  return k;
};

export function DesignEditor({ design, onChange, activeView, onActiveView }: Props) {
  const apply = (next: SpaceDesign) => onChange(normalizeDesign(next, design).design);
  const setField = (key: string, patch: Partial<Field>) => apply({ ...design, fields: design.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) });
  const move = (i: number, d: number) => {
    const fields = [...design.fields];
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    apply({ ...design, fields });
  };
  const removeField = (key: string) => {
    if (key === design.primary) return;
    apply({ ...design, fields: design.fields.filter((f) => f.key !== key) });
  };
  const addField = (type: FieldType, compute?: ComputeKind) => {
    const name = compute ? COMPUTE_LABELS[compute].split(' (')[0] : FIELD_LABELS[type].split(' (')[0].replace(' / group', '');
    const key = uniq(slugKey(name), design.fields.map((f) => f.key));
    const f: Field = { key, name, type };
    if (type === 'status') f.options = [{ id: 'todo', label: 'To do', color: 'gray' }, { id: 'doing', label: 'Doing', color: 'yellow' }, { id: 'done', label: 'Done', color: 'green' }];
    if (type === 'money') f.currency = design.fields.find((x) => x.type === 'money')?.currency ?? 'USD';
    if (compute) {
      const num = design.fields.filter((x) => ['number', 'money', 'duration'].includes(x.type)).map((x) => x.key);
      const fields = compute === 'days_until' ? design.fields.filter((x) => x.type === 'date').map((x) => x.key).slice(0, 1) : compute === 'pace' ? [design.fields.find((x) => x.type === 'duration')?.key, design.fields.find((x) => x.type === 'number')?.key].filter((x): x is string => !!x) : num.slice(0, 2);
      f.compute = { kind: compute, fields, target: compute === 'percent_of_target' ? 100 : undefined };
    }
    apply({ ...design, fields: [...design.fields, f] });
  };

  const canCompute = (k: ComputeKind) => {
    const t = (x: FieldType) => design.fields.filter((f) => f.type === x).length;
    if (k === 'days_until') return t('date') > 0;
    if (k === 'pace') return t('duration') > 0 && t('number') > 0;
    if (k === 'percent_of_target') return t('number') + t('money') + t('duration') > 0;
    return t('number') + t('money') + t('duration') >= 2;
  };

  return (
    <div className="space-y-6">
      {/* Fields */}
      <section aria-labelledby="de-fields">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="de-fields" className="text-sm font-semibold">Fields <span className="font-normal text-muted">· {design.fields.length}/{LIMITS.fields}</span></h3>
          <Menu label="Add a field" width={240} triggerClassName="btn-ghost !min-h-8 !px-2.5 !py-1 text-xs" trigger={<><Plus size={14} aria-hidden /> Add field</>}>
            {(close) => (
              <div className="max-h-80 overflow-y-auto">
                {FIELD_TYPES.filter((t) => t !== 'computed').map((t) => (
                  <MenuItem key={t} disabled={design.fields.length >= LIMITS.fields} onClick={() => (close(), addField(t))}>{FIELD_LABELS[t]}</MenuItem>
                ))}
                <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-faint">Worked out for you</p>
                {COMPUTE_KINDS.map((k) => (
                  <MenuItem key={k} disabled={design.fields.length >= LIMITS.fields || !canCompute(k)} onClick={() => (close(), addField('computed', k))}>{COMPUTE_LABELS[k]}</MenuItem>
                ))}
              </div>
            )}
          </Menu>
        </div>
        <ol className="-mx-1 divide-y divide-line border-y border-line">
          {design.fields.map((f, i) => (
            <FieldRow key={f.key} field={f} design={design} index={i} onPatch={(p) => setField(f.key, p)} onMove={(d) => move(i, d)} onRemove={() => removeField(f.key)} />
          ))}
        </ol>
      </section>

      {/* Views */}
      <section aria-labelledby="de-views">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="de-views" className="text-sm font-semibold">Views <span className="font-normal text-muted">· {design.views.length}/{LIMITS.views}</span></h3>
          <Menu label="Add a view" width={220} triggerClassName="btn-ghost !min-h-8 !px-2.5 !py-1 text-xs" trigger={<><Plus size={14} aria-hidden /> Add view</>}>
            {(close) => (
              <>
                {VIEW_TYPES.map((t) => (
                  <MenuItem key={t} disabled={design.views.length >= LIMITS.views} onClick={() => {
                    close();
                    const id = uniq(t, design.views.map((v) => v.id));
                    const next = normalizeDesign({ ...design, views: [...design.views, { id, type: t, name: VIEW_LABELS[t] }] }, design);
                    if (!next.design.views.some((v) => v.id === id)) return;
                    onChange(next.design);
                    onActiveView?.(id);
                  }}>
                    {VIEW_LABELS[t]}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        </div>
        <ul className="space-y-2">
          {design.views.map((v) => (
            <ViewRow key={v.id} view={v} design={design} active={activeView === v.id} onActive={() => onActiveView?.(v.id)} onPatch={(p) => apply({ ...design, views: design.views.map((x) => (x.id === v.id ? { ...x, ...p } : x)) })} onRemove={design.views.length > 1 ? () => apply({ ...design, views: design.views.filter((x) => x.id !== v.id) }) : undefined} />
          ))}
        </ul>
      </section>

      {/* Summary cards */}
      <section aria-labelledby="de-cards">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="de-cards" className="text-sm font-semibold">Summary cards <span className="font-normal text-muted">· {design.summaries.length}/{LIMITS.summaries}</span></h3>
          <Menu label="Add a summary card" width={220} triggerClassName="btn-ghost !min-h-8 !px-2.5 !py-1 text-xs" trigger={<><Plus size={14} aria-hidden /> Add card</>}>
            {(close) => (
              <>
                {SUMMARY_KINDS.map((k) => (
                  <MenuItem key={k} disabled={design.summaries.length >= LIMITS.summaries} onClick={() => {
                    close();
                    apply({ ...design, summaries: [...design.summaries, { id: uniq(k, design.summaries.map((s) => s.id)), kind: k, label: SUMMARY_LABELS[k].replace(' vs spent', '') }] });
                  }}>
                    {SUMMARY_LABELS[k]}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        </div>
        {design.summaries.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong px-4 py-3 text-sm text-muted">No cards. Add a total, a budget, a count or a personal best to see it above your items.</p>
        ) : (
          <ul className="space-y-2">
            {design.summaries.map((s) => (
              <SummaryRow key={s.id} summary={s} design={design} onPatch={(p) => apply({ ...design, summaries: design.summaries.map((x) => (x.id === s.id ? { ...x, ...p } : x)) })} onRemove={() => apply({ ...design, summaries: design.summaries.filter((x) => x.id !== s.id) })} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FieldRow({ field: f, design, index, onPatch, onMove, onRemove }: { field: Field; design: SpaceDesign; index: number; onPatch: (p: Partial<Field>) => void; onMove: (d: number) => void; onRemove: () => void }) {
  const id = useId();
  const primary = f.key === design.primary;
  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button type="button" className="hit flex h-6 w-6 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${f.name} up`}><ArrowUp size={13} aria-hidden /></button>
          <button type="button" className="hit flex h-6 w-6 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30" onClick={() => onMove(1)} disabled={index === design.fields.length - 1} aria-label={`Move ${f.name} down`}><ArrowDown size={13} aria-hidden /></button>
        </div>
        <label htmlFor={`${id}-n`} className="sr-only">Field name</label>
        <input id={`${id}-n`} className="input !py-1.5 min-w-0 flex-1" defaultValue={f.name} maxLength={LIMITS.fieldName} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== f.name && onPatch({ name: e.target.value.trim() })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        <label htmlFor={`${id}-t`} className="sr-only">Type of {f.name}</label>
        <select
          id={`${id}-t`}
          className="input !w-auto !py-1.5 !pr-8"
          value={f.type}
          disabled={f.type === 'computed'}
          onChange={(e) => {
            const type = e.target.value as FieldType;
            onPatch({ type, options: type === 'status' ? f.options ?? [{ id: 'todo', label: 'To do', color: 'gray' }, { id: 'done', label: 'Done', color: 'green' }] : undefined, currency: type === 'money' ? f.currency ?? 'USD' : undefined, unit: type === 'number' ? f.unit : undefined });
          }}
        >
          {FIELD_TYPES.filter((t) => t !== 'computed' || f.type === 'computed').map((t) => (
            <option key={t} value={t} disabled={primary && !['text', 'long_text'].includes(t)}>{FIELD_LABELS[t]}</option>
          ))}
        </select>
        <button type="button" className="icon-btn h-8 w-8" onClick={() => onPatch({ private: !f.private })} aria-pressed={!!f.private} aria-label={f.private ? `${f.name} is hidden on shared links` : `${f.name} is shown on shared links`} title={f.private ? 'Hidden on shared links' : 'Shown on shared links'}>
          {f.private ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        </button>
        <button type="button" className="icon-btn h-8 w-8 hover:text-danger" onClick={onRemove} disabled={primary} aria-label={primary ? `${f.name} is the main field and can’t be removed` : `Remove ${f.name}`} title={primary ? 'The main field can’t be removed' : 'Remove field'}>
          <Trash2 size={15} aria-hidden />
        </button>
      </div>
      {/* Type-specific settings */}
      {(f.type === 'status' || f.type === 'money' || f.type === 'number' || f.type === 'date' || f.type === 'computed' || primary) && (
        <div className="ml-8 mt-2 flex flex-wrap items-center gap-2 text-xs">
          {primary && <span className="rounded-full bg-ink/[0.07] px-2 py-0.5 text-muted">Main field: quick-add text goes here</span>}
          {f.type === 'status' && <OptionsEditor field={f} onPatch={onPatch} />}
          {f.type === 'money' && (
            <label className="flex items-center gap-1.5 text-muted">
              Currency
              <select className="input !w-auto !py-1 !text-xs" value={f.currency ?? 'USD'} onChange={(e) => onPatch({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          )}
          {f.type === 'number' && (
            <label className="flex items-center gap-1.5 text-muted">
              Unit
              <input className="input !w-24 !py-1 !text-xs" defaultValue={f.unit ?? ''} placeholder="km, pages…" maxLength={12} onBlur={(e) => onPatch({ unit: e.target.value.trim().toLowerCase() || undefined })} />
            </label>
          )}
          {f.type === 'date' && (
            <label className="flex items-center gap-1.5 text-muted">
              <input type="checkbox" className="accent-[rgb(var(--ink))]" checked={!!f.default_today} onChange={(e) => onPatch({ default_today: e.target.checked || undefined })} />
              New items get today’s date
            </label>
          )}
          {f.type === 'computed' && f.compute && <ComputeEditor field={f} design={design} onPatch={onPatch} />}
        </div>
      )}
    </li>
  );
}

function OptionsEditor({ field, onPatch }: { field: Field; onPatch: (p: Partial<Field>) => void }) {
  const opts = field.options ?? [];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opts.map((o) => (
        <span key={o.id} className={cn('inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-1 ring-1 ring-inset', STATUS_CLASSES[o.color])}>
          <Menu label={`Colour of ${o.label}`} width={168} align="left" triggerClassName="hit flex h-6 w-6 items-center justify-center rounded-full before:block before:h-3.5 before:w-3.5 before:rounded-full before:bg-current before:opacity-80 before:content-['']" trigger={<span className="sr-only">Colour</span>}>
            {(close) => (
              <div className="grid grid-cols-4 gap-1 p-1">
                {STATUS_COLORS.map((c) => (
                  <button key={c} type="button" role="menuitem" aria-label={c} onClick={() => (close(), onPatch({ options: opts.map((x) => (x.id === o.id ? { ...x, color: c } : x)) }))} className={cn('h-7 rounded-md ring-1 ring-inset', STATUS_CLASSES[c], o.color === c && 'ring-2')} />
                ))}
              </div>
            )}
          </Menu>
          <input
            aria-label={`Rename option ${o.label}`}
            className="w-[9ch] min-w-0 bg-transparent text-xs font-medium outline-none"
            defaultValue={o.label}
            maxLength={LIMITS.optionLabel}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== o.label && onPatch({ options: opts.map((x) => (x.id === o.id ? { ...x, label: e.target.value.trim() } : x)) })}
          />
          <button type="button" className="hit flex h-6 w-6 items-center justify-center rounded-full opacity-70 hover:opacity-100" onClick={() => opts.length > 1 && onPatch({ options: opts.filter((x) => x.id !== o.id) })} disabled={opts.length <= 1} aria-label={`Remove option ${o.label}`}>
            <X size={11} aria-hidden />
          </button>
        </span>
      ))}
      {opts.length < LIMITS.statusOptions && (
        <button type="button" className="chip-off !min-h-6 !px-2 !py-0" onClick={() => onPatch({ options: [...opts, { id: uniq('option', opts.map((o) => o.id)), label: `Option ${opts.length + 1}`, color: STATUS_COLORS[(opts.length + 1) % STATUS_COLORS.length] }] })}>
          <Plus size={11} aria-hidden /> Option
        </button>
      )}
    </div>
  );
}

function ComputeEditor({ field, design, onPatch }: { field: Field; design: SpaceDesign; onPatch: (p: Partial<Field>) => void }) {
  const c = field.compute!;
  const allowed: Record<ComputeKind, FieldType[][]> = {
    sum: [['number', 'money', 'duration'], ['number', 'money', 'duration']],
    difference: [['number', 'money', 'duration'], ['number', 'money', 'duration']],
    pace: [['duration'], ['number']],
    days_until: [['date']],
    percent_of_target: [['number', 'money', 'duration']],
  };
  const slots = allowed[c.kind];
  const labels: Record<ComputeKind, string[]> = { sum: ['', '+'], difference: ['', '−'], pace: ['', '÷'], days_until: ['until'], percent_of_target: ['of'] };
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-muted">
      {COMPUTE_LABELS[c.kind]}:
      {slots.map((types, i) => (
        <span key={i} className="flex items-center gap-1">
          {labels[c.kind][i] && <span>{labels[c.kind][i]}</span>}
          <select className="input !w-auto !py-1 !text-xs" value={c.fields[i] ?? ''} aria-label={`Source ${i + 1} for ${field.name}`} onChange={(e) => {
            const fields = [...c.fields];
            fields[i] = e.target.value;
            onPatch({ compute: { ...c, fields } });
          }}>
            {design.fields.filter((x) => types.includes(x.type)).map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
        </span>
      ))}
      {c.kind === 'percent_of_target' && (
        <input className="input !w-24 !py-1 !text-xs" type="number" min={1} aria-label="Target" defaultValue={c.target ?? 100} onBlur={(e) => onPatch({ compute: { ...c, target: Number(e.target.value) || 100 } })} />
      )}
    </span>
  );
}

function fieldOptions(design: SpaceDesign, filter: (f: Field) => boolean): ReactNode {
  return design.fields.filter(filter).map((f) => <option key={f.key} value={f.key}>{f.name}</option>);
}

function ViewRow({ view: v, design, active, onActive, onPatch, onRemove }: { view: View; design: SpaceDesign; active: boolean; onActive: () => void; onPatch: (p: Partial<View>) => void; onRemove?: () => void }) {
  const needs: Partial<Record<ViewType, { label: string; filter: (f: Field) => boolean }>> = {
    board: { label: 'Columns from', filter: (f) => f.type === 'status' },
    grouped: { label: 'Group by', filter: (f) => GROUPABLE_TYPES.includes(f.type) },
    calendar: { label: 'Date', filter: (f) => f.type === 'date' },
    chart: { label: 'Over', filter: (f) => f.type === 'date' },
    gallery: { label: 'Picture from', filter: (f) => f.type === 'image' || f.type === 'link' },
  };
  const need = needs[v.type];
  return (
    <li className={cn('rounded-card border px-3 py-2.5 transition-colors duration-fast', active ? 'border-ink/50 bg-ink/[0.03]' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onActive} aria-pressed={active} className={active ? 'chip-on' : 'chip-off'}>{VIEW_LABELS[v.type]}</button>
        <input aria-label="View name" className="input !w-36 !py-1 !text-xs" defaultValue={v.name} maxLength={30} onBlur={(e) => e.target.value.trim() && onPatch({ name: e.target.value.trim() })} />
        {need && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            {need.label}
            <select className="input !w-auto !py-1 !text-xs" value={v.field ?? ''} onChange={(e) => onPatch({ field: e.target.value })}>
              {fieldOptions(design, need.filter)}
            </select>
          </label>
        )}
        {v.type === 'chart' && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Plot
              <select className="input !w-auto !py-1 !text-xs" value={v.y ?? ''} onChange={(e) => onPatch({ y: e.target.value || undefined, agg: e.target.value ? (v.agg === 'count' ? 'sum' : v.agg) : 'count' })}>
                <option value="">Number of items</option>
                {fieldOptions(design, (f) => NUMERIC_TYPES.includes(f.type) && f.compute?.kind !== 'days_until')}
              </select>
            </label>
            <select aria-label="Chart type" className="input !w-auto !py-1 !text-xs" value={v.chart ?? 'line'} onChange={(e) => onPatch({ chart: e.target.value as 'line' | 'bar' })}>
              <option value="line">Line</option>
              <option value="bar">Bars</option>
            </select>
          </>
        )}
        {onRemove && (
          <button type="button" className="icon-btn ml-auto h-8 w-8 hover:text-danger" onClick={onRemove} aria-label={`Remove ${v.name} view`}>
            <Trash2 size={15} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

function SummaryRow({ summary: s, design, onPatch, onRemove }: { summary: Summary; design: SpaceDesign; onPatch: (p: Partial<Summary>) => void; onRemove: () => void }) {
  const numeric = (f: Field) => NUMERIC_TYPES.includes(f.type) && f.compute?.kind !== 'days_until';
  const needsField: Partial<Record<SummaryKind, (f: Field) => boolean>> = {
    total: numeric,
    average: numeric,
    best: numeric,
    budget: (f) => f.type === 'money' || f.type === 'number',
    progress: numeric,
    streak: (f) => f.type === 'date',
  };
  const filterable = design.fields.filter((f) => f.type === 'checkbox' || f.type === 'status');
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2.5 text-xs">
      <span className="chip-off pointer-events-none">{SUMMARY_LABELS[s.kind]}</span>
      <input aria-label="Card label" className="input !w-32 !py-1 !text-xs" defaultValue={s.label} maxLength={40} onBlur={(e) => e.target.value.trim() && onPatch({ label: e.target.value.trim() })} />
      {needsField[s.kind] && (
        <select aria-label="Measures" className="input !w-auto !py-1 !text-xs" value={s.field ?? ''} onChange={(e) => onPatch({ field: e.target.value || undefined })}>
          {s.kind === 'progress' && <option value="">Number of items</option>}
          {s.kind === 'streak' && <option value="">Date added</option>}
          {fieldOptions(design, needsField[s.kind]!)}
        </select>
      )}
      {(s.kind === 'budget' || s.kind === 'progress') && (
        <label className="flex items-center gap-1 text-muted">
          {s.kind === 'budget' ? 'Budget' : 'Target'}
          <input className="input !w-24 !py-1 !text-xs tabular-nums" type="number" min={0} defaultValue={s.target ?? ''} onBlur={(e) => onPatch({ target: Number(e.target.value) || undefined })} />
        </label>
      )}
      {s.kind === 'best' && (
        <select aria-label="Best is" className="input !w-auto !py-1 !text-xs" value={s.best ?? 'max'} onChange={(e) => onPatch({ best: e.target.value as 'max' | 'min' })}>
          <option value="max">Highest</option>
          <option value="min">Lowest</option>
        </select>
      )}
      {(s.kind === 'count' || s.kind === 'progress' || s.kind === 'budget' || s.kind === 'total') && filterable.length > 0 && (
        <select
          aria-label="Only items"
          className="input !w-auto !py-1 !text-xs"
          value={s.filter ? `${s.filter.field}:${String(s.filter.value)}` : ''}
          onChange={(e) => {
            if (!e.target.value) return onPatch({ filter: undefined });
            const [field, value] = e.target.value.split(':');
            onPatch({ filter: { field, value: value === 'true' ? true : value } });
          }}
        >
          <option value="">All items</option>
          {filterable.map((f) =>
            f.type === 'checkbox' ? (
              <option key={f.key} value={`${f.key}:true`}>Only {f.name.toLowerCase()}</option>
            ) : (
              f.options?.map((o) => <option key={`${f.key}-${o.id}`} value={`${f.key}:${o.id}`}>Only {o.label.toLowerCase()}</option>)
            ),
          )}
        </select>
      )}
      <button type="button" className="icon-btn ml-auto h-8 w-8 hover:text-danger" onClick={onRemove} aria-label={`Remove ${s.label} card`}>
        <Trash2 size={15} aria-hidden />
      </button>
    </li>
  );
}
