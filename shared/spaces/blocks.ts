/**
 * Spaces: the fixed set of building blocks a Space is designed from.
 *
 * The AI never writes code for a Space. It (or a template, or the user) picks
 * from these field types, computed fields, views and summary cards, and the app
 * renders them. Everything here is plain data with no imports, so the browser,
 * the server and the tests share one definition.
 */

export const FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'money',
  'date',
  'checkbox',
  'status',
  'rating',
  'link',
  'person',
  'tags',
  'duration',
  'image',
  'computed',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Computed fields come from this list only: there are no free-form formulas. */
export const COMPUTE_KINDS = ['sum', 'difference', 'pace', 'days_until', 'percent_of_target'] as const;
export type ComputeKind = (typeof COMPUTE_KINDS)[number];

export const VIEW_TYPES = ['checklist', 'table', 'board', 'grouped', 'gallery', 'calendar', 'chart'] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

export const SUMMARY_KINDS = ['total', 'budget', 'count', 'average', 'progress', 'streak', 'best'] as const;
export type SummaryKind = (typeof SUMMARY_KINDS)[number];

/** Status option colours. Names map to tokens in the app; none is cyan (reserved for Atlas). */
export const STATUS_COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];

/** A Space's identity colour (by index), the same eight solid hues as calendars. */
export const SPACE_COLORS = [
  { name: 'Grape', hex: '#8b5cf6' },
  { name: 'Ocean', hex: '#3b82f6' },
  { name: 'Bubblegum', hex: '#ec4899' },
  { name: 'Sunset', hex: '#f97316' },
  { name: 'Mint', hex: '#10b981' },
  { name: 'Plum', hex: '#c026d3' },
  { name: 'Graphite', hex: '#71717a' },
  { name: 'Ember', hex: '#ef4444' },
] as const;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'MXN', 'BRL', 'CHF', 'SEK', 'NZD'] as const;

export const LIMITS = {
  fields: 15,
  views: 3,
  summaries: 6,
  statusOptions: 8,
  activeSpaces: 25,
  itemsPerSpace: 5000,
  /** Lines accepted by one paste. */
  pasteLines: 500,
  spaceName: 60,
  fieldName: 40,
  optionLabel: 30,
  text: 500,
  longText: 5000,
  link: 2000,
  tags: 10,
  tag: 30,
  /** Uploaded images (bytes), after the browser has resized them. */
  imageBytes: 2 * 1024 * 1024,
} as const;

export interface StatusOption {
  id: string;
  label: string;
  color: StatusColor;
}

export interface ComputeSpec {
  kind: ComputeKind;
  /** Source field keys: sum = 2+ numbers; difference = [a, b]; pace = [duration, distance]; days_until = [date]; percent_of_target = [number]. */
  fields: string[];
  /** percent_of_target only. */
  target?: number;
}

export interface Field {
  key: string;
  name: string;
  type: FieldType;
  /** status */
  options?: StatusOption[];
  /** money (ISO code) */
  currency?: string;
  /** number: a unit like km, mi, pages, kg (also used by quick add). */
  unit?: string;
  /** computed */
  compute?: ComputeSpec;
  /** date: new items get today's date. */
  default_today?: boolean;
  /** Hidden from read-only share links. */
  private?: boolean;
}

export interface View {
  id: string;
  type: ViewType;
  name: string;
  /** board/grouped: field to group by · calendar: date field · gallery: image or link field · chart: date field (x). */
  field?: string;
  /** chart: the value plotted (number, money, duration or computed); omitted = count of items. */
  y?: string;
  chart?: 'line' | 'bar';
  agg?: 'sum' | 'avg' | 'max' | 'min' | 'count';
}

export interface Summary {
  id: string;
  kind: SummaryKind;
  label: string;
  /** total/average/best/progress/budget: the measured field. streak: a date field (default: created date). */
  field?: string;
  /** budget: the budget · progress: the target. */
  target?: number;
  /** budget: split by this field (e.g. person) with an optional budget per group. */
  group?: string;
  targets?: Record<string, number>;
  /** count/progress/budget: only items where this field equals this value (e.g. Bought = true). */
  filter?: { field: string; value: string | boolean };
  /** best: highest (max) or lowest (min), e.g. fastest pace. */
  best?: 'max' | 'min';
}

export interface SpaceDesign {
  fields: Field[];
  views: View[];
  summaries: Summary[];
  /** The main text field: quick add puts leftover words here. */
  primary: string;
  /** The checkbox that check-off, swipe and "Reset all" use (null = none). */
  check: string | null;
}

export type ItemValues = Record<string, unknown>;

export interface LinkPreview {
  url: string;
  title?: string | null;
  image?: string | null;
  price?: number | null;
  currency?: string | null;
  site?: string | null;
  ok: boolean;
}

export interface SpaceSettings {
  /** Linked habit / goal: logging an item counts toward them. */
  habit_id?: string | null;
  goal_id?: string | null;
  /** Which field adds to the goal (null = each item counts 1). */
  goal_field?: string | null;
  /** Show items with this date field in the Planner. */
  planner_field?: string | null;
  /** Remind N days before this date field. */
  reminder_field?: string | null;
  reminder_days?: number;
  /** Shown on the Dashboard's Pinned Spaces card. */
  pinned?: boolean;
  /** The view open last. */
  view?: string | null;
}

export const FIELD_LABELS: Record<FieldType, string> = {
  text: 'Text',
  long_text: 'Long text',
  number: 'Number',
  money: 'Money',
  date: 'Date',
  checkbox: 'Checkbox',
  status: 'Status',
  rating: 'Rating (1–5)',
  link: 'Link',
  person: 'Person / group',
  tags: 'Tags',
  duration: 'Duration',
  image: 'Image',
  computed: 'Computed',
};

export const COMPUTE_LABELS: Record<ComputeKind, string> = {
  sum: 'Sum',
  difference: 'Difference',
  pace: 'Pace (time ÷ distance)',
  days_until: 'Days until',
  percent_of_target: 'Percent of target',
};

export const VIEW_LABELS: Record<ViewType, string> = {
  checklist: 'Checklist',
  table: 'Table',
  board: 'Board',
  grouped: 'Grouped list',
  gallery: 'Gallery',
  calendar: 'Calendar',
  chart: 'Chart',
};

export const SUMMARY_LABELS: Record<SummaryKind, string> = {
  total: 'Total',
  budget: 'Budget vs spent',
  count: 'Count',
  average: 'Average',
  progress: 'Progress to target',
  streak: 'Streak',
  best: 'Personal best',
};

/** Field types that hold a number you can add up or chart. */
export const NUMERIC_TYPES: readonly FieldType[] = ['number', 'money', 'duration', 'rating', 'computed'];
/** Field types a board or grouped list can group by. */
export const GROUPABLE_TYPES: readonly FieldType[] = ['status', 'person', 'tags', 'checkbox', 'rating', 'text'];
