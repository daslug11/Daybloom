import { supabase } from './supabase';

/**
 * Data saved by the old, localStorage-only version of Daybloom on this device.
 * Demo rows that version seeded automatically (fixed ids) are skipped.
 */
const KEYS = {
  tasks: 'daybloom:tasks',
  habits: 'daybloom:habits',
  moods: 'daybloom:moods',
  goals: 'daybloom:goals',
  notes: 'daybloom:notes',
  calendars: 'daybloom:calendars',
  groups: 'daybloom:calendar-groups',
};
const SEEDED = /^(t-(done|open)-\d+|h-\d+|g-\d+|n-\d+|c-(holidays|team|calendly|demo)|cg-(work|personal|school))$/;

/* eslint-disable @typescript-eslint/no-explicit-any */
function read(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
const own = (rows: any) => (Array.isArray(rows) ? rows.filter((r) => r && typeof r === 'object' && !SEEDED.test(String(r.id ?? ''))) : []);

export interface LocalSummary {
  tasks: number;
  habits: number;
  notes: number;
  goals: number;
  moods: number;
  calendars: number;
}

export function localDataSummary(): LocalSummary | null {
  if (typeof localStorage === 'undefined') return null;
  const moods = read(KEYS.moods);
  const summary = {
    tasks: own(read(KEYS.tasks)).length,
    habits: own(read(KEYS.habits)).length,
    notes: own(read(KEYS.notes)).length,
    goals: own(read(KEYS.goals)).length,
    // Moods have no ids; the old version seeded the 13 days before first launch.
    moods: moods && typeof moods === 'object' ? Object.keys(moods).length : 0,
    calendars: own(read(KEYS.calendars)).length,
  };
  return Object.values(summary).some((n) => n > 0) ? summary : null;
}

const handledKey = (uid: string) => `daybloom:local-import-handled:${uid}`;
export const importHandled = (uid: string) => {
  try {
    return localStorage.getItem(handledKey(uid)) === '1';
  } catch {
    return true;
  }
};
export const markImportHandled = (uid: string) => {
  try {
    localStorage.setItem(handledKey(uid), '1');
  } catch {
    /* ignore */
  }
};

const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

/** Copies the local data into the user's account. Returns how many rows were imported. */
export async function importLocalData(opts: { moods: boolean }): Promise<number> {
  let count = 0;
  const check = (res: { error: { message: string } | null }) => {
    if (res.error) throw new Error(res.error.message);
  };

  const groups = own(read(KEYS.groups));
  const groupMap = new Map<string, string>();
  for (const g of groups) {
    const { data, error } = await supabase.from('calendar_groups').insert({ name: clip(g.name || 'Group', 60), color: Number(g.color) % 8 || 0 }).select('id').single();
    if (error) throw new Error(error.message);
    groupMap.set(g.id, data.id);
    count++;
  }
  const calendars = own(read(KEYS.calendars)).filter((c: any) => typeof c.url === 'string' && c.url.length >= 8);
  if (calendars.length) {
    check(
      await supabase.from('calendars').insert(
        calendars.map((c: any) => ({
          name: clip(c.name || 'Calendar', 80),
          url: clip(c.url, 2048),
          emoji: clip(c.emoji || '📅', 16),
          color: Number(c.color) % 8 || 0,
          group_id: c.groupId ? groupMap.get(c.groupId) ?? null : null,
          pinned: !!c.pinned,
          sync: !!c.sync,
        })),
      ),
    );
    count += calendars.length;
  }

  const notes = own(read(KEYS.notes)).filter((n: any) => typeof n.text === 'string' && n.text.trim());
  if (notes.length) {
    check(await supabase.from('notes').insert(notes.map((n: any) => ({ body: clip(n.text, 20000), state: 'inbox', created_at: n.createdAt }))));
    count += notes.length;
  }

  const goals = own(read(KEYS.goals)).filter((g: any) => g.title && Number(g.target) > 0);
  if (goals.length) {
    check(
      await supabase.from('goals').insert(
        goals.map((g: any) => ({ title: clip(g.title, 200), emoji: clip(g.emoji || '🎯', 16), target: Number(g.target), current: Math.max(0, Number(g.current) || 0), unit: clip(g.unit, 40) })),
      ),
    );
    count += goals.length;
  }

  const tasks = own(read(KEYS.tasks)).filter((t: any) => t.title);
  if (tasks.length) {
    check(
      await supabase.from('tasks').insert(
        tasks.map((t: any) => {
          const s = t.schedule;
          const sched = s && day(s.date) && Number.isInteger(s.start) && Number.isInteger(s.duration) ? { sched_date: s.date, sched_start: s.start, sched_duration: s.duration } : {};
          return {
            title: clip(t.title, 300),
            done: t.status === 'done',
            completed_at: t.status === 'done' ? t.completedAt ?? new Date().toISOString() : null,
            priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : null,
            tags: Array.isArray(t.tags) ? t.tags.slice(0, 20).map((x: unknown) => clip(x, 30)) : [],
            due_date: day(t.due),
            due_time: typeof t.dueTime === 'string' && /^\d{2}:\d{2}$/.test(t.dueTime) ? t.dueTime : null,
            estimate_min: Number.isInteger(t.estimate) && t.estimate > 0 ? t.estimate : null,
            ...sched,
          };
        }),
      ),
    );
    count += tasks.length;
  }

  for (const h of own(read(KEYS.habits)).filter((x: any) => x.name)) {
    const { data, error } = await supabase.from('habits').insert({ name: clip(h.name, 120), emoji: clip(h.emoji || '✅', 16) }).select('id').single();
    if (error) throw new Error(error.message);
    count++;
    const days = (Array.isArray(h.completions) ? h.completions : []).map(day).filter(Boolean);
    if (days.length) check(await supabase.from('habit_logs').insert(days.map((d: string) => ({ habit_id: data.id, day: d }))));
  }

  if (opts.moods) {
    const moods = read(KEYS.moods);
    const rows = moods && typeof moods === 'object' ? Object.entries(moods).filter(([d, s]) => day(d) && Number(s) >= 1 && Number(s) <= 5).map(([d, s]) => ({ day: d, score: Number(s) })) : [];
    if (rows.length) {
      check(await supabase.from('moods').upsert(rows, { onConflict: 'user_id,day', ignoreDuplicates: true }));
      count += rows.length;
    }
  }
  return count;
}
