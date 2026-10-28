import { dateKey, daysAgo } from './dates';
import { KEYS, readRaw, writeStorage } from './storage';
import type {
  CalendarGroup,
  CalendarLink,
  Goal,
  Habit,
  MoodLog,
  Note,
  Settings,
  Task,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  theme: 'dark',
  sidebarCollapsed: false,
  pomodoro: { work: 25, rest: 5 },
};

/** Tiny deterministic PRNG so demo data looks the same every reset. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function iso(days: number, hour = 10) {
  const d = daysAgo(days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

function seedTasks(): Task[] {
  const done: [string, number, number][] = [
    ['Ship landing page v2 🚀', 1, 11],
    ['Reply to Sam about the offsite', 2, 9],
    ['Book dentist appointment 🦷', 2, 15],
    ['Write Q4 planning doc', 6, 10],
    ['Fix flaky onboarding test', 6, 14],
    ['Grocery run 🥑', 6, 18],
    ['Refactor settings screen', 7, 16],
    ['Pay electricity bill 💡', 9, 12],
    ['Team retro notes', 13, 11],
    ['Renew passport ✈️', 13, 15],
  ];
  const tasks: Task[] = done.map(([title, d, h], i) => ({
    id: `t-done-${i}`,
    title,
    status: 'done',
    createdAt: iso(d + 2),
    completedAt: iso(d, h),
  }));
  const open: [string, Task['status']][] = [
    ['Prep slides for Friday demo 🎤', 'doing'],
    ['Draft blog post: "Why we vibe code"', 'doing'],
    ['Plan weekend hike 🥾', 'todo'],
    ['Call mom 📞', 'todo'],
    ['Clean up Notion workspace', 'todo'],
    ['Research standing desks', 'todo'],
  ];
  open.forEach(([title, status], i) =>
    tasks.push({ id: `t-open-${i}`, title, status, createdAt: iso(i + 1) }),
  );
  return tasks;
}

function seedHabits(): Habit[] {
  const defs: [string, string, number][] = [
    ['Drink 2L water', '💧', 0.85],
    ['Morning workout', '🏋️', 0.6],
    ['Read 20 pages', '📖', 0.7],
    ['Meditate', '🧘', 0.5],
  ];
  return defs.map(([name, emoji, p], i) => {
    const rand = rng(42 + i * 7);
    const completions: string[] = [];
    for (let d = 1; d < 84; d++) {
      // Recent days are a bit more consistent so streaks look 🔥.
      if (d < 5 + i * 2 || rand() < p) completions.push(dateKey(daysAgo(d)));
    }
    return { id: `h-${i}`, name, emoji, completions, createdAt: iso(90) };
  });
}

function seedMoods(): MoodLog {
  const values = [4, 3, 5, 4, 2, 4, 5, 3, 4, 4, 5, 3, 4];
  const log: MoodLog = {};
  values.forEach((v, i) => (log[dateKey(daysAgo(i + 1))] = v));
  return log;
}

function seedGoals(): Goal[] {
  return [
    { id: 'g-1', title: 'Read', emoji: '📚', target: 24, current: 9, unit: 'books' },
    { id: 'g-2', title: 'Run', emoji: '🏃', target: 500, current: 312, unit: 'km' },
    { id: 'g-3', title: 'Meditate', emoji: '🧘', target: 100, current: 41, unit: 'sessions' },
    { id: 'g-4', title: 'Ship', emoji: '🚀', target: 4, current: 3, unit: 'side projects' },
  ];
}

function seedNotes(): Note[] {
  return [
    { id: 'n-1', text: 'Buy oat milk, avocados and coffee beans', createdAt: iso(0, 8) },
    { id: 'n-2', text: 'Call Alex about the birthday dinner on Saturday', createdAt: iso(1, 19) },
    { id: 'n-3', text: 'Idea: an app that turns habits into a garden 🌱', createdAt: iso(2, 22) },
    { id: 'n-4', text: 'Pay rent before the 1st + update budget sheet', createdAt: iso(3, 9) },
    { id: 'n-5', text: 'Read "Deep Work" chapter 3 before the book club', createdAt: iso(4, 21) },
  ];
}

function seedSessions(): Record<string, number> {
  const counts = [3, 2, 4, 0, 1, 3, 2, 0, 4, 2];
  const log: Record<string, number> = {};
  counts.forEach((n, i) => n && (log[dateKey(daysAgo(i + 1))] = n));
  return log;
}

export function seedCalendarGroups(): CalendarGroup[] {
  return [
    { id: 'cg-work', name: '💼 Work', color: 0 },
    { id: 'cg-personal', name: '🏠 Personal', color: 2 },
    { id: 'cg-school', name: '🎓 School', color: 4 },
  ];
}

export function seedCalendars(): CalendarLink[] {
  return [
    {
      id: 'c-holidays',
      name: 'US Holidays',
      url: 'https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FNew_York',
      emoji: '🎉',
      color: 5,
      groupId: 'cg-personal',
      pinned: true,
      createdAt: iso(20),
    },
    {
      id: 'c-team',
      name: 'Team calendar',
      url: 'https://outlook.office365.com/owa/calendar/demo-team@example.com/calendar.html',
      emoji: '💼',
      color: 0,
      groupId: 'cg-work',
      pinned: true,
      createdAt: iso(18),
    },
    {
      id: 'c-calendly',
      name: 'Book a coffee chat',
      url: 'https://calendly.com/daybloom-demo/30min',
      emoji: '☕',
      color: 3,
      groupId: 'cg-work',
      pinned: false,
      createdAt: iso(10),
    },
  ];
}

/** Writes demo data for every feature. `keepName` preserves the user's name on reset. */
export function seedAll(keepName?: string) {
  writeStorage(KEYS.tasks, seedTasks());
  writeStorage(KEYS.focus, ['t-open-0', 't-open-3']);
  writeStorage(KEYS.habits, seedHabits());
  writeStorage(KEYS.moods, seedMoods());
  writeStorage(KEYS.goals, seedGoals());
  writeStorage(KEYS.notes, seedNotes());
  writeStorage(KEYS.calendars, seedCalendars());
  writeStorage(KEYS.calendarGroups, seedCalendarGroups());
  writeStorage(KEYS.sessions, seedSessions());
  writeStorage(KEYS.settings, { ...DEFAULT_SETTINGS, name: keepName ?? '' });
  writeStorage(KEYS.seeded, true);
}

export function seedIfFirstVisit() {
  if (readRaw(KEYS.seeded) === null) seedAll();
}
