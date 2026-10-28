/** Date helpers that work in the user's own time zone (profiles.timezone). */

export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function parts(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return { y: get('year'), m: get('month'), d: get('day'), hour: Number(get('hour')), minute: Number(get('minute')), weekday: get('weekday') };
}

/** YYYY-MM-DD for `date` as seen in `tz`. */
export function dayIn(tz: string, date = new Date()) {
  const { y, m, d } = parts(date, tz);
  return `${y}-${m}-${d}`;
}

export function nowIn(tz: string, date = new Date()) {
  const p = parts(date, tz);
  return {
    day: `${p.y}-${p.m}-${p.d}`,
    minutes: p.hour * 60 + p.minute,
    time: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
    weekday: p.weekday,
  };
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Monday of the week containing `day`. */
export function weekStart(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}

export function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function parseHhmm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes from local midnight of `day` in `tz` for an ISO instant, clipped to the day. */
export function minutesOnDay(iso: string, day: string, tz: string): number | null {
  const date = new Date(iso);
  const d = dayIn(tz, date);
  if (d < day) return 0;
  if (d > day) return null;
  const p = parts(date, tz);
  return p.hour * 60 + p.minute;
}
