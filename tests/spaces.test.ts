import { describe, expect, it } from 'vitest';
import {
  chartSeries,
  computeSummary,
  findDate,
  formatValue,
  LIMITS,
  normalizeDesign,
  normalizeValues,
  parseList,
  parseQuickAdd,
  publicDesign,
  streakDays,
  templateById,
  TEMPLATES,
  valueOf,
} from '../shared/spaces';

const TODAY = '2026-11-04'; // a Wednesday
const christmas = templateById('christmas')!.design;
const running = templateById('running')!.design;

describe('normalizeDesign', () => {
  it('drops unknown types and caps everything', () => {
    const raw = {
      fields: [
        { name: 'Name', type: 'text' },
        { name: 'Spell', type: 'magic' },
        ...Array.from({ length: 20 }, (_, i) => ({ name: `N${i}`, type: 'number' })),
      ],
      views: Array.from({ length: 5 }, () => ({ type: 'table' })).concat([{ type: 'kanban-3d' } as never]),
      summaries: Array.from({ length: 9 }, () => ({ kind: 'count' })),
    };
    const { design, dropped } = normalizeDesign(raw);
    expect(design.fields).toHaveLength(LIMITS.fields);
    expect(design.fields.some((f) => f.name === 'Spell')).toBe(false);
    expect(design.views).toHaveLength(LIMITS.views);
    expect(design.summaries).toHaveLength(LIMITS.summaries);
    expect(dropped.some((d) => d.includes('magic'))).toBe(true);
  });

  it('caps status options at 8 and fills colours', () => {
    const { design } = normalizeDesign({ fields: [{ name: 'Stage', type: 'status', options: Array.from({ length: 12 }, (_, i) => `S${i}`) }] });
    const stage = design.fields.find((f) => f.type === 'status')!;
    expect(stage.options).toHaveLength(LIMITS.statusOptions);
    expect(stage.options!.every((o) => o.color)).toBe(true);
  });

  it('always has a primary text field and at least one view', () => {
    const { design } = normalizeDesign({ fields: [{ name: 'Price', type: 'money' }] });
    expect(design.fields[0]).toMatchObject({ type: 'text' });
    expect(design.primary).toBe(design.fields[0].key);
    expect(design.views.length).toBe(1);
  });

  it('accepts type aliases and repairs views that point at missing fields', () => {
    const { design, dropped } = normalizeDesign({
      fields: [{ name: 'Title', type: 'string' }, { name: 'Cost', type: 'price' }],
      views: [{ type: 'board' }, { type: 'calendar' }, { type: 'checklist' }],
    });
    expect(design.fields.map((f) => f.type)).toEqual(['text', 'money', 'checkbox']);
    expect(design.views.map((v) => v.type)).toEqual(['checklist']);
    expect(dropped.join(' ')).toMatch(/board view/);
  });

  it('drops computed fields whose sources are missing, keeps valid ones', () => {
    const { design } = normalizeDesign({
      fields: [
        { name: 'Distance', type: 'number', unit: 'km' },
        { name: 'Time', type: 'duration' },
        { name: 'Pace', type: 'computed', compute: { kind: 'pace', fields: ['time', 'distance'] } },
        { name: 'Bad', type: 'computed', compute: { kind: 'days_until', fields: ['nope'] } },
        { name: 'Eval', type: 'computed', compute: { kind: 'javascript', fields: [] } },
      ],
    });
    expect(design.fields.map((f) => f.name)).toEqual(['Name', 'Distance', 'Time', 'Pace']);
    expect(design.fields.find((f) => f.name === 'Pace')!.compute!.fields).toEqual(['time', 'distance']);
  });

  it('keeps existing keys on redesign so item data stays attached', () => {
    const next = normalizeDesign({ fields: [{ name: 'Gift', type: 'text' }, { name: 'Price', type: 'money' }, { name: 'Size', type: 'text' }] }, christmas).design;
    expect(next.fields.map((f) => f.key)).toEqual(['gift', 'price', 'size']);
  });

  it('every template is valid and within limits', () => {
    expect(TEMPLATES).toHaveLength(14);
    for (const t of TEMPLATES) {
      const again = normalizeDesign(t.design, t.design);
      expect(again.dropped, t.id).toEqual([]);
      expect(t.design.fields.length).toBeLessThanOrEqual(LIMITS.fields);
      expect(t.design.views.length).toBeGreaterThan(0);
      for (const sample of t.samples(TODAY)) expect(Object.keys(normalizeValues(t.design, sample)).length, t.id).toBe(Object.keys(sample).length);
    }
  });
});

