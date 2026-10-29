/** Date helpers. Days are "YYYY-MM-DD" keys in the user's profile time zone. */

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD for `date` as seen in `tz` (default: the browser's zone). */
export function dayIn(tz: string | undefined, date = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const get = (t: string) => p.find((x) => x.type === t)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return dateKey(date);
  }
}

/** Minutes since midnight in `tz`. */
export function minutesIn(tz: string | undefined, date = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    return Number(p.find((x) => x.type === 'hour')!.value) * 60 + Number(p.find((x) => x.type === 'minute')!.value);
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

/** Local (browser) date key. */
export function dateKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Noon on that calendar day, local — safe for display and arithmetic. */
export function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: string, n: number) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Monday of the week containing `key`. */
export function weekStart(key: string) {
  const d = parseKey(key);
  return addDays(key, -((d.getDay() + 6) % 7));
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}

export function greeting(minutes: number) {
  const h = Math.floor(minutes / 60);
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDay(key: string, today: string, opts: { long?: boolean } = {}) {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  const diff = daysBetween(today, key);
  const d = parseKey(key);
  if (diff > 0 && diff < 7) return d.toLocaleDateString(undefined, { weekday: opts.long ? 'long' : 'short' });
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== parseKey(today).getFullYear() ? 'numeric' : undefined });
}

/** Consecutive logged days ending today (or yesterday if today isn't logged yet). */
export function streak(days: Set<string>, today: string) {
  let n = 0;
  let d = days.has(today) ? today : addDays(today, -1);
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
