// Display helpers for dates, times and durations. Kept apart from quickAdd.ts so pages that only
// show tasks don't download the natural-language date parser (chrono-node).
import { addDays, dateKey, daysBetween, parseKey } from './dates';

export function minutesFromTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDue(key: string, today: string = dateKey()) {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  const diff = daysBetween(today, key);
  const date = parseKey(key);
  return date.toLocaleDateString(undefined, diff > 0 && diff < 6 ? { weekday: 'long' } : { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
