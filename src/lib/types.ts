export type PageId =
  | 'dashboard'
  | 'tasks'
  | 'habits'
  | 'focus'
  | 'goals'
  | 'notes'
  | 'calendars'
  | 'review';

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  emoji?: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  /** Local date keys (YYYY-MM-DD) on which the habit was done. */
  completions: string[];
  createdAt: string;
}

/** Mood score 1–5 keyed by local date. */
export type MoodLog = Record<string, number>;

export interface Goal {
  id: string;
  title: string;
  emoji: string;
  target: number;
  current: number;
  unit: string;
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface Settings {
  name: string;
  theme: 'dark' | 'light';
  sidebarCollapsed: boolean;
  pomodoro: { work: number; rest: number };
}

export type CalendarType =
  | 'google'
  | 'outlook'
  | 'apple'
  | 'notion'
  | 'calendly'
  | 'ics'
  | 'other';

export interface CalendarLink {
  id: string;
  name: string;
  url: string;
  emoji: string;
  /** Index into CALENDAR_COLORS. */
  color: number;
  groupId: string | null;
  pinned: boolean;
  createdAt: string;
}

export interface CalendarGroup {
  id: string;
  name: string;
  color: number;
}
