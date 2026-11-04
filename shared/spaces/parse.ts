/**
 * Quick add for Spaces, with no AI: reads one line ("Mom airpods $130 amazon.com",
 * "5k 28:30 felt great") using the Space's own fields, and a pasted list line by
 * line. When unsure, the words go into the main field as plain text.
 */
import type { Field, ItemValues, SpaceDesign } from './blocks.js';
import { cleanUrl, parseDurationText } from './design.js';

export interface ParsedChip {
  field: string;
  /** "For: Mom", "Price: $130" */
  label: string;
}

export interface ParseResult {
  values: ItemValues;
  chips: ParsedChip[];
}

export interface ParseContext {
  today: string;
  /** People/groups already used in this Space (so "Sam lego" finds Sam). */
  people?: string[];
}

const RELATIONS = [
  'mom', 'mum', 'mother', 'dad', 'father', 'mama', 'papa', 'sis', 'sister', 'bro', 'brother', 'grandma', 'grandpa', 'granny', 'nana', 'nan',
  'grandad', 'granddad', 'gran', 'aunt', 'auntie', 'uncle', 'cousin', 'wife', 'husband', 'partner', 'boyfriend', 'girlfriend', 'bf', 'gf', 'son',
  'daughter', 'boss', 'roommate', 'bestie', 'teacher', 'coach', 'baby', 'kids', 'family', 'everyone',
];

/** Number-field units and the words that mean them. */
const UNIT_WORDS: Record<string, string[]> = {
  km: ['km', 'kms', 'k', 'kilometer', 'kilometers', 'kilometre', 'kilometres'],
  mi: ['mi', 'mile', 'miles'],
  m: ['m', 'meter', 'meters', 'metre', 'metres'],
  kg: ['kg', 'kgs', 'kilo', 'kilos'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  lbs: ['lb', 'lbs', 'pound', 'pounds'],
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TLDS = 'com|org|net|io|co|uk|de|fr|ca|au|app|dev|shop|store|me|us|eu|es|it|nl|jp|in|edu|gov|info|biz|ly|tv|ai|so|xyz|page|site|link';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const pad = (n: number) => String(n).padStart(2, '0');

/** Finds a date phrase. Returns the day and the matched text. */
export function findDate(text: string, today: string): { day: string; match: string } | null {
  const t = text.toLowerCase();
  let m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return { day: `${m[1]}-${m[2]}-${m[3]}`, match: m[0] };
  m = t.match(/\b(today|tonight|tomorrow|tmrw|yesterday)\b/);
  if (m) return { day: addDays(today, m[1] === 'yesterday' ? -1 : m[1].startsWith('to') && m[1] !== 'tomorrow' ? 0 : 1), match: m[0] };
  m = t.match(/\bin (\d{1,3}) (day|days|week|weeks)\b/);
  if (m) return { day: addDays(today, Number(m[1]) * (m[2].startsWith('week') ? 7 : 1)), match: m[0] };
  // Full weekday names ("friday"), or short ones after next/this/last ("next fri"); a bare "sat" or "sun" is a word.
  m = t.match(/\b(?:(next|this|last) )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/) ?? t.match(/\b(next|this|last) (sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/);
  if (m) {
    const target = WEEKDAYS.indexOf(m[2].slice(0, 3));
    const now = new Date(`${today}T12:00:00Z`).getUTCDay();
    let diff = (target - now + 7) % 7;
    if (m[1] === 'last') diff = diff === 0 ? -7 : diff - 7;
    else if (m[1] === 'next' && diff === 0) diff = 7;
    return { day: addDays(today, diff), match: m[0] };
  }
  const year = Number(today.slice(0, 4));
  const pickYear = (mo: number, d: number) => {
    // A date without a year means the next one (a Christmas list in November means this December).
    const candidate = `${year}-${pad(mo)}-${pad(d)}`;
    return candidate < addDays(today, -60) ? `${year + 1}-${pad(mo)}-${pad(d)}` : candidate;
  };
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?\b/);
  if (m) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3)) + 1;
    const d = Number(m[2]);
    if (d >= 1 && d <= 31) return { day: m[3] ? `${m[3]}-${pad(mo)}-${pad(d)}` : pickYear(mo, d), match: m[0] };
  }
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)? (?:of )?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?: (\d{4}))?\b/);
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3)) + 1;
    const d = Number(m[1]);
    if (d >= 1 && d <= 31) return { day: m[3] ? `${m[3]}-${pad(mo)}-${pad(d)}` : pickYear(mo, d), match: m[0] };
  }
  m = t.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$)/);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : null;
      return { day: y ? `${y}-${pad(mo)}-${pad(d)}` : pickYear(mo, d), match: m[0].trim() };
    }
  }
  return null;
}

