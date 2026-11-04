/**
 * Loading Spaces for the AI features and Atlas, always through the user's
 * RLS-scoped client, plus compact text versions of a Space for prompts.
 */
import {
  computeSummary,
  fieldByKey,
  formatValue,
  itemTitle,
  normalizeDesign,
  normalizeValues,
  parseQuickAdd,
  valueOf,
  type ItemValues,
  type SpaceDesign,
} from '../../shared/spaces/index.js';
import type { Ctx } from '../data/context.js';
import { HttpError } from '../http.js';

export interface SpaceRow {
  id: string;
  name: string;
  emoji: string;
  color: number;
  description: string;
  design: SpaceDesign;
  settings: Record<string, unknown>;
  status: 'draft' | 'active' | 'archived';
  request: string;
  habit_id: string | null;
  goal_id: string | null;
  goal_field: string | null;
  updated_at: string;
}

export interface ItemRow {
  id: string;
  space_id: string;
  values: ItemValues;
  meta: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export const SPACE_COLUMNS = 'id, name, emoji, color, description, design, settings, status, request, habit_id, goal_id, goal_field, updated_at';
export const ITEM_COLUMNS = 'id, space_id, values:data, meta, position, created_at, updated_at';

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** A stored design, repaired if an old or hand-edited row is off-spec. */
export function rowDesign(row: { design: unknown }): SpaceDesign {
  return normalizeDesign(row.design).design;
}

export async function spaceById(ctx: Ctx, id: unknown): Promise<SpaceRow> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Missing Space.');
  const { data } = await ctx.db.from('spaces').select(SPACE_COLUMNS).eq('id', id).maybeSingle();
  if (!data) throw new HttpError(404, 'That Space no longer exists.');
  return { ...(data as SpaceRow), design: rowDesign(data) };
}

export async function spaceItems(ctx: Ctx, spaceId: string, limit = 2000): Promise<ItemRow[]> {
  const { data } = await ctx.db.from('space_items').select(ITEM_COLUMNS).eq('space_id', spaceId).order('position').limit(limit);
  return (data ?? []) as unknown as ItemRow[];
}

/** "Gift (text), For (person), Price (money USD, private)…" */
export function fieldsText(design: SpaceDesign): string {
  return design.fields
    .map((f) => {
      const bits: string[] = [f.type];
      if (f.type === 'money') bits[0] = `money ${f.currency}`;
      if (f.unit) bits.push(f.unit);
      if (f.options?.length) bits.push(`options: ${f.options.map((o) => o.label).join('/')}`);
      if (f.compute) bits.push(`${f.compute.kind} of ${f.compute.fields.join(', ')}`);
      if (f.private) bits.push('private');
      return `${f.key} "${f.name}" (${bits.join(', ')})`;
    })
    .join('; ');
}

/** One item as a prompt line: I3: Gift=AirPods; For=Mom; Price=$130 */
export function itemLine(ctx: Ctx | null, design: SpaceDesign, item: { id: string; values: ItemValues }, today: string): string {
  const parts = design.fields
    .map((f) => {
      const v = valueOf(design, f, item, today);
      const text = formatValue(design, f, v);
      return text ? `${f.name}=${clip(text.replace(/\s+/g, ' '), f.type === 'long_text' ? 160 : 80)}` : '';
    })
    .filter(Boolean);
  const ref = ctx ? `${ctx.refs.ref('I', item.id)}: ` : '';
  return `${ref}${parts.join('; ') || '(empty)'}`;
}

export function summariesText(design: SpaceDesign, items: { id: string; values: ItemValues; created_at?: string }[], today: string, tz: string): string {
  if (!design.summaries.length) return `${items.length} items`;
  return design.summaries
    .map((s) => {
      const r = computeSummary(design, s, items, today, tz);
      const groups = r.groups?.length ? ` [${r.groups.map((g) => `${g.label}: ${g.amount}${g.target ? ` of ${g.target}${g.over ? ' OVER' : ''}` : ''}`).join(', ')}]` : '';
      return `${s.label}: ${r.display}${r.sub ? ` (${r.sub})` : ''}${groups}`;
    })
    .join('; ');
}

/** People/groups already used, so quick add recognises "Sam lego". */
export function knownPeople(design: SpaceDesign, items: { values: ItemValues }[]): string[] {
  const f = design.fields.find((x) => x.type === 'person');
  if (!f) return [];
  return [...new Set(items.map((i) => i.values[f.key]).filter((v): v is string => typeof v === 'string'))].slice(0, 100);
}

/**
 * Item values from Atlas (or any loose source): free text is read by the same
 * local quick-add parser the app uses, then explicit values (keyed by field key
 * or field name) override it. Everything is validated against the design.
 */
export function valuesFrom(design: SpaceDesign, input: { text?: string; values?: Record<string, unknown> }, today: string, people: string[]): ItemValues {
  const parsed = input.text ? parseQuickAdd(input.text, design, { today, people }).values : {};
  const explicit: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input.values ?? {})) {
    const f = fieldByKey(design, k) ?? design.fields.find((x) => x.name.toLowerCase() === k.toLowerCase());
    if (f) explicit[f.key] = v;
  }
  const merged = normalizeValues(design, { ...defaults(design, today), ...parsed, ...explicit });
  return merged;
}

function defaults(design: SpaceDesign, today: string): ItemValues {
  const out: ItemValues = {};
  for (const f of design.fields) if (f.type === 'date' && f.default_today) out[f.key] = today;
  return out;
}

/** Re-keys values when an item moves to a Space with a different design (matched by key, then name). */
export function remapValues(from: SpaceDesign, to: SpaceDesign, values: ItemValues): ItemValues {
  const out: Record<string, unknown> = {};
  for (const f of from.fields) {
    const v = values[f.key];
    if (v === undefined) continue;
    const target = to.fields.find((t) => t.key === f.key && t.type === f.type) ?? to.fields.find((t) => t.name.toLowerCase() === f.name.toLowerCase());
    if (target) out[target.key] = target.type === f.type ? v : formatValue(from, f, v);
    else if (f.key === from.primary) out[to.primary] = v;
  }
  return normalizeValues(to, out);
}

export { itemTitle };
