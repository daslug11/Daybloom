/**
 * Computed fields, summary cards, chart series and value formatting for Spaces.
 * Pure functions over a design and its items; used by the app, the share page
 * and the server (so ✨ Insights is given real numbers instead of guessing).
 */
import type { Field, ItemValues, SpaceDesign, Summary, View } from './blocks.js';

export interface ItemLike {
  id: string;
  values: ItemValues;
  created_at?: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const DAY_MS = 86_400_000;
const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY_MS;

export function fieldByKey(design: SpaceDesign, key: string | undefined | null): Field | undefined {
  return key ? design.fields.find((f) => f.key === key) : undefined;
}

/** A field's value for an item, working out computed fields. Numbers for numeric fields. */
export function valueOf(_design: SpaceDesign, field: Field, item: ItemLike, today: string): unknown {
  if (field.type !== 'computed' || !field.compute) return item.values[field.key];
  const src = field.compute.fields.map((k) => item.values[k]);
  switch (field.compute.kind) {
    case 'sum': {
      const nums = src.filter(isNum);
      return nums.length ? round2(nums.reduce((a, b) => a + b, 0)) : null;
    }
    case 'difference':
      return isNum(src[0]) && isNum(src[1]) ? round2(src[0] - src[1]) : null;
    case 'pace':
      // seconds per unit of distance
      return isNum(src[0]) && isNum(src[1]) && src[1] > 0 ? Math.round(src[0] / src[1]) : null;
    case 'days_until':
      return typeof src[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src[0]) ? Math.round(dayNum(src[0]) - dayNum(today)) : null;
    case 'percent_of_target': {
      const t = field.compute.target ?? 100;
      return isNum(src[0]) && t > 0 ? Math.round((src[0] / t) * 1000) / 10 : null;
    }
  }
}

export function numberOf(design: SpaceDesign, key: string | undefined, item: ItemLike, today: string): number | null {
  const f = fieldByKey(design, key);
  if (!f) return null;
  const v = valueOf(design, f, item, today);
  return isNum(v) ? v : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export function formatDuration(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const sign = seconds < 0 ? '−' : '';
  return h ? `${sign}${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${sign}${m}:${String(sec).padStart(2, '0')}`;
}

export function formatMoney(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

export function formatDay(d: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  const date = new Date(`${d}T12:00:00`);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString(undefined, opts);
}

/** The unit a pace is "per", from the distance field. */
function paceUnit(design: SpaceDesign, field: Field) {
  const dist = fieldByKey(design, field.compute?.fields[1]);
  return dist?.unit ? `/${dist.unit}` : '';
}

/** Plain-text display of a value (used everywhere a value is shown as text). */
export function formatValue(design: SpaceDesign, field: Field, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  switch (field.type) {
    case 'money':
      return isNum(value) ? formatMoney(value, field.currency) : '';
    case 'number':
      return isNum(value) ? `${formatNumber(value)}${field.unit ? ` ${field.unit}` : ''}` : '';
    case 'duration':
      return isNum(value) ? formatDuration(value) : '';
    case 'rating':
      return isNum(value) ? '★'.repeat(value) + '☆'.repeat(5 - value) : '';
    case 'date':
      return typeof value === 'string' ? formatDay(value, { month: 'short', day: 'numeric', year: value.slice(0, 4) === String(new Date().getFullYear()) ? undefined : 'numeric' }) : '';
    case 'checkbox':
      return value ? 'Yes' : 'No';
    case 'status':
      return field.options?.find((o) => o.id === value)?.label ?? '';
    case 'tags':
      return Array.isArray(value) ? value.map((t) => `#${t}`).join(' ') : '';
    case 'link':
      return typeof value === 'string' ? value.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';
    case 'image':
      return value ? 'Image' : '';
    case 'computed': {
      if (!isNum(value) || !field.compute) return '';
      switch (field.compute.kind) {
        case 'pace':
          return `${formatDuration(value)}${paceUnit(design, field)}`;
        case 'days_until':
          return value === 0 ? 'Today' : value > 0 ? `${value} day${value === 1 ? '' : 's'}` : `${-value} day${value === -1 ? '' : 's'} ago`;
        case 'percent_of_target':
          return `${formatNumber(value)}%`;
        default: {
          const first = fieldByKey(design, field.compute.fields[0]);
          return first ? formatValue(design, { ...first, type: first.type === 'computed' ? 'number' : first.type }, value) : formatNumber(value);
        }
      }
    }
    default:
      return String(value);
  }
}

/** Formats a number "like" a field (money, duration, unit), for summaries and charts. */
export function formatAs(design: SpaceDesign, key: string | undefined, n: number): string {
  const f = fieldByKey(design, key);
  if (!f) return formatNumber(n);
  if (f.type === 'computed' && f.compute?.kind !== 'pace' && f.compute?.kind !== 'percent_of_target' && f.compute?.kind !== 'days_until') {
    const first = fieldByKey(design, f.compute?.fields[0]);
    if (first) return formatValue(design, first, round2(n));
  }
  if (f.type === 'rating') return `${formatNumber(round2(n))} ★`;
  return formatValue(design, f, f.type === 'duration' || f.compute?.kind === 'pace' ? Math.round(n) : round2(n));
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------
export interface SummaryResult {
  /** Big number, already formatted. */
  display: string;
  /** Line under it ("of $500 · $80 left"). */
  sub?: string;
  /** 0–1 for a progress meter. */
  ratio?: number;
  /** Over a budget / target. */
  over?: boolean;
  /** budget per group */
  groups?: { label: string; amount: string; target?: string; over: boolean; ratio?: number }[];
  /** best: the item that holds it */
  itemId?: string;
  /** Raw number (for Insights and the Dashboard). */
  value: number | null;
  /** No data yet. */
  empty?: boolean;
}

export function matchesFilter(design: SpaceDesign, item: ItemLike, filter: Summary['filter']): boolean {
  if (!filter) return true;
  const f = fieldByKey(design, filter.field);
  if (!f) return true;
  const v = item.values[f.key];
  if (f.type === 'checkbox') return (v === true) === (filter.value === true);
  return v === filter.value;
}

export function filterLabel(design: SpaceDesign, filter: Summary['filter']): string {
  if (!filter) return '';
  const f = fieldByKey(design, filter.field);
  if (!f) return '';
  if (f.type === 'checkbox') return filter.value ? f.name.toLowerCase() : `not ${f.name.toLowerCase()}`;
  return f.options?.find((o) => o.id === filter.value)?.label.toLowerCase() ?? '';
}

/** Distinct days (YYYY-MM-DD) an item counts on, for streaks. */
function itemDay(design: SpaceDesign, field: string | undefined, item: ItemLike, tz?: string): string | null {
  const v = field ? item.values[field] : undefined;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (!field && item.created_at) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.created_at));
    } catch {
      return item.created_at.slice(0, 10);
    }
  }
  void design;
  return null;
}

