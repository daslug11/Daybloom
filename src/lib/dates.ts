export function dateKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgo(n: number, from: Date = new Date()) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return { text: 'Burning the midnight oil', emoji: '🌙' };
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  if (h < 21) return { text: 'Good evening', emoji: '🌆' };
  return { text: 'Good night', emoji: '🌙' };
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function shortDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

/** Consecutive days (ending today, or yesterday if today isn't done yet). */
export function streak(completions: string[]) {
  const set = new Set(completions);
  let n = 0;
  let i = set.has(dateKey()) ? 0 : 1;
  while (set.has(dateKey(daysAgo(i)))) {
    n++;
    i++;
  }
  return n;
}
