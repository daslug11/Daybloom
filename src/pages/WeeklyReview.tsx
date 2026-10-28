import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Card, CardTitle } from '../components/Card';
import { InsightsCard } from '../components/InsightsCard';
import { PageHeader } from '../components/PageHeader';
import { useFocusSessions, useHabits, useMoods, useSettings, useTasks } from '../hooks/useData';
import { daysAgo } from '../lib/dates';
import { weeklyStats } from '../lib/insights';
import { moodEmoji } from '../lib/moods';

function verdict(score: number) {
  if (score >= 85) return 'Absolute unit. 🦄 10x energy.';
  if (score >= 70) return 'Crushing it. 🚀 Keep the momentum.';
  if (score >= 50) return 'Solid week. 💪 Room to level up.';
  if (score >= 30) return 'Warming up. 🌱 Small wins count.';
  return 'Rest is productive too. 🛌 Fresh start Monday.';
}

export default function WeeklyReview() {
  const [tasks] = useTasks();
  const [habits] = useHabits();
  const [moods] = useMoods();
  const [sessions] = useFocusSessions();
  const [settings] = useSettings();
  const dark = settings.theme === 'dark';
  const stats = useMemo(() => weeklyStats(tasks, habits, moods, sessions), [tasks, habits, moods, sessions]);
  const delta = stats.tasksDone - stats.tasksDonePrev;
  const range = `${daysAgo(6).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  const tiles = [
    { label: 'Tasks done', value: stats.tasksDone, suffix: '', sub: delta === 0 ? 'Same as last week' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} vs last week`, emoji: '✅' },
    { label: 'Habit consistency', value: stats.habitConsistency, suffix: '%', sub: `${habits.length} habits tracked`, emoji: '🔥' },
    { label: 'Average mood', value: stats.avgMood ?? 0, suffix: '/5', decimals: 1, sub: stats.avgMood ? moodEmoji(stats.avgMood) : 'No check-ins yet', emoji: '😊' },
    { label: 'Focus sessions', value: stats.focusSessions, suffix: '', sub: `${stats.focusSessions * settings.pomodoro.work} min of deep work`, emoji: '🧠' },
  ];

  return (
    <div>
      <PageHeader title="Weekly Review" subtitle={`${range} · Reflect, celebrate, adjust. 🪞`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center overflow-hidden py-10 text-center lg:row-span-2">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/20 via-blue-600/10 to-pink-600/20" />
          <p className="muted relative text-xs font-semibold uppercase tracking-[0.2em]">Productivity Score</p>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 120, delay: 0.2 }}
            className="relative my-4"
          >
            <AnimatedNumber value={stats.score} className="gradient-text animate-shimmer text-[7rem] font-black leading-none tracking-tighter drop-shadow-[0_0_40px_rgba(139,92,246,0.5)] sm:text-[9rem]" />
          </motion.div>
          <p className="relative text-lg font-semibold">{verdict(stats.score)}</p>
          <p className="muted relative mt-2 max-w-xs text-xs">40% tasks · 30% habits · 15% mood · 15% focus. Peer-reviewed by nobody.</p>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          {tiles.map((t, i) => (
            <Card key={t.label} delay={0.1 + i * 0.06}>
              <div className="text-2xl">{t.emoji}</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight">
                <AnimatedNumber value={t.value} decimals={t.decimals ?? 0} />
                <span className="muted text-lg">{t.suffix}</span>
              </div>
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="muted mt-0.5 text-xs">{t.sub}</div>
            </Card>
          ))}
        </div>

        <Card delay={0.35} className="lg:col-span-2">
          <CardTitle>📊 Your week, day by day</CardTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.perDay} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="barTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <linearGradient id="barHabits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: dark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: dark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
                  contentStyle={{ background: dark ? '#14112a' : '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="tasks" name="Tasks done" fill="url(#barTasks)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="habits" name="Habits done" fill="url(#barHabits)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <InsightsCard delay={0.4} className="lg:col-span-3" />
      </div>
    </div>
  );
}
