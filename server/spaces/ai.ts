/**
 * The Space AI features. One shared designer turns plain words into a Space
 * design made only of building blocks (used by "New Space", the Brain Dump,
 * ✨ Redesign and Atlas); the rest are optional ✨ actions on one Space.
 * Each call counts as one AI action. Everyday use (adding, editing, checking
 * off, quick add, paste, link previews) never calls the model.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  chartSeries,
  COMPUTE_KINDS,
  FIELD_TYPES,
  formatAs,
  LIMITS,
  normalizeDesign,
  normalizeValues,
  SPACE_COLORS,
  STATUS_COLORS,
  SUMMARY_KINDS,
  VIEW_TYPES,
  type ItemValues,
  type SpaceDesign,
} from '../../shared/spaces/index.js';
import type { AuthedRequest } from '../auth.js';
import { loadCtx, type Ctx } from '../data/context.js';
import { HttpError } from '../http.js';
import { cached, runStructured, structuredCall } from '../ai/run.js';
import { fieldsText, itemLine, spaceById, spaceItems, summariesText, type ItemRow } from './data.js';

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const COLOR_NAMES = SPACE_COLORS.map((c) => c.name.toLowerCase());

// ---------------------------------------------------------------------------
// The designer
// ---------------------------------------------------------------------------
const Pair = z.object({ field: z.string().describe('field key'), value: z.string() });

const DesignOut = z.object({
  name: z.string().describe('≤ 40 chars'),
  emoji: z.string().describe('one emoji'),
  color: z.string().describe(COLOR_NAMES.join(' | ')),
  description: z.string().describe('one short sentence: what this Space is for'),
  primary: z.string().describe('key of the main text field'),
  check: z.string().nullable().describe('key of the checkbox used to tick items off, or null'),
  fields: z
    .array(
      z.object({
        key: z.string().describe('snake_case'),
        name: z.string(),
        type: z.string().describe(FIELD_TYPES.join(' | ')),
        options: z.array(z.object({ label: z.string(), color: z.string().describe(STATUS_COLORS.join(' | ')) })).nullable().describe('status only, up to 8'),
        currency: z.string().nullable().describe('money only, ISO code'),
        unit: z.string().nullable().describe('number only, e.g. km, mi, pages, kg'),
        compute: z
          .object({ kind: z.string().describe(COMPUTE_KINDS.join(' | ')), fields: z.array(z.string()), target: z.number().nullable() })
          .nullable()
          .describe('computed only'),
        default_today: z.boolean().nullable().describe('date only: new items get today'),
        private: z.boolean().nullable().describe('hide on shared links (gift prices, bought)'),
      }),
    )
    .describe(`2 to ${LIMITS.fields}`),
  views: z
    .array(
      z.object({
        type: z.string().describe(VIEW_TYPES.join(' | ')),
        name: z.string(),
        field: z.string().nullable().describe('board/grouped: group-by field · calendar/chart: date field · gallery: image or link field'),
        y: z.string().nullable().describe('chart only: numeric field to plot'),
        chart: z.string().nullable().describe('line | bar'),
        agg: z.string().nullable().describe('sum | avg | max | min | count'),
      }),
    )
    .describe(`1 to ${LIMITS.views}, best first`),
  summaries: z
    .array(
      z.object({
        kind: z.string().describe(SUMMARY_KINDS.join(' | ')),
        label: z.string(),
        field: z.string().nullable(),
        target: z.number().nullable().describe('budget amount or progress target'),
        group: z.string().nullable().describe('budget only: split by this field'),
        filter: Pair.nullable().describe('count/progress/budget: only items where field = value'),
        best: z.string().nullable().describe('best only: max | min'),
      }),
    )
    .describe(`0 to ${LIMITS.summaries}`),
  samples: z.array(z.object({ values: z.array(Pair) })).describe('2 or 3 realistic example items'),
  follow_up: z
    .object({ question: z.string().describe('≤ 12 words'), kind: z.string().describe('budget | target'), amount: z.number().nullable() })
    .nullable()
    .describe('one short optional question, only when the answer clearly improves the Space (e.g. a budget for a gift list); else null'),
});

const DESIGN_RULES = `You design "Spaces": simple personal lists and trackers in a planner app, built ONLY from these blocks.
Field types: text, long_text, number (optional unit), money (currency), date, checkbox, status (up to 8 coloured options), rating (1-5), link, person (a person or group), tags, duration (h:mm:ss), image, computed.
Computed (fixed list, never formulas): sum [2+ numbers], difference [a, b], pace [duration, distance number], days_until [date], percent_of_target [number] with target.
Views: checklist (needs a checkbox), table, board (by a status), grouped (by person/status/tags), gallery (image or link), calendar (by a date), chart (date x, numeric y, line or bar).
Summary cards: total, budget (money vs target, optional group), count (optional filter), average, progress (toward target), streak (days in a row, by date), best (personal best, max or min).
Rules: keep it simple and focused (usually 4-8 fields, 1-3 views, 0-4 cards). Use the user's words for names. The main text field is "primary". Gift and wish lists: mark price and bought private. Logs (runs, workouts, reading) get a date with default_today. Never more than ${LIMITS.fields} fields, ${LIMITS.views} views, ${LIMITS.summaries} cards.`;

export interface DesignResult {
  name: string;
  emoji: string;
  color: number;
  description: string;
  design: SpaceDesign;
  samples: ItemValues[];
  follow_up: { question: string; kind: 'budget' | 'target'; amount: number | null } | null;
  /** What validation removed (shown to the user, plainly). */
  dropped: string[];
}