describe('normalizeValues', () => {
  it('coerces and drops invalid values', () => {
    const v = normalizeValues(christmas, { gift: '  AirPods  ', price: '$1,299.50', link: 'javascript:alert(1)', bought: 'true', nope: 1 });
    expect(v).toEqual({ gift: 'AirPods', price: 1299.5, bought: true });
  });
  it('only accepts http(s) links', () => {
    expect(normalizeValues(christmas, { link: 'amazon.com/x' }).link).toBe('https://amazon.com/x');
    expect(normalizeValues(christmas, { link: 'data:text/html,hi' }).link).toBeUndefined();
  });
});

describe('quick add', () => {
  it('reads a gift line', () => {
    const r = parseQuickAdd('Mom airpods $130 amazon.com', christmas, { today: TODAY });
    expect(r.values).toEqual({ for: 'Mom', gift: 'airpods', price: 130, link: 'https://amazon.com/' });
    expect(r.chips.map((c) => c.label)).toEqual(expect.arrayContaining(['For: Mom', 'Link: amazon.com']));
  });

  it('reads a run', () => {
    const r = parseQuickAdd('5k 28:30 felt great', running, { today: TODAY });
    expect(r.values).toEqual({ distance: 5, time: 1710, notes: 'felt great' });
  });

  it('finds known people and "for X"', () => {
    expect(parseQuickAdd('lego set for Sam', christmas, { today: TODAY }).values).toMatchObject({ for: 'Sam', gift: 'lego set' });
    expect(parseQuickAdd('priya candle 25 usd', christmas, { today: TODAY, people: ['Priya'] }).values).toMatchObject({ for: 'Priya', gift: 'candle', price: 25 });
  });

  it('falls back to plain text when unsure', () => {
    expect(parseQuickAdd('something nice', christmas, { today: TODAY }).values).toEqual({ gift: 'something nice' });
    expect(parseQuickAdd('Sat nav', christmas, { today: TODAY }).values).toEqual({ gift: 'Sat nav' });
  });

  it('converts km and miles to the field unit', () => {
    const miles = normalizeDesign({ fields: [{ name: 'Notes', type: 'long_text' }, { name: 'Distance', type: 'number', unit: 'mi' }] }).design;
    expect(parseQuickAdd('5k easy', miles, { today: TODAY }).values.distance).toBe(3.11);
  });

  it('reads status, dates, tags and ratings', () => {
    const reading = templateById('reading')!.design;
    expect(parseQuickAdd('Dune finished 5/5 #scifi', reading, { today: TODAY }).values).toEqual({ title: 'Dune', status: 'finished', rating: 5, tags: ['scifi'] });
    const assignments = templateById('assignments')!.design;
    expect(parseQuickAdd('Essay due friday', assignments, { today: TODAY }).values).toMatchObject({ assignment: 'Essay', due: '2026-11-06' });
  });
});

describe('findDate', () => {
  it('handles common phrases', () => {
    expect(findDate('tomorrow', TODAY)?.day).toBe('2026-11-05');
    expect(findDate('next wednesday', TODAY)?.day).toBe('2026-11-11');
    expect(findDate('dec 24', TODAY)?.day).toBe('2026-12-24');
    expect(findDate('Jan 3', TODAY)?.day).toBe('2027-01-03');
    expect(findDate('12/25', TODAY)?.day).toBe('2026-12-25');
    expect(findDate('in 2 weeks', TODAY)?.day).toBe('2026-11-18');
    expect(findDate('a sunny walk', TODAY)).toBeNull();
  });
});