/** Fields quick add can fill, excluding computed and image fields. */
const fillable = (design: SpaceDesign, type: Field['type']) => design.fields.filter((f) => f.type === type);

export function parseQuickAdd(input: string, design: SpaceDesign, ctx: ParseContext): ParseResult {
  let rest = ` ${input.replace(/\s+/g, ' ').trim()} `;
  const values: ItemValues = {};
  const chips: ParsedChip[] = [];
  const take = (match: string) => {
    rest = rest.replace(match, ' ');
  };
  const set = (f: Field, value: unknown, label: string) => {
    if (values[f.key] !== undefined) return false;
    values[f.key] = value;
    chips.push({ field: f.key, label: `${f.name}: ${label}` });
    return true;
  };
  const first = (type: Field['type']) => fillable(design, type).find((f) => values[f.key] === undefined);

  // Links (full URLs or bare domains like amazon.com/item).
  const linkField = first('link');
  if (linkField) {
    const m = rest.match(new RegExp(`(?:^|\\s)((?:https?:\\/\\/)\\S+|(?:www\\.)?[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})(?:\\/\\S*)?)(?=\\s|$)`, 'i'));
    const url = m && cleanUrl(m[1].replace(/[),.]+$/, ''));
    if (m && url) {
      take(m[1]);
      set(linkField, url, url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 40));
    }
  }

  // Tags.
  const tagField = first('tags');
  if (tagField) {
    const tags = [...rest.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{1,30})/gu)].map((m) => m[1].toLowerCase());
    if (tags.length) {
      for (const m of rest.matchAll(/(?:^|\s)#[\p{L}\p{N}_-]{1,30}/gu)) take(m[0].trim());
      set(tagField, [...new Set(tags)].slice(0, 10), tags.map((t) => `#${t}`).join(' '));
    }
  }

  // Money: $130, 130 USD, €20, 25 bucks.
  const moneyField = first('money');
  if (moneyField) {
    const m =
      rest.match(/(?:^|\s)([$€£¥₹])\s?(\d[\d,]*(?:\.\d{1,2})?)(?=\s|$)/) ??
      rest.match(/(?:^|\s)(\d[\d,]*(?:\.\d{1,2})?)\s?(usd|eur|gbp|dollars?|euros?|pounds|bucks|€|£)(?=\s|$)/i);
    if (m) {
      const amount = Number((/\d/.test(m[1]) ? m[1] : m[2]).replace(/,/g, ''));
      if (Number.isFinite(amount)) {
        take(m[0].trim());
        set(moneyField, amount, new Intl.NumberFormat(undefined, { style: 'currency', currency: moneyField.currency ?? 'USD', maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount));
      }
    }
  }

  // Durations: 28:30, 1:02:03, 45 min, 1h 20m.
  const durField = first('duration');
  if (durField) {
    const m = rest.match(/(?:^|\s)(\d{1,3}:[0-5]\d(?::[0-5]\d)?)(?=\s|$)/) ?? rest.match(/(?:^|\s)((?:\d+(?:\.\d+)?\s?(?:h|hr|hrs|hours?)\s?)?\d+\s?(?:min|mins|minutes?)|\d+(?:\.\d+)?\s?(?:h|hr|hrs|hours?))(?=\s|$)/i);
    const secs = m ? parseDurationText(m[1]) : null;
    if (m && secs !== null && secs > 0) {
      take(m[1]);
      const h = Math.floor(secs / 3600);
      const mm = Math.floor((secs % 3600) / 60);
      const ss = secs % 60;
      set(durField, secs, h ? `${h}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`);
    }
  }

  // Numbers with a unit (5k, 3.1 mi, 120 pages, 3 sets).
  for (const f of fillable(design, 'number')) {
    if (!f.unit) continue;
    const words = UNIT_WORDS[f.unit] ?? [f.unit, `${f.unit}s`, f.unit.replace(/s$/, '')];
    const otherDistance = f.unit === 'km' ? UNIT_WORDS.mi : f.unit === 'mi' ? UNIT_WORDS.km : null;
    let m = rest.match(new RegExp(`(?:^|\\s)(\\d+(?:\\.\\d+)?)\\s?(${words.map(esc).join('|')})(?=\\s|$|[,.])`, 'i'));
    let n = m ? Number(m[1]) : NaN;
    if (!m && otherDistance) {
      // "5k" into a miles field (and "3 miles" into a km field) is converted.
      m = rest.match(new RegExp(`(?:^|\\s)(\\d+(?:\\.\\d+)?)\\s?(${otherDistance.map(esc).join('|')})(?=\\s|$|[,.])`, 'i'));
      if (m) n = f.unit === 'mi' ? Number(m[1]) * 0.621371 : Number(m[1]) * 1.609344;
    }
    if (m && Number.isFinite(n)) {
      take(m[0].trim());
      n = Math.round(n * 100) / 100;
      set(f, n, `${n} ${f.unit}`);
    }
  }

  // Ratings: 4/5, 5 stars, ★★★★.
  const ratingField = first('rating');
  if (ratingField) {
    const m = rest.match(/(?:^|\s)([1-5])\s?(?:\/\s?5|stars?|★)(?=\s|$)/i) ?? rest.match(/(?:^|\s)(★{1,5})(?=\s|$)/);
    if (m) {
      const n = /★/.test(m[1]) ? m[1].length : Number(m[1]);
      take(m[0].trim());
      set(ratingField, n, '★'.repeat(n));
    }
  }

  // Dates.
  const dateField = first('date');
  if (dateField) {
    const d = findDate(rest, ctx.today);
    if (d) {
      rest = rest.replace(new RegExp(`(?:\\s(?:on|due|by))?\\s${esc(d.match)}`, 'i'), ' ');
      set(dateField, d.day, new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }
  }

  // Status options by name ("applied", "to buy").
  for (const f of fillable(design, 'status')) {
    const opts = [...(f.options ?? [])].sort((a, b) => b.label.length - a.label.length);
    for (const o of opts) {
      if (o.label.length < 3) continue;
      const m = rest.match(new RegExp(`(?:^|\\s)(${esc(o.label)})(?=\\s|$|[,.])`, 'i'));
      if (m) {
        take(m[1]);
        set(f, o.id, o.label);
        break;
      }
    }
  }

  // Checkboxes by name ("bought", "packed").
  for (const f of fillable(design, 'checkbox')) {
    const m = rest.match(new RegExp(`(?:^|\\s)(${esc(f.name)}|✓|✔)(?=\\s|$|[,.])`, 'i'));
    if (m && f.name.length >= 3) {
      take(m[1]);
      set(f, true, 'yes');
    }
  }

  // Person / group: "for Sam", a known person, or a relation word at the start ("Mom airpods").
  const personField = first('person');
  if (personField) {
    const known = [...new Set((ctx.people ?? []).map((p) => p.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
    let m = rest.match(/(?:^|\s)for (\p{Lu}[\p{L}'-]*(?: \p{Lu}[\p{L}'-]*)?|my \p{L}+|[a-z]+)(?=\s|$|[,.])/u);
    let who: string | null = null;
    if (m) {
      const candidate = m[1].replace(/^my /i, '');
      if (/^\p{Lu}/u.test(m[1]) || RELATIONS.includes(candidate.toLowerCase()) || known.some((k) => k.toLowerCase() === candidate.toLowerCase())) {
        who = candidate;
        take(m[0].trim());
      }
    }
    if (!who) {
      for (const k of known) {
        m = rest.match(new RegExp(`^\\s(${esc(k)})(?=\\s|$|[,:])`, 'i'));
        if (m) {
          who = k;
          take(m[1]);
          break;
        }
      }
    }
    if (!who) {
      m = rest.match(/^\s(my )?([\p{L}]+)(?=[\s,:]|$)/u);
      if (m && RELATIONS.includes(m[2].toLowerCase()) && rest.trim().split(' ').length > 1) {
        who = m[2];
        take(m[0].trim());
      }
    }
    if (who) {
      const existing = known.find((k) => k.toLowerCase() === who!.toLowerCase());
      const name = existing ?? titleCase(who);
      set(personField, name, name);
    }
  }

  // Whatever is left is the main text.
  const text = rest
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '')
    .replace(/^(?:and|for|to|at|on|@)\s+/i, '')
    .trim();
  const primary = design.fields.find((f) => f.key === design.primary);
  if (text && primary) values[primary.key] = text;
  return { values, chips };
}

/** One pasted line → its text, and whether it was already ticked ("[x] socks"). */
export function cleanListLine(line: string): { text: string; checked: boolean } | null {
  let s = line.replace(/\t+/g, ' ').trim();
  if (!s) return null;
  let checked = false;
  const box = s.match(/^(?:[-*•◦▪‣·]\s*)?\[( |x|X|✓)\]\s*/) ?? s.match(/^([☐☑☒✓✔✅])\s*/u);
  if (box) {
    checked = /x|✓|✔|☑|☒|✅/i.test(box[1]);
    s = s.slice(box[0].length);
  }
  s = s.replace(/^(?:[-*•◦▪‣·]|\d{1,3}[.)]|[a-z][.)](?=\s))\s+/i, '').trim();
  if (!s || /^[-=_*#]{3,}$/.test(s)) return null;
  return { text: s.slice(0, 500), checked };
}

/** A pasted list (from Notes, a message, a web page) → one parsed item per line. */
export function parseList(text: string, design: SpaceDesign, ctx: ParseContext, max = 500): ParseResult[] {
  const out: ParseResult[] = [];
  const people = [...(ctx.people ?? [])];
  // "Mom:" on its own line sets the person for the lines under it.
  let heading: string | null = null;
  const personField = design.fields.find((f) => f.type === 'person');
  for (const raw of text.split(/\r?\n/)) {
    if (out.length >= max) break;
    const line = cleanListLine(raw);
    if (!line) continue;
    const head = line.text.match(/^([\p{L}][\p{L}' -]{0,30}):$/u);
    if (head && personField) {
      heading = head[1].trim();
      continue;
    }
    const parsed = parseQuickAdd(line.text, design, { ...ctx, people });
    if (heading && personField && parsed.values[personField.key] === undefined) {
      parsed.values[personField.key] = heading;
      parsed.chips.push({ field: personField.key, label: `${personField.name}: ${heading}` });
    }
    const who = personField ? parsed.values[personField.key] : undefined;
    if (typeof who === 'string' && !people.includes(who)) people.push(who);
    if (line.checked && design.check) parsed.values[design.check] = true;
    if (Object.keys(parsed.values).length) out.push(parsed);
  }
  return out;
}