export function streakDays(days: Set<string>, today: string): number {
  let n = 0;
  let d = dayNum(today);
  const key = (x: number) => new Date(x * DAY_MS).toISOString().slice(0, 10);
  // A streak still counts if today has nothing yet but yesterday does.
  if (!days.has(key(d))) d -= 1;
  while (days.has(key(d))) {
    n++;
    d -= 1;
  }
  return n;
}

export function computeSummary(design: SpaceDesign, s: Summary, items: ItemLike[], today: string, tz?: string): SummaryResult {
  const scoped = items.filter((i) => matchesFilter(design, i, s.filter));
  const nums = (list: ItemLike[]) => list.map((i) => numberOf(design, s.field, i, today)).filter(isNum);
  switch (s.kind) {
    case 'total': {
      const n = nums(scoped);
      const total = n.reduce((a, b) => a + b, 0);
      return { display: formatAs(design, s.field, total), value: round2(total), empty: !n.length, sub: s.filter ? `${filterLabel(design, s.filter)} only` : undefined };
    }
    case 'count': {
      if (s.filter) {
        const ratio = items.length ? scoped.length / items.length : 0;
        return { display: `${scoped.length} of ${items.length}`, sub: filterLabel(design, s.filter), value: scoped.length, ratio, empty: !items.length };
      }
      return { display: String(items.length), sub: items.length === 1 ? 'item' : 'items', value: items.length, empty: !items.length };
    }
    case 'average': {
      const n = nums(scoped);
      if (!n.length) return { display: '—', value: null, empty: true, sub: 'nothing logged yet' };
      const avg = n.reduce((a, b) => a + b, 0) / n.length;
      return { display: formatAs(design, s.field, avg), value: round2(avg), sub: `over ${n.length} item${n.length === 1 ? '' : 's'}` };
    }
    case 'progress': {
      const target = s.target ?? 100;
      const current = s.field ? nums(scoped).reduce((a, b) => a + b, 0) : scoped.length;
      const ratio = target > 0 ? current / target : 0;
      const fmt = (n: number) => (s.field ? formatAs(design, s.field, n) : formatNumber(n));
      return {
        display: `${Math.round(ratio * 100)}%`,
        sub: `${fmt(current)} of ${fmt(target)}`,
        ratio: Math.min(1, ratio),
        value: round2(current),
        over: ratio >= 1,
        empty: !scoped.length,
      };
    }
    case 'budget': {
      const target = s.target ?? 0;
      const spent = nums(scoped).reduce((a, b) => a + b, 0);
      const left = target - spent;
      const fmt = (n: number) => formatAs(design, s.field, n);
      const result: SummaryResult = {
        display: fmt(spent),
        sub: `of ${fmt(target)} · ${left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`}${s.filter ? ` (${filterLabel(design, s.filter)})` : ''}`,
        ratio: target > 0 ? Math.min(1, spent / target) : 0,
        over: left < 0,
        value: round2(spent),
        empty: !scoped.length,
      };
      const g = fieldByKey(design, s.group);
      if (g) {
        const by = new Map<string, number>();
        for (const i of scoped) {
          const label = groupLabels(design, g, i.values[g.key])[0] ?? 'No ' + g.name.toLowerCase();
          by.set(label, (by.get(label) ?? 0) + (numberOf(design, s.field, i, today) ?? 0));
        }
        for (const label of Object.keys(s.targets ?? {})) if (!by.has(label)) by.set(label, 0);
        result.groups = [...by.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([label, amount]) => {
            const t = s.targets?.[label];
            return { label, amount: fmt(amount), target: t ? fmt(t) : undefined, over: t !== undefined && amount > t, ratio: t ? Math.min(1, amount / t) : undefined };
          });
      }
      return result;
    }
    case 'streak': {
      const days = new Set(scoped.map((i) => itemDay(design, s.field, i, tz)).filter((d): d is string => !!d && d <= today));
      const n = streakDays(days, today);
      return { display: `${n} day${n === 1 ? '' : 's'}`, sub: n ? 'in a row' : days.size ? 'log one today to start again' : 'log your first one', value: n, empty: !days.size };
    }
    case 'best': {
      let bestItem: ItemLike | null = null;
      let best: number | null = null;
      for (const i of scoped) {
        const n = numberOf(design, s.field, i, today);
        if (n === null || (s.best === 'min' && n <= 0)) continue;
        if (best === null || (s.best === 'min' ? n < best : n > best)) {
          best = n;
          bestItem = i;
        }
      }
      if (best === null || !bestItem) return { display: '—', value: null, empty: true, sub: 'nothing logged yet' };
      const date = design.fields.find((f) => f.type === 'date');
      const when = date && typeof bestItem.values[date.key] === 'string' ? formatDay(bestItem.values[date.key] as string) : '';
      const name = String(bestItem.values[design.primary] ?? '').slice(0, 40);
      return { display: formatAs(design, s.field, best), sub: [when, name].filter(Boolean).join(' · ') || undefined, value: best, itemId: bestItem.id };
    }
  }
}

// ---------------------------------------------------------------------------
// Grouping (board, grouped list, budgets)
// ---------------------------------------------------------------------------
/** The group label(s) a value falls into. Tags can be in several groups. */
export function groupLabels(design: SpaceDesign, field: Field, value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (field.type === 'tags') return Array.isArray(value) ? value.map((t) => `#${t}`) : [];
  if (field.type === 'checkbox') return [value ? field.name : `Not ${field.name.toLowerCase()}`];
  if (field.type === 'status') return [field.options?.find((o) => o.id === value)?.label ?? ''].filter(Boolean);
  if (field.type === 'person' || field.type === 'text') return [String(value).trim()].filter(Boolean);
  return [formatValue(design, field, value)].filter(Boolean);
}

export interface Group<T extends ItemLike> {
  key: string;
  label: string;
  items: T[];
}

export function groupItems<T extends ItemLike>(design: SpaceDesign, fieldKey: string | undefined, items: T[]): Group<T>[] {
  const field = fieldByKey(design, fieldKey);
  if (!field) return [{ key: 'all', label: 'All', items }];
  const groups = new Map<string, Group<T>>();
  if (field.type === 'status') for (const o of field.options ?? []) groups.set(o.id, { key: o.id, label: o.label, items: [] });
  const none: Group<T> = { key: '__none', label: `No ${field.name.toLowerCase()}`, items: [] };
  for (const item of items) {
    const v = item.values[field.key];
    if (field.type === 'status') {
      const g = typeof v === 'string' ? groups.get(v) : undefined;
      (g ?? none).items.push(item);
      continue;
    }
    const labels = groupLabels(design, field, v);
    if (!labels.length) none.items.push(item);
    for (const label of labels) {
      const k = label.toLowerCase();
      if (!groups.has(k)) groups.set(k, { key: k, label, items: [] });
      groups.get(k)!.items.push(item);
    }
  }
  const list = [...groups.values()];
  if (field.type !== 'status') list.sort((a, b) => a.label.localeCompare(b.label));
  if (none.items.length) list.push(none);
  return list;
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------
export interface ChartPoint {
  day: string;
  value: number;
}

/** One point per day with data, oldest first. Skipped days are gaps, never zeros. */
export function chartSeries(design: SpaceDesign, view: View, items: ItemLike[], today: string): ChartPoint[] {
  const by = new Map<string, number[]>();
  for (const i of items) {
    const d = view.field ? i.values[view.field] : undefined;
    if (typeof d !== 'string' || d > today) continue;
    const n = view.agg === 'count' || !view.y ? 1 : numberOf(design, view.y, i, today);
    if (n === null) continue;
    if (!by.has(d)) by.set(d, []);
    by.get(d)!.push(n);
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, ns]) => {
      const agg = view.agg ?? 'sum';
      const value =
        agg === 'avg' ? ns.reduce((a, b) => a + b, 0) / ns.length : agg === 'max' ? Math.max(...ns) : agg === 'min' ? Math.min(...ns) : ns.reduce((a, b) => a + b, 0);
      return { day, value: round2(value) };
    });
}

// ---------------------------------------------------------------------------
// Searching and sorting
// ---------------------------------------------------------------------------
export function itemText(design: SpaceDesign, item: ItemLike): string {
  return design.fields
    .filter((f) => ['text', 'long_text', 'person', 'tags', 'status', 'link'].includes(f.type))
    .map((f) => formatValue(design, f, item.values[f.key]))
    .join(' ')
    .toLowerCase();
}

export function itemTitle(design: SpaceDesign, item: ItemLike): string {
  const v = item.values[design.primary];
  if (typeof v === 'string' && v.trim()) return v.trim().split('\n')[0].slice(0, 120);
  const date = design.fields.find((f) => f.type === 'date');
  if (date && typeof item.values[date.key] === 'string') return formatDay(item.values[date.key] as string, { weekday: 'short', month: 'short', day: 'numeric' });
  return 'Untitled';
}
