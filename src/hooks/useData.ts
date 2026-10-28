import { DEFAULT_SETTINGS } from '../lib/seed';
import { KEYS } from '../lib/storage';
import type {
  CalendarGroup,
  CalendarLink,
  Goal,
  Habit,
  MoodLog,
  Note,
  Settings,
  Task,
} from '../lib/types';
import { useLocalStorage } from './useLocalStorage';

export const useSettings = () => useLocalStorage<Settings>(KEYS.settings, DEFAULT_SETTINGS);
export const useTasks = () => useLocalStorage<Task[]>(KEYS.tasks, []);
export const useFocusIds = () => useLocalStorage<string[]>(KEYS.focus, []);
export const useHabits = () => useLocalStorage<Habit[]>(KEYS.habits, []);
export const useMoods = () => useLocalStorage<MoodLog>(KEYS.moods, {});
export const useGoals = () => useLocalStorage<Goal[]>(KEYS.goals, []);
export const useNotes = () => useLocalStorage<Note[]>(KEYS.notes, []);
export const useCalendars = () => useLocalStorage<CalendarLink[]>(KEYS.calendars, []);
export const useCalendarGroups = () => useLocalStorage<CalendarGroup[]>(KEYS.calendarGroups, []);
/** Completed focus sessions per local date. */
export const useFocusSessions = () => useLocalStorage<Record<string, number>>(KEYS.sessions, {});
