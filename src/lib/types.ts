/** Row types — mirror supabase/migrations. */
import type { OccurrenceRow, PlanSession, SeriesRow } from '../../server/data/recurrence';

export type { OccurrenceRow, PlanSession };
/** A recurring Planner block (block_series row). */
export type BlockSeries = SeriesRow;

export type Priority = 'high' | 'medium' | 'low';
export type NoteState = 'inbox' | 'idea' | 'note' | 'archived';
export type Theme = 'dark' | 'light';

export interface VoiceSettings {
  /** speechSynthesis voice URI; empty = auto (prefers an en-GB male voice). */
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  /** Speak Atlas replies aloud in voice mode. */
  speak?: boolean;
  /** "Hey Atlas" wake phrase while the HUD is open (off by default). */
  wakeWord?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  timezone: string;
  theme: Theme;
  voice: VoiceSettings;
  focus_areas: string[];
  onboarded_at: string | null;
  tour_completed_at: string | null;
  checklist_dismissed_at: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  body: string;
  state: NoteState;
  pinned: boolean;
  tags: string[];
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  details: string;
  done: boolean;
  completed_at: string | null;
  priority: Priority | null;
  tags: string[];
  due_date: string | null;
  due_time: string | null;
  estimate_min: number | null;
  top_date: string | null;
  sched_date: string | null;
  sched_start: number | null;
  sched_duration: number | null;
  goal_id: string | null;
  milestone_id: string | null;
  parent_id: string | null;
  source_note_id: string | null;
  sort: number;
  created_at: string;
}

export interface Goal {
  id: string;
  title: string;
  emoji: string;
  target: number;
  current: number;
  unit: string;
  due_date: string | null;
  source_note_id: string | null;
  completed_at: string | null;
  sort: number;
  created_at: string;
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  done: boolean;
  sort: number;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  goal_id: string | null;
  source_note_id: string | null;
  archived_at: string | null;
  sort: number;
  created_at: string;
}

export interface HabitLog {
  habit_id: string;
  day: string;
}

export interface Mood {
  day: string;
  score: number;
  note: string;
}

export interface FocusSession {
  id: string;
  task_id: string | null;
  started_at: string;
  minutes: number;
}

export interface CalendarGroup {
  id: string;
  name: string;
  color: number;
  sort: number;
}

export interface CalendarLink {
  id: string;
  name: string;
  url: string;
  emoji: string;
  color: number;
  group_id: string | null;
  pinned: boolean;
  sync: boolean;
  sort: number;
  created_at: string;
}

export type CalendarType = 'google' | 'outlook' | 'apple' | 'notion' | 'calendly' | 'ics' | 'other';

export interface AtlasAction {
  tool: string;
  summary: string;
  ok: boolean;
  /** Set when Atlas drafted a plan in this reply — shown as a plan card. */
  plan_id?: string;
}

export type PlanStatus = 'draft' | 'active' | 'paused' | 'dismissed';

export interface Plan {
  id: string;
  title: string;
  summary: string;
  request: string;
  weeks: number;
  start_date: string | null;
  sessions: PlanSession[];
  status: PlanStatus;
  habit_id: string | null;
  goal_id: string | null;
  added_at: string | null;
  paused_at: string | null;
  created_at: string;
}

export interface AtlasMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  actions: AtlasAction[];
  created_at: string;
}
