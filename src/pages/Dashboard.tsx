import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Flame, ListChecks, NotebookPen, Target, Timer } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { CalendarsCard } from '../components/CalendarsCard';
import { Card } from '../components/Card';
import { InsightsCard } from '../components/InsightsCard';
import { MoodCheckin } from '../components/MoodCheckin';
import { NextUpCard } from '../components/NextUpCard';
import { TodaysFocus } from '../components/TodaysFocus';
import { useApp } from '../hooks/useApp';
import { useNow } from '../hooks/useNow';
import { useFocusSessions, useGoals, useHabits, useNotes, useSettings, useTasks } from '../hooks/useData';
import { formatTime, useTimer } from '../hooks/useTimer';
import { dateKey, greeting, streak } from '../lib/dates';
import { QUOTES } from '../lib/quotes';
import type { PageId } from '../lib/types';

function Hero() {
  const [settings] = useSettings();
  const now = useNow();
  const g = greeting(now);
  const [quoteIdx, setQuoteIdx] = useState(() => now.getDate() % QUOTES.length);

  useEffect(() => {
    const id = window.setInterval(() => setQuoteIdx((i) => (i + 1) % QUOTES.length), 9000);
    return () => window.clearInterval(id);
  }, []);
  const quote = QUOTES[quoteIdx];

  return (
    <Card className="overflow-hidden md:col-span-2 lg:col-span-2" delay={0}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/40 to-blue-500/30 blur-3xl" />
      <p className="muted text-sm font-medium">
        {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
        <span className="gradient-text animate-shimmer">
          {g.text}, {settings.name || 'friend'}
        </span>{' '}
        {g.emoji}
      </h1>
      <div className="relative mt-5 min-h-[64px]">
        <AnimatePresence mode="wait">
          <motion.blockquote
            key={quoteIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="border-l-2 border-violet-400/60 pl-4"
          >
            <p className="text-base italic text-slate-700 dark:text-slate-200">“{quote.text}”</p>
            <footer className="muted mt-1 text-xs">— {quote.author}</footer>
          </motion.blockquote>
        </AnimatePresence>
      </div>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  to,
  delay,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub: string;
  to: PageId;
  delay: number;
  accent: string;
}) {
  const { navigate } = useApp();
  return (
    <Card delay={delay} className="group cursor-pointer !p-0">
      <button onClick={() => navigate(to)} className="flex h-full w-full flex-col p-5 text-left">
        <div className="flex items-center justify-between">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>{icon}</span>
          <ArrowRight size={16} className="muted -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
        </div>
        <div className="mt-4 text-3xl font-extrabold tracking-tight">{value}</div>
        <div className="mt-0.5 text-sm font-semibold">{label}</div>
        <div className="muted mt-1 text-xs">{sub}</div>
      </button>
    </Card>
  );
}

export default function Dashboard() {
  const [tasks] = useTasks();
  const [habits] = useHabits();
  const [goals] = useGoals();
  const [notes] = useNotes();
  const [sessions] = useFocusSessions();
  const timer = useTimer();
  const today = dateKey();

  const open = tasks.filter((t) => t.status !== 'done').length;
  const doneToday = tasks.filter((t) => t.completedAt && dateKey(new Date(t.completedAt)) === today).length;
  const habitsToday = habits.filter((h) => h.completions.includes(today)).length;
  const bestStreak = Math.max(0, ...habits.map((h) => streak(h.completions)));
  const avgGoal = goals.length
    ? Math.round(goals.reduce((s, g) => s + Math.min(g.current / g.target, 1), 0) / goals.length * 100)
    : 0;

  return (
    <div className="grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Hero />
      <InsightsCard delay={0.05} className="md:col-span-2 lg:col-span-2 lg:row-span-2" />
      <TodaysFocus delay={0.1} className="md:col-span-2 lg:col-span-2" />
      <NextUpCard delay={0.12} className="md:col-span-2 lg:col-span-2" />

      <Stat delay={0.15} to="tasks" icon={<ListChecks size={18} className="text-violet-500 dark:text-violet-300" />} accent="bg-violet-500/20" label="Open tasks" value={open} sub={`${doneToday} done today ✅`} />
      <Stat delay={0.2} to="habits" icon={<Flame size={18} className="text-orange-500 dark:text-orange-300" />} accent="bg-orange-500/20" label="Habits today" value={`${habitsToday}/${habits.length}`} sub={`Best streak: ${bestStreak} days 🔥`} />
      <Stat delay={0.25} to="focus" icon={<Timer size={18} className="text-sky-500 dark:text-sky-300" />} accent="bg-sky-500/20" label={timer.running ? 'Timer running' : 'Focus sessions'} value={timer.running ? formatTime(timer.remaining) : sessions[today] ?? 0} sub={timer.running ? 'Stay locked in 🧠' : 'Pomodoros completed today'} />
      <Stat delay={0.3} to="goals" icon={<Target size={18} className="text-emerald-500 dark:text-emerald-300" />} accent="bg-emerald-500/20" label="Goal progress" value={`${avgGoal}%`} sub={`Across ${goals.length} goals 🎯`} />

      <MoodCheckin delay={0.35} className="md:col-span-2 lg:col-span-2" />
      <CalendarsCard delay={0.4} className="md:col-span-1 lg:col-span-1" />
      <Stat delay={0.45} to="notes" icon={<NotebookPen size={18} className="text-pink-500 dark:text-pink-300" />} accent="bg-pink-500/20" label="Brain dump" value={notes.length} sub={notes[0] ? `Latest: ${notes[0].text.slice(0, 32)}…` : 'Capture a thought 💭'} />
    </div>
  );
}