describe('paste a list', () => {
  it('cleans bullets and checkboxes and keeps headings as people', () => {
    const items = parseList('Mom:\n- scarf $40\n- [x] book\n\nDad:\n1. socks\n---\n• wallet amazon.com', christmas, { today: TODAY });
    expect(items).toHaveLength(4);
    expect(items[0].values).toMatchObject({ for: 'Mom', gift: 'scarf', price: 40 });
    expect(items[1].values).toMatchObject({ for: 'Mom', gift: 'book', bought: true });
    expect(items[2].values).toMatchObject({ for: 'Dad', gift: 'socks' });
    expect(items[3].values).toMatchObject({ for: 'Dad', gift: 'wallet', link: 'https://amazon.com/' });
  });
  it('caps the number of lines', () => {
    expect(parseList(Array.from({ length: 900 }, (_, i) => `item ${i}`).join('\n'), christmas, { today: TODAY })).toHaveLength(LIMITS.pasteLines);
  });
});

describe('computed fields and summaries', () => {
  const items = [
    { id: 'a', values: { gift: 'AirPods', for: 'Mom', price: 130, bought: true } },
    { id: 'b', values: { gift: 'Socks', for: 'Dad', price: 160 } },
    { id: 'c', values: { gift: 'Book', for: 'Mom', price: 20 } },
  ];

  it('budget vs spent, per person', () => {
    const budget = { ...christmas.summaries.find((s) => s.kind === 'budget')!, target: 250, targets: { Dad: 100 } };
    const r = computeSummary(christmas, budget, items, TODAY);
    expect(r.value).toBe(310);
    expect(r.over).toBe(true);
    expect(r.groups!.find((g) => g.label === 'Dad')).toMatchObject({ over: true });
    expect(r.groups!.find((g) => g.label === 'Mom')).toMatchObject({ over: false });
  });

  it('count with a filter', () => {
    const bought = christmas.summaries.find((s) => s.kind === 'count')!;
    expect(computeSummary(christmas, bought, items, TODAY).display).toBe('1 of 3');
  });

  it('pace, personal bests and totals for runs', () => {
    const runs = [
      { id: 'r1', values: { date: '2026-11-01', distance: 5, time: 1710 } },
      { id: 'r2', values: { date: '2026-11-03', distance: 10, time: 3300 } },
      { id: 'r3', values: { date: '2026-11-04', distance: 3, time: 1200 } },
    ];
    const pace = running.fields.find((f) => f.key === 'pace')!;
    expect(valueOf(running, pace, runs[0], TODAY)).toBe(342);
    expect(formatValue(running, pace, 342)).toBe('5:42/km');
    const [total, longest, fastest, streak] = running.summaries.map((s) => computeSummary(running, s, runs, TODAY));
    expect(total.value).toBe(18);
    expect(longest).toMatchObject({ value: 10, itemId: 'r2' });
    expect(fastest).toMatchObject({ value: 330, itemId: 'r2' });
    expect(streak.value).toBe(2);
  });

  it('streaks survive a not-yet-logged today', () => {
    expect(streakDays(new Set(['2026-11-02', '2026-11-03']), TODAY)).toBe(2);
    expect(streakDays(new Set(['2026-11-01']), TODAY)).toBe(0);
  });

  it('days until', () => {
    const b = templateById('birthdays')!.design;
    const f = b.fields.find((x) => x.key === 'days_left')!;
    expect(valueOf(b, f, { id: 'x', values: { birthday: '2026-11-10' } }, TODAY)).toBe(6);
  });

  it('charts skip empty days and future items', () => {
    const view = running.views.find((v) => v.type === 'chart')!;
    const pts = chartSeries(running, view, [
      { id: '1', values: { date: '2026-11-01', distance: 5 } },
      { id: '2', values: { date: '2026-11-01', distance: 2 } },
      { id: '3', values: { date: '2026-11-03', distance: 4 } },
      { id: '4', values: { date: '2026-12-01', distance: 9 } },
    ], TODAY);
    expect(pts).toEqual([{ day: '2026-11-01', value: 7 }, { day: '2026-11-03', value: 4 }]);
  });
});

describe('share links', () => {
  it('hide private fields and anything built on them', () => {
    const pub = publicDesign(christmas);
    expect(pub.fields.map((f) => f.key)).toEqual(['gift', 'for', 'link', 'notes']);
    expect(pub.check).toBeNull();
    expect(pub.views.every((v) => v.type !== 'checklist')).toBe(true);
    expect(pub.summaries.some((s) => s.kind === 'budget')).toBe(false);
  });
});
