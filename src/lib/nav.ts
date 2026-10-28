import {
  BarChart3,
  Brain,
  CalendarClock,
  CalendarDays,
  Flame,
  LayoutDashboard,
  ListChecks,
  Smile,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** What the page is for (used by the tour and the palette). */
  blurb: string;
  /** Shown in the mobile tab bar (others live under "More"). */
  primary?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, primary: true, blurb: "Today at a glance: schedule, top tasks, habits due and your inbox." },
  { to: '/app/brain-dump', label: 'Brain Dump', icon: Brain, primary: true, blurb: 'Capture anything, then process your inbox into tasks, plans and ideas.' },
  { to: '/app/tasks', label: 'Tasks', icon: ListChecks, primary: true, blurb: 'Everything you need to do, by when — with priorities and your top 3 for today.' },
  { to: '/app/planner', label: 'Planner', icon: CalendarClock, primary: true, blurb: 'Drag tasks into time blocks around your calendar events.' },
  { to: '/app/calendars', label: 'Calendars', icon: CalendarDays, blurb: 'Keep your calendar links in one place and sync ICS feeds into the Planner.' },
  { to: '/app/habits', label: 'Habits', icon: Flame, blurb: 'Daily habits with streaks and a 12-week history.' },
  { to: '/app/goals', label: 'Goals', icon: Target, blurb: 'Measurable goals with milestones and linked tasks.' },
  { to: '/app/focus', label: 'Focus', icon: Timer, blurb: 'A Pomodoro timer that logs time against a task.' },
  { to: '/app/mood', label: 'Mood', icon: Smile, blurb: 'A daily check-in and how your week has felt.' },
  { to: '/app/review', label: 'Weekly Review', icon: BarChart3, blurb: 'What you got done this week, with plain stats and an optional AI summary.' },
];