function designPrompt(ctx: Ctx, request: string, current?: { name: string; design: SpaceDesign } | null) {
  const lines = [`Today is ${ctx.now.weekday} ${ctx.now.day}.`];
  if (current) {
    lines.push(`Current Space "${current.name}". Keep existing field keys for fields that stay. Fields: ${fieldsText(current.design)}.`);
    lines.push(`Views: ${current.design.views.map((v) => `${v.type}${v.field ? ` by ${v.field}` : ''}`).join(', ')}. Cards: ${current.design.summaries.map((s) => s.kind).join(', ') || 'none'}.`);
    lines.push(`Change requested: ${clip(request, 500)}`);
  } else lines.push(`The user wants: ${clip(request, 500)}`);
  return lines.join('\n');
}

/** Validates the model's design and shapes it for the app. */
export function shapeDesign(raw: z.infer<typeof DesignOut>, current?: SpaceDesign | null): DesignResult {
  const { design, dropped } = normalizeDesign(raw, current);
  const samples = (raw.samples ?? [])
    .slice(0, 3)
    .map((s) => normalizeValues(design, Object.fromEntries((s.values ?? []).map((p) => [p.field, p.value]))))
    .filter((v) => Object.keys(v).length);
  const fu = raw.follow_up;
  const kind = fu && ['budget', 'target'].includes(String(fu.kind).toLowerCase()) ? (String(fu.kind).toLowerCase() as 'budget' | 'target') : null;
  return {
    name: clip(String(raw.name ?? '').replace(/\s+/g, ' ').trim() || 'New Space', LIMITS.spaceName),
    emoji: [...String(raw.emoji ?? '')].slice(0, 2).join('').trim() || '✨',
    color: Math.max(0, COLOR_NAMES.indexOf(String(raw.color ?? '').toLowerCase())),
    description: clip(String(raw.description ?? '').trim(), 200),
    design,
    samples,
    follow_up: fu && kind && fu.question ? { question: clip(fu.question.trim(), 100), kind, amount: typeof fu.amount === 'number' && fu.amount > 0 ? Math.round(fu.amount) : null } : null,
    dropped,
  };
}

/** Designs a Space inside an Atlas reply (billed to that reply, not a separate AI action). */
export async function designForAtlas(ctx: Ctx, request: string, current?: { name: string; design: SpaceDesign } | null): Promise<DesignResult> {
  const raw = await structuredCall({
    system: DESIGN_RULES,
    prompt: designPrompt(ctx, request, current),
    schema: DesignOut,
    maxTokens: 2000,
    onUsage: (u) => (ctx.extraUsage ??= []).push(u),
  });
  return shapeDesign(raw, current?.design);
}

