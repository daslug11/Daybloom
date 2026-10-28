import {
  BarChart3,
  CalendarDays,
  Flame,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { PageId } from './types';

export const NAV: { id: PageId; label: string; short: string; icon: LucideIcon; emoji: string }[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, emoji: '🏠' },
  { id: 'tasks', label: 'Tasks', short: 'Tasks', icon: ListChecks, emoji: '✅' },
  { id: 'habits', label: 'Habits', short: 'Habits', icon: Flame, emoji: '🔥' },
  { id: 'focus', label: 'Focus', short: 'Focus', icon: Timer, emoji: '🧠' },
  { id: 'goals', label: 'Goals', short: 'Goals', icon: Target, emoji: '🎯' },
  { id: 'notes', label: 'Notes', short: 'Notes', icon: NotebookPen, emoji: '📝' },
  { id: 'calendars', label: 'Calendars', short: 'Cals', icon: CalendarDays, emoji: '📅' },
  { id: 'review', label: 'Weekly Review', short: 'Review', icon: BarChart3, emoji: '📊' },
];
