/**
 * Validates and repairs a Space design, whoever made it (AI, template, the user,
 * an old saved row). Unknown types are dropped, everything is capped at LIMITS,
 * keys are made unique, and views/summaries that point at missing or unsuitable
 * fields are dropped or repaired. The result is always renderable.
 */
import {
  COMPUTE_KINDS,
  CURRENCIES,
  FIELD_TYPES,
  GROUPABLE_TYPES,
  LIMITS,
  NUMERIC_TYPES,
  STATUS_COLORS,
  SUMMARY_KINDS,
  VIEW_TYPES,
  type ComputeKind,
  type Field,
  type FieldType,
  type ItemValues,
  type SpaceDesign,
  type StatusColor,
  type StatusOption,
  type Summary,
  type SummaryKind,
  type View,
  type ViewType,
} from './blocks.js';

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(/[^0-9.-]/g, '')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const lower = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/[\s-]+/g, '_') : '');
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => {
  const s = lower(v) as T;
  return allowed.includes(s) ? s : null;
};

/** Field type aliases a model (or person) might use. */
const TYPE_ALIASES: Record<string, FieldType> = {
  string: 'text',
  title: 'text',
  name: 'text',
  short_text: 'text',
  textarea: 'long_text',
  notes: 'long_text',
  note: 'long_text',
  longtext: 'long_text',
  integer: 'number',
  float: 'number',
  decimal: 'number',
  distance: 'number',
  price: 'money',
  currency: 'money',
  cost: 'money',
  amount: 'money',
  datetime: 'date',
  day: 'date',
  boolean: 'checkbox',
  bool: 'checkbox',
  done: 'checkbox',
  select: 'status',
  single_select: 'status',
  stage: 'status',
  stars: 'rating',
  url: 'link',
  website: 'link',
  people: 'person',
  group: 'person',
  contact: 'person',
  multi_select: 'tags',
  tag: 'tags',
  labels: 'tags',
  time: 'duration',
  photo: 'image',
  picture: 'image',
  formula: 'computed',
};

export function slugKey(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return s && /^[a-z]/.test(s) ? s : `f_${s || 'field'}`.slice(0, 24);
}

