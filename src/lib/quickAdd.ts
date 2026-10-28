import * as chrono from 'chrono-node';
import { dateKey } from './dates';
import type { Priority, Task } from './types';
import { uid } from './utils';

export interface ParsedTask {
  title: string;
  /** Local date key (YYYY-MM-DD). */
  due?: string;
  /** 24h "HH:MM", only when the input mentioned a time. */
  time?: string;
  tags: string[];
  priority?: Priority;
  /** Minutes, from "for 45m" / "for 2h" or a "3-4pm" range. */
  duration?: number;
}

const PRIORITY_WORDS: Record<string, Priority> = {
  high: 'high', hi: 'high', h: 'high', urgent: 'high', '1': 'high', '!': 'high', '!!': 'high',
  medium: 'medium', med: 'medium', m: 'medium', '2': 'medium',
  low: 'low', lo: 'low', l: 'low', '3': 'low',
};

const TAG_RE = /(^|\s)#([\p{L}\p{N}_-]+)/gu;
const PRIORITY_RE = /(^|\s)!(high|hi|urgent|medium|med|low|lo|[hml123]|!{1,2})(?=\s|$)/gi;
const DURATION_RE = /(^|\s)for\s+(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|mins?|minutes?)(?=\s|$)/i;

const pad = (n: number) => String(n).padStart(2, '0');

/** "gym tomorrow 6pm #health !high" → { title: 'gym', due, time: '18:00', tags: ['health'], priority: 'high' } */
export function parseQuickAdd(input: string, now = new Date()): ParsedTask {
  let text = ` ${input} `;
  const tags: string[] = [];
  let priority: Priority | undefined;
  let duration: number | undefined;

  text = text.replace(TAG_RE, (_, lead: string, tag: string) => {
    const t = tag.toLowerCase();
    if (!tags.includes(t)) tags.push(t);
    return lead;
  });
  text = text.replace(PRIORITY_RE, (_, lead: string, word: string) => {
    priority = PRIORITY_WORDS[word.toLowerCase()] ?? priority;
    return lead;
  });
  text = text.replace(DURATION_RE, (_, lead: string, n: string, unit: string) => {
    const value = Number(n);
    duration = Math.round(unit.toLowerCase().startsWith('h') ? value * 60 : value);
    return lead;
  });

  let due: string | undefined;
  let time: string | undefined;
  const [result] = chrono.parse(text, now, { forwardDate: true });
  if (result) {
    const start = result.start.date();
    due = dateKey(start);
    if (result.start.isCertain('hour')) {
      time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      if (result.end?.isCertain('hour') && duration === undefined) {
        const mins = Math.round((result.end.date().getTime() - start.getTime()) / 60000);
        if (mins > 0 && mins <= 24 * 60) duration = mins;
      }
    }
    text = text.slice(0, result.index) + ' ' + text.slice(result.index + result.text.length);
  }

  const title = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(at|on|by|from|@)$/i, '')
    .replace(/^(at|on|by)\s+/i, '')
    .trim();

  return { title, due, time, tags, priority, duration: duration && duration > 0 ? duration : undefined };
}

export function minutesFromTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Turns a parse result into a Task. A date + time also puts it on the Planner. */
export function taskFromParsed(p: ParsedTask, fallbackTitle: string): Task {
  const task: Task = {
    id: uid(),
    title: p.title || fallbackTitle.trim(),
    status: 'todo',
    createdAt: new Date().toISOString(),
  };
  if (p.tags.length) task.tags = p.tags;
  if (p.priority) task.priority = p.priority;
  if (p.due) task.due = p.due;
  if (p.time) task.dueTime = p.time;
  if (p.due && p.time) {
    const start = Math.floor(minutesFromTime(p.time) / 15) * 15;
    task.schedule = { date: p.due, start, duration: Math.min(p.duration ?? 60, 24 * 60 - start) };
  } else if (p.duration) {
    task.estimate = p.duration;
  }
  return task;
}

export function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDue(key: string, now = new Date()) {
  const today = dateKey(now);
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  if (key === today) return 'Today';
  if (key === dateKey(t)) return 'Tomorrow';
  const [y, mo, d] = key.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const diff = (date.getTime() - now.getTime()) / 86_400_000;
  return date.toLocaleDateString(undefined, diff > 0 && diff < 6 ? { weekday: 'long' } : { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