/** ✨ "New Space" and ✨ Redesign: returns a design to preview. Never writes. */
async function spaceDesign(auth: AuthedRequest, input: Record<string, unknown>) {
  const request = typeof input.request === 'string' ? input.request.trim() : '';
  if (!request) throw new HttpError(400, 'Describe the Space you want first.');
  if (request.length > 500) throw new HttpError(400, 'Keep the description under 500 characters.');
  const ctx = await loadCtx(auth);
  const current = input.space_id ? await spaceById(ctx, input.space_id) : null;
  const { result, remaining } = await runStructured(auth, current ? 'space_redesign' : 'space_design', {
    system: DESIGN_RULES,
    prompt: designPrompt(ctx, request, current),
    schema: DesignOut,
    maxTokens: 2000,
  });
  return { result: shapeDesign(result, current?.design), remaining, cached: false };
}

// ---------------------------------------------------------------------------
// Smart actions on one Space
// ---------------------------------------------------------------------------
/** Plain facts about a Space for the model: summaries plus month-on-month trends for charts. */
export function spaceFacts(design: SpaceDesign, items: ItemRow[], today: string, tz: string): string {
  const lines = [`Items: ${items.length}`, `Cards: ${summariesText(design, items, today, tz)}`];
  const minus = (n: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  for (const v of design.views.filter((x) => x.type === 'chart')) {
    const pts = chartSeries(design, { ...v, agg: v.agg === 'sum' ? 'avg' : v.agg }, items, today);
    const recent = pts.filter((p) => p.day > minus(30));
    const before = pts.filter((p) => p.day <= minus(30) && p.day > minus(60));
    const avg = (xs: { value: number }[]) => xs.reduce((a, b) => a + b.value, 0) / xs.length;
    if (recent.length && before.length) {
      const a = avg(before);
      const b = avg(recent);
      const yName = design.fields.find((f) => f.key === v.y)?.name ?? 'items';
      const pct = a ? Math.round(((b - a) / Math.abs(a)) * 100) : 0;
      lines.push(`${yName} per entry: last 30 days avg ${formatAs(design, v.y, b)} vs previous 30 days ${formatAs(design, v.y, a)} (${pct >= 0 ? '+' : ''}${pct}%)`);
    }
  }
  const pace = design.fields.find((f) => f.compute?.kind === 'pace');
  const date = design.fields.find((f) => f.type === 'date');
  if (pace && date) {
    const pts = chartSeries(design, { id: 'p', type: 'chart', name: 'p', field: date.key, y: pace.key, agg: 'avg' }, items, today);
    const recent = pts.filter((p) => p.day > minus(30));
    const before = pts.filter((p) => p.day <= minus(30) && p.day > minus(60));
    if (recent.length && before.length) {
      const a = before.reduce((s, p) => s + p.value, 0) / before.length;
      const b = recent.reduce((s, p) => s + p.value, 0) / recent.length;
      const pct = Math.round(((a - b) / a) * 100);
      lines.push(`Average pace: last 30 days ${formatAs(design, pace.key, b)} vs previous ${formatAs(design, pace.key, a)} (${pct >= 0 ? `${pct}% faster` : `${-pct}% slower`})`);
    }
  }
  return lines.join('\n');
}

const InsightsOut = z.object({
  headline: z.string().describe('one sentence, the most useful true thing'),
  points: z.array(z.string()).describe('at most 3 short, specific observations'),
});

async function spaceInsights(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  const space = await spaceById(ctx, input.space_id);
  const items = await spaceItems(ctx, space.id);
  if (items.length < 2) throw new HttpError(400, 'Add a few items first — insights need at least 2.');
  const facts = spaceFacts(space.design, items, ctx.now.day, ctx.tz);
  const sample = items.slice(-60).map((i) => itemLine(null, space.design, i, ctx.now.day)).join('\n');
  const key = hash(`${space.updated_at}|${facts}|${items.map((i) => i.id + i.updated_at).join(',')}`);
  return cached(auth, 'space_insights', `${space.id}:${key}`, !!input.force, async () => {
    const r = await runStructured(auth, 'space_insights', {
      system: `You summarise one of ${ctx.name}'s Spaces ("${space.name}") honestly. Use ONLY the facts and items given; never invent or estimate numbers. Mention money over/under budget, trends and personal bests when the facts show them. Plain, kind and brief.`,
      prompt: `Fields: ${space.design.fields.map((f) => f.name).join(', ')}\nFACTS:\n${facts}\nRecent items:\n${clip(sample, 6000)}`,
      schema: InsightsOut,
      maxTokens: 600,
    });
    return { ...r, result: { headline: clip(r.result.headline, 240), points: r.result.points.slice(0, 3).map((p) => clip(p, 200)) } };
  });
}

const AskOut = z.object({ answer: z.string().describe('1-3 sentences, from the data only') });

async function spaceAsk(auth: AuthedRequest, input: Record<string, unknown>) {
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  if (!question) throw new HttpError(400, 'Type a question about this Space.');
  if (question.length > 300) throw new HttpError(400, 'Keep the question under 300 characters.');
  const ctx = await loadCtx(auth);
  const space = await spaceById(ctx, input.space_id);
  const items = await spaceItems(ctx, space.id);
  const lines = items.map((i) => itemLine(null, space.design, i, ctx.now.day));
  let text = lines.join('\n');
  let note = '';
  if (text.length > 14000) {
    text = clip(text, 14000);
    note = `(Only the first items fit; the Space has ${items.length} in total.)`;
  }
  const { result, remaining } = await runStructured(auth, 'space_ask', {
    system: `Answer ${ctx.name}'s question using ONLY the data from their Space "${space.name}" below. Do arithmetic carefully. If the data can't answer it, say so plainly. Today is ${ctx.now.day}.`,
    prompt: `Cards: ${summariesText(space.design, items, ctx.now.day, ctx.tz)}\nItems:\n${text || '(none)'}\n${note}\nQuestion: ${question}`,
    schema: AskOut,
    maxTokens: 500,
  });
  return { result: { answer: clip(result.answer, 800) }, remaining, cached: false };
}

const SuggestOut = z.object({ items: z.array(z.object({ values: z.array(Pair) })).describe('3 to 6 new items'), note: z.string().describe('≤ 15 words') });

async function spaceSuggest(auth: AuthedRequest, input: Record<string, unknown>) {
  const ctx = await loadCtx(auth);
  const space = await spaceById(ctx, input.space_id);
  const items = await spaceItems(ctx, space.id, 400);
  const focus = clip(typeof input.prompt === 'string' ? input.prompt.trim() : '', 200);
  const existing = items.slice(-80).map((i) => itemLine(null, space.design, i, ctx.now.day)).join('\n');
  const { result, remaining } = await runStructured(auth, 'space_suggest', {
    system: `Suggest new items for ${ctx.name}'s Space "${space.name}". Base ideas on what's already there, especially their own notes; don't repeat existing items. Fill fields only when you're confident (prices are rough guesses only if typical). Use field keys exactly.`,
    prompt: `Fields: ${fieldsText(space.design)}\n${focus ? `Focus: ${focus}\n` : ''}Existing items:\n${clip(existing, 7000) || '(none yet)'}`,
    schema: SuggestOut,
    maxTokens: 900,
  });
  const suggestions = result.items
    .slice(0, 6)
    .map((s) => normalizeValues(space.design, Object.fromEntries((s.values ?? []).map((p) => [p.field, p.value]))))
    .filter((v) => Object.keys(v).length);
  return { result: { items: suggestions, note: clip(result.note ?? '', 120) }, remaining, cached: false };
}

export const SPACE_FEATURES = {
  space_design: spaceDesign,
  space_insights: spaceInsights,
  space_ask: spaceAsk,
  space_suggest: spaceSuggest,
};
