import { dateKey, daysAgo, parseKey, streak, WEEKDAYS } from './dates';
import type { Goal, Habit, MoodLog, Task } from './types';

export interface WeeklyStats {
  tasksDone: number;
  tasksDonePrev: number;
  habitConsistency: number; // 0–100
  avgMood: number | null; // 1–5
  focusSessions: number;
  score: number; // 0–100
  perDay: { day: string; tasks: number; habits: number; mood: number | null }[];
}

function lastNDays(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => dateKey(daysAgo(n - 1 - i + offset)));
}

export function weeklyStats(
  tasks: Task[],
  habits: Habit[],
  moods: MoodLog,
  sessions: Record<string, number>,
): WeeklyStats {
  const week = lastNDays(7);
  const prevWeek = lastNDays(7, 7);
  const doneOn = (days: string[]) =>
    tasks.filter((t) => t.completedAt && days.includes(dateKey(new Date(t.completedAt)))).length;

  const tasksDone = doneOn(week);
  const tasksDonePrev = doneOn(prevWeek);

  const possible = habits.length * 7;
  const hits = habits.reduce((sum, h) => sum + week.filter((d) => h.completions.includes(d)).length, 0);
  const habitConsistency = possible ? Math.round((hits / possible) * 100) : 0;

  const moodValues = week.map((d) => moods[d]).filter((v): v is number => typeof v === 'number');
  const avgMood = moodValues.length ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length : null;

  const focusSessions = week.reduce((s, d) => s + (sessions[d] ?? 0), 0);

  // Vibes-based scoring formula. Very scientific. 🧪
  const taskPart = Math.min(tasksDone / 10, 1) * 40;
  const habitPart = (habitConsistency / 100) * 30;
  const moodPart = avgMood ? ((avgMood - 1) / 4) * 15 : 7.5;
  const focusPart = Math.min(focusSessions / 8, 1) * 15;
  const score = Math.round(taskPart + habitPart + moodPart + focusPart);

  const perDay = week.map((d) => {
    const date = parseKey(d);
    return {
      day: date.toLocaleDateString(undefined, { weekday: 'short' }),
      tasks: doneOn([d]),
      habits: habits.filter((h) => h.completions.includes(d)).length,
      mood: moods[d] ?? null,
    };
  });

  return { tasksDone, tasksDonePrev, habitConsistency, avgMood, focusSessions, score, perDay };
}

export interface Insight {
  emoji: string;
  text: string;
}

/** "AI" insights. Actually a handful of if-statements wearing a trench coat. 🕵️ */
export function generateInsights(
  tasks: Task[],
  habits: Habit[],
  moods: MoodLog,
  goals: Goal[],
): Insight[] {
  const out: Insight[] = [];

  const byWeekday = new Array(7).fill(0);
  tasks.forEach((t) => t.completedAt && byWeekday[new Date(t.completedAt).getDay()]++);
  const best = byWeekday.indexOf(Math.max(...byWeekday));
  if (byWeekday[best] > 0) {
    out.push({ emoji: '📈', text: `You're most productive on ${WEEKDAYS[best]}s! Schedule your hardest work then.` });
  }

  const streaks = habits.map((h) => ({ h, s: streak(h.completions) })).sort((a, b) => b.s - a.s);
  if (streaks[0]?.s >= 3) {
    out.push({ emoji: '🔥', text: `${streaks[0].h.emoji} ${streaks[0].h.name} is on a ${streaks[0].s}-day streak. Don't break the chain!` });
  }
  const weakest = habits
    .map((h) => ({ h, n: lastNDays(14).filter((d) => h.completions.includes(d)).length }))
    .sort((a, b) => a.n - b.n)[0];
  if (weakest && weakest.n < 8) {
    out.push({ emoji: '🌱', text: `${weakest.h.emoji} ${weakest.h.name} could use some love — only ${weakest.n}/14 days lately.` });
  }

  const recent = lastNDays(3).map((d) => moods[d]).filter(Boolean) as number[];
  const earlier = lastNDays(4, 3).map((d) => moods[d]).filter(Boolean) as number[];
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  if (recent.length && earlier.length) {
    const diff = avg(recent) - avg(earlier);
    if (diff > 0.3) out.push({ emoji: '😊', text: 'Your mood is trending up this week. Whatever you are doing — keep doing it!' });
    else if (diff < -0.3) out.push({ emoji: '🫶', text: 'Mood dipped a bit lately. Maybe block some time for a walk or a nap?' });
    else out.push({ emoji: '⚖️', text: 'Your mood has been nice and steady. Consistency looks good on you.' });
  }

  const closest = goals
    .filter((g) => g.current < g.target)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];
  if (closest) {
    const pct = Math.round((closest.current / closest.target) * 100);
    out.push({ emoji: '🎯', text: `${closest.emoji} "${closest.title} ${closest.target} ${closest.unit}" is ${pct}% done — you're closer than you think!` });
  }

  const open = tasks.filter((t) => t.status !== 'done').length;
  if (open > 8) out.push({ emoji: '🧹', text: `${open} open tasks. Consider archiving the ones you'll never do (we won't tell).` });

  if (!out.length) out.push({ emoji: '✨', text: 'Add some tasks, habits and moods — insights will bloom as your data grows.' });
  return out;
}
