export type PageId =
  | 'dashboard'
  | 'tasks'
  | 'habits'
  | 'focus'
  | 'goals'
  | 'notes'
  | 'calendars'
  | 'planner'
  | 'review';

export type TaskStatus = 'todo' | 'doing' | 'done';
export type Priority = 'high' | 'medium' | 'low';

/** A task placed on the Planner timeline. */
export interface TaskSchedule {
  date: string; // local date key
  start: number; // minutes from midnight, multiple of 15
  duration: number; // minutes, multiple of 15
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  emoji?: string;
  priority?: Priority;
  tags?: string[];
  /** Local date key the task is due. */
  due?: string;
  /** "HH:MM" when the quick-add input mentioned a time. */
  dueTime?: string;
  /** Minutes, from "for 45m" when there's no time to schedule at yet. */
  estimate?: number;
  schedule?: TaskSchedule;
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
  /** Include this calendar's ICS feed in Calendar Sync. */
  sync?: boolean;
  createdAt: string;
}

export interface CalendarGroup {
  id: string;
  name: string;
  color: number;
}
