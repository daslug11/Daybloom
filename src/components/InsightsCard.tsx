import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useGoals, useHabits, useMoods, useTasks } from '../hooks/useData';
import { generateInsights } from '../lib/insights';
import { cn } from '../lib/utils';
import { Card, CardTitle } from './Card';

export function InsightsCard({ delay = 0, className }: { delay?: number; className?: string }) {
  const [tasks] = useTasks();
  const [habits] = useHabits();
  const [moods] = useMoods();
  const [goals] = useGoals();
  const insights = useMemo(() => generateInsights(tasks, habits, moods, goals).slice(0, 4), [tasks, habits, moods, goals]);

  return (
    <Card delay={delay} className={cn('overflow-hidden', className)}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <CardTitle
        icon={<Sparkles size={16} className="text-fuchsia-400" />}
        action={<span className="rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Beta</span>}
      >
        <span className="gradient-text">✨ AI Insights</span>
      </CardTitle>
      <ul className="space-y-2.5">
        {insights.map((i, idx) => (
          <motion.li
            key={i.text}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.15 + idx * 0.08 }}
            className="flex gap-2.5 text-sm leading-snug"
          >
            <span className="text-base">{i.emoji}</span>
            <span>{i.text}</span>
          </motion.li>
        ))}
      </ul>
      <p className="muted mt-4 text-[10px]">Generated locally from your data. 100% organic, 0% neural network.</p>
    </Card>
  );
}