function uniqueKey(base: string, taken: Set<string>) {
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base.slice(0, 21)}_${i}`;
  taken.add(key);
  return key;
}

function normalizeOptions(raw: unknown): StatusOption[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: StatusOption[] = [];
  const ids = new Set<string>();
  for (const [i, o] of list.entries()) {
    if (out.length >= LIMITS.statusOptions) break;
    const label = str(isObj(o) ? (o.label ?? o.name) : o, LIMITS.optionLabel);
    if (!label || out.some((x) => x.label.toLowerCase() === label.toLowerCase())) continue;
    const id = uniqueKey(str(isObj(o) ? o.id : '', 24) || slugKey(label), ids);
    const color = (isObj(o) && pick(o.color, STATUS_COLORS)) || (STATUS_COLORS[(i + 1) % STATUS_COLORS.length] as StatusColor);
    out.push({ id, label, color });
  }
  return out;
}

const COMPUTE_SOURCES: Record<ComputeKind, { count: [number, number]; types: readonly FieldType[] }> = {
  sum: { count: [2, 6], types: ['number', 'money', 'duration'] },
  difference: { count: [2, 2], types: ['number', 'money', 'duration'] },
  pace: { count: [2, 2], types: ['duration', 'number'] },
  days_until: { count: [1, 1], types: ['date'] },
  percent_of_target: { count: [1, 1], types: ['number', 'money', 'duration'] },
};

export interface NormalizeResult {
  design: SpaceDesign;
  /** Human-readable notes on what was dropped or repaired. */
  dropped: string[];
}

/**
 * @param previous  the design being edited (redesign keeps its keys, so item data stays attached).
 */
export function normalizeDesign(raw: unknown, previous?: SpaceDesign | null): NormalizeResult {
  const dropped: string[] = [];
  const src = isObj(raw) ? raw : {};
  const taken = new Set<string>();
  const fields: Field[] = [];
  const rawFields = Array.isArray(src.fields) ? src.fields : [];
  const keyMap = new Map<string, string>(); // raw key or name (lowercased) → final key

  for (const rf of rawFields) {
    if (!isObj(rf)) continue;
    const name = str(rf.name ?? rf.label ?? rf.key, LIMITS.fieldName);
    const rawType = lower(rf.type);
    const type = (FIELD_TYPES as readonly string[]).includes(rawType) ? (rawType as FieldType) : TYPE_ALIASES[rawType];
    if (!name) continue;
    if (!type) {
      dropped.push(`field “${name}” (unknown type ${String(rf.type)})`);
      continue;
    }
    if (fields.length >= LIMITS.fields) {
      dropped.push(`field “${name}” (max ${LIMITS.fields} fields)`);
      continue;
    }
    // Keep a previous key when the field still exists (by key, else by name), so item values stay attached.
    const prevByKey = previous?.fields.find((f) => f.key === rf.key);
    const prevByName = previous?.fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
    const prev = prevByKey ?? prevByName;
    const wanted = prev && !taken.has(prev.key) ? prev.key : slugKey(str(rf.key, 24) || name);
    const key = uniqueKey(wanted, taken);
    for (const alias of [rf.key, rf.name, rf.label]) if (typeof alias === 'string') keyMap.set(alias.toLowerCase(), key);
    keyMap.set(key, key);

    const f: Field = { key, name, type };
    if (type === 'status') {
      f.options = normalizeOptions(rf.options ?? rf.choices);
      if (!f.options.length) f.options = normalizeOptions(['To do', 'Doing', 'Done']);
    }
    if (type === 'money') {
      const cur = String(rf.currency ?? '').trim().toUpperCase();
      f.currency = (CURRENCIES as readonly string[]).includes(cur) ? cur : 'USD';
    }
    if (type === 'number') {
      const unit = str(rf.unit, 12).toLowerCase();
      if (unit) f.unit = unit;
    }
    if (type === 'date' && rf.default_today === true) f.default_today = true;
    if (rf.private === true || rf.hidden === true) f.private = true;
    if (type === 'computed') {
      const c = isObj(rf.compute) ? rf.compute : rf;
      const kind = pick(c.kind ?? c.formula, COMPUTE_KINDS);
      if (!kind) {
        dropped.push(`field “${name}” (unknown computation)`);
        taken.delete(key);
        continue;
      }
      f.compute = { kind, fields: (Array.isArray(c.fields) ? c.fields : []).map((x) => String(x)) };
      const target = num(c.target);
      if (kind === 'percent_of_target') f.compute.target = target && target > 0 ? target : 100;
    }
    fields.push(f);
  }

  const resolve = (ref: unknown): string | undefined => {
    if (typeof ref !== 'string' || !ref) return undefined;
    return keyMap.get(ref.toLowerCase()) ?? keyMap.get(slugKey(ref));
  };
  const byKey = (k: string | undefined) => fields.find((f) => f.key === k);

  // Computed fields: sources must exist, have the right types, and not be computed themselves.
  for (let i = fields.length - 1; i >= 0; i--) {
    const f = fields[i];
    if (f.type !== 'computed' || !f.compute) continue;
    const rule = COMPUTE_SOURCES[f.compute.kind];
    let sources = f.compute.fields.map(resolve).filter((k): k is string => !!k && byKey(k)?.type !== 'computed');
    if (f.compute.kind === 'pace') {
      const dur = sources.find((k) => byKey(k)?.type === 'duration') ?? fields.find((x) => x.type === 'duration')?.key;
      const dist = sources.find((k) => byKey(k)?.type === 'number') ?? fields.find((x) => x.type === 'number')?.key;
      sources = dur && dist ? [dur, dist] : [];
    }
    sources = sources.filter((k) => rule.types.includes(byKey(k)!.type)).slice(0, rule.count[1]);
    if (sources.length < rule.count[0]) {
      dropped.push(`field “${f.name}” (its source fields are missing)`);
      fields.splice(i, 1);
      continue;
    }
    f.compute.fields = sources;
  }

  // The primary text field: leftover quick-add words go here.
  let primary = resolve(src.primary);
  if (!primary || !['text', 'long_text'].includes(byKey(primary)!.type)) primary = fields.find((f) => f.type === 'text')?.key ?? fields.find((f) => f.type === 'long_text')?.key;
  if (!primary) {
    if (fields.length >= LIMITS.fields) {
      const cut = fields.pop()!;
      dropped.push(`field “${cut.name}” (room for a name field)`);
    }
    primary = uniqueKey('name', taken);
    fields.unshift({ key: primary, name: 'Name', type: 'text' });
  }

  // The check-off field.
  let check: string | null = resolve(src.check) ?? null;
  if (check && byKey(check)?.type !== 'checkbox') check = null;
  check ??= fields.find((f) => f.type === 'checkbox')?.key ?? null;

  // Views.
  const views: View[] = [];
  const viewIds = new Set<string>();
  const groupable = (k?: string) => !!k && GROUPABLE_TYPES.includes(byKey(k)?.type as FieldType);
  const numeric = (k?: string) => !!k && NUMERIC_TYPES.includes(byKey(k)?.type as FieldType) && byKey(k)?.compute?.kind !== 'days_until';
  for (const rv of Array.isArray(src.views) ? src.views : []) {
    if (!isObj(rv)) continue;
    const type = pick(rv.type, VIEW_TYPES) as ViewType | null;
    if (!type) {
      dropped.push(`view “${str(rv.name, 30) || String(rv.type)}” (unknown type)`);
      continue;
    }
    if (views.length >= LIMITS.views) {
      dropped.push(`view “${str(rv.name, 30) || type}” (max ${LIMITS.views} views)`);
      continue;
    }
    const v: View = { id: uniqueKey(slugKey(str(rv.id, 24) || type), viewIds), type, name: str(rv.name, 30) || defaultViewName(type) };
    let field = resolve(rv.field ?? rv.group_by ?? rv.date_field ?? rv.x);
    if (type === 'checklist' && !check) {
      if (fields.length < LIMITS.fields) {
        check = uniqueKey('done', taken);
        fields.push({ key: check, name: 'Done', type: 'checkbox' });
      } else {
        dropped.push('checklist view (no room for a Done field)');
        viewIds.delete(v.id);
        continue;
      }
    }
    if (type === 'board') {
      if (byKey(field)?.type !== 'status') field = fields.find((f) => f.type === 'status')?.key;
      if (!field) {
        dropped.push('board view (needs a status field)');
        viewIds.delete(v.id);
        continue;
      }
    }
    if (type === 'grouped') {
      if (!groupable(field)) field = fields.find((f) => f.type === 'person')?.key ?? fields.find((f) => f.type === 'status')?.key ?? fields.find((f) => f.type === 'tags')?.key;
      if (!field) {
        dropped.push('grouped view (nothing to group by)');
        viewIds.delete(v.id);
        continue;
      }
    }
    if (type === 'calendar' || type === 'chart') {
      if (byKey(field)?.type !== 'date') field = fields.find((f) => f.type === 'date')?.key;
      if (!field) {
        dropped.push(`${type} view (needs a date field)`);
        viewIds.delete(v.id);
        continue;
      }
    }
    if (type === 'gallery' && !['image', 'link'].includes(byKey(field)?.type ?? '')) field = fields.find((f) => f.type === 'image')?.key ?? fields.find((f) => f.type === 'link')?.key;
    if (field) v.field = field;
    if (type === 'chart') {
      const y = resolve(rv.y ?? rv.value);
      v.chart = lower(rv.chart ?? rv.kind) === 'bar' ? 'bar' : 'line';
      if (numeric(y)) v.y = y;
      v.agg = pick(rv.agg, ['sum', 'avg', 'max', 'min', 'count'] as const) ?? (v.y ? 'sum' : 'count');
      if (!v.y) v.agg = 'count';
    }
    views.push(v);
  }
  if (!views.length) views.push({ id: 'list', type: check ? 'checklist' : 'table', name: check ? 'Checklist' : 'Table' });

  // Summary cards.
  const summaries: Summary[] = [];
  const sumIds = new Set<string>();
  for (const rs of Array.isArray(src.summaries) ? src.summaries : []) {
    if (!isObj(rs)) continue;
    const kind = pick(rs.kind ?? rs.type, SUMMARY_KINDS) as SummaryKind | null;
    if (!kind) {
      dropped.push(`summary “${str(rs.label, 30) || String(rs.kind)}” (unknown kind)`);
      continue;
    }
    if (summaries.length >= LIMITS.summaries) {
      dropped.push(`summary “${str(rs.label, 30) || kind}” (max ${LIMITS.summaries} cards)`);
      continue;
    }
    const s: Summary = { id: uniqueKey(slugKey(str(rs.id, 24) || kind), sumIds), kind, label: str(rs.label ?? rs.name, 40) || defaultSummaryLabel(kind) };
    let field = resolve(rs.field);
    if (['total', 'average', 'budget'].includes(kind) && !numeric(field)) {
      field = kind === 'budget' ? fields.find((f) => f.type === 'money')?.key : fields.find((f) => NUMERIC_TYPES.includes(f.type) && f.compute?.kind !== 'days_until')?.key;
      if (!field) {
        dropped.push(`summary “${s.label}” (needs a number field)`);
        sumIds.delete(s.id);
        continue;
      }
    }
    if (kind === 'best' && !numeric(field)) {
      field = fields.find((f) => NUMERIC_TYPES.includes(f.type) && f.compute?.kind !== 'days_until')?.key;
      if (!field) {
        dropped.push(`summary “${s.label}” (needs a number field)`);
        sumIds.delete(s.id);
        continue;
      }
    }
    if (kind === 'progress' && field && !numeric(field)) field = undefined;
    if (kind === 'streak' && byKey(field)?.type !== 'date') field = fields.find((f) => f.type === 'date')?.key;
    if (field) s.field = field;
    const target = num(rs.target ?? rs.budget ?? rs.goal);
    if ((kind === 'budget' || kind === 'progress') && target && target > 0) s.target = Math.round(target * 100) / 100;
    if (kind === 'budget' || kind === 'progress') {
      if (!s.target && kind === 'progress') s.target = s.field ? 100 : 10;
      if (!s.target && kind === 'budget') s.target = 100;
    }
    if (kind === 'best') s.best = lower(rs.best) === 'min' || byKey(field)?.compute?.kind === 'pace' ? 'min' : 'max';
    if (kind === 'budget') {
      const group = resolve(rs.group ?? rs.group_by);
      if (group && groupable(group)) {
        s.group = group;
        if (isObj(rs.targets)) {
          const t: Record<string, number> = {};
          for (const [k, v] of Object.entries(rs.targets).slice(0, 30)) {
            const n = num(v);
            if (n && n > 0 && str(k, 40)) t[str(k, 40)] = Math.round(n * 100) / 100;
          }
          if (Object.keys(t).length) s.targets = t;
        }
      }
    }
    if (isObj(rs.filter)) {
      const rf = rs.filter;
      const ff = resolve(rf.field);
      const fdef = byKey(ff);
      if (fdef?.type === 'checkbox') s.filter = { field: fdef.key, value: rf.value !== false && rf.value !== 'false' };
      else if (fdef?.type === 'status') {
        const opt = fdef.options?.find((o) => o.id === rf.value || o.label.toLowerCase() === String(rf.value).toLowerCase());
        if (opt) s.filter = { field: fdef.key, value: opt.id };
      }
    }
    summaries.push(s);
  }

  return { design: { fields, views, summaries, primary, check }, dropped };
}

export function defaultViewName(type: ViewType): string {
  return { checklist: 'Checklist', table: 'Table', board: 'Board', grouped: 'By group', gallery: 'Gallery', calendar: 'Calendar', chart: 'Chart' }[type];
}

export function defaultSummaryLabel(kind: SummaryKind): string {
  return { total: 'Total', budget: 'Budget', count: 'Items', average: 'Average', progress: 'Progress', streak: 'Streak', best: 'Personal best' }[kind];
}

// ---------------------------------------------------------------------------
// Item values
// ---------------------------------------------------------------------------
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Makes a URL safe to render as a link: http(s) only; a bare domain gets https://. */
export function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s || s.length > LIMITS.link) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s.replace(/^\/+/, '')}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Coerces one value to its field's type; returns undefined when it isn't valid (the value is then dropped). */
export function normalizeValue(field: Field, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === '') return undefined;
  switch (field.type) {
    case 'text':
    case 'person':
      return str(raw, LIMITS.text) || undefined;
    case 'long_text':
      return typeof raw === 'string' ? raw.trim().slice(0, LIMITS.longText) || undefined : undefined;
    case 'number':
    case 'money': {
      const n = num(raw);
      return n === undefined || Math.abs(n) > 1e12 ? undefined : Math.round(n * 100) / 100;
    }
    case 'duration': {
      const n = typeof raw === 'string' ? parseDurationText(raw) : num(raw);
      return n === undefined || n === null || n < 0 || n > 366 * 86400 ? undefined : Math.round(n);
    }
    case 'rating': {
      const n = num(raw);
      return n === undefined ? undefined : Math.min(5, Math.max(1, Math.round(n)));
    }
    case 'date':
      return typeof raw === 'string' && DAY.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : undefined;
    case 'checkbox':
      return raw === true || raw === 'true' || raw === 1;
    case 'status': {
      const opt = field.options?.find((o) => o.id === raw || o.label.toLowerCase() === String(raw).toLowerCase());
      return opt?.id;
    }
    case 'link':
      return cleanUrl(raw) ?? undefined;
    case 'tags': {
      const list = Array.isArray(raw) ? raw : String(raw).split(',');
      const tags = [...new Set(list.map((t) => str(String(t).replace(/^#/, ''), LIMITS.tag).toLowerCase()).filter(Boolean))].slice(0, LIMITS.tags);
      return tags.length ? tags : undefined;
    }
    case 'image':
      // A storage path inside the user's own folder, or an https URL.
      return typeof raw === 'string' && (/^[0-9a-f-]{36}\/[\w.-]{1,80}$/i.test(raw) || /^https:\/\//.test(raw)) ? raw.slice(0, LIMITS.link) : undefined;
    case 'computed':
      return undefined; // never stored
  }
}

/** Cleans a whole values object against a design: unknown keys and invalid values are dropped. */
export function normalizeValues(design: SpaceDesign, raw: unknown): ItemValues {
  const src = isObj(raw) ? raw : {};
  const out: ItemValues = {};
  for (const f of design.fields) {
    const v = normalizeValue(f, src[f.key]);
    if (v !== undefined && !(f.type === 'checkbox' && v === false)) out[f.key] = v;
  }
  return out;
}

/** "28:30" → 1710, "1:02:03" → 3723, "45 min" → 2700, "1h 20m" → 4800. */
export function parseDurationText(text: string): number | null {
  const s = text.trim().toLowerCase();
  let m = s.match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/);
  if (m) return m[3] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
  let total = 0;
  let found = false;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/g;
  while ((m = re.exec(s))) {
    found = true;
    const n = Number(m[1]);
    total += m[2].startsWith('h') ? n * 3600 : m[2].startsWith('s') ? n : n * 60;
  }
  if (found) return Math.round(total);
  const n = Number(s);
  return Number.isFinite(n) && s !== '' ? Math.round(n * 60) : null; // a bare number means minutes
}

/** Empty item values for a new item (dates that default to today). */
export function defaultValues(design: SpaceDesign, today: string): ItemValues {
  const out: ItemValues = {};
  for (const f of design.fields) if (f.type === 'date' && f.default_today) out[f.key] = today;
  return out;
}

/** The fields a read-only share link may show. */
export function publicFields(design: SpaceDesign): Field[] {
  return design.fields.filter((f) => !f.private && !(f.type === 'computed' && f.compute?.fields.some((k) => design.fields.find((x) => x.key === k)?.private)));
}

/** A design with private fields (and anything built on them) removed, for share links. */
export function publicDesign(design: SpaceDesign): SpaceDesign {
  const fields = publicFields(design);
  const keys = new Set(fields.map((f) => f.key));
  const check = design.check && keys.has(design.check) ? design.check : null;
  const views = design.views.filter((v) => (!v.field || keys.has(v.field)) && (!v.y || keys.has(v.y)) && !(v.type === 'checklist' && !check));
  return {
    fields,
    primary: design.primary,
    check,
    // A gift list's checklist depends on the private Bought field, so the share page falls back to a plain list.
    views: views.length ? views : [{ id: 'list', type: 'table', name: 'List' }],
    summaries: design.summaries.filter((s) => (!s.field || keys.has(s.field)) && (!s.group || keys.has(s.group)) && (!s.filter || keys.has(s.filter.field)) && s.kind !== 'budget'),
  };
}
