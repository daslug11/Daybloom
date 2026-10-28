import { motion } from 'framer-motion';
import { Smile } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMoods, useSettings } from '../hooks/useData';
import { dateKey, daysAgo } from '../lib/dates';
import { moodEmoji, MOODS } from '../lib/moods';
import { cn } from '../lib/utils';
import { Card, CardTitle } from './Card';

export function MoodCheckin({ delay = 0, className }: { delay?: number; className?: string }) {
  const [moods, setMoods] = useMoods();
  const [settings] = useSettings();
  const today = dateKey();
  const current = moods[today];
  const dark = settings.theme === 'dark';

  const data = Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i);
    return { day: i === 6 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' }), mood: moods[dateKey(d)] ?? null };
  });

  return (
    <Card delay={delay} className={className}>
      <CardTitle icon={<Smile size={16} className="text-pink-400" />}>
        {current ? `Today you feel ${MOODS[current - 1].label.toLowerCase()} ${MOODS[current - 1].emoji}` : 'How are you feeling today?'}
      </CardTitle>
      <div className="flex justify-between gap-1">
        {MOODS.map((m) => (
          <motion.button
            key={m.value}
            whileHover={{ scale: 1.15, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setMoods((all) => ({ ...all, [today]: m.value }))}
            title={m.label}
            aria-label={m.label}
            aria-pressed={current === m.value}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-2xl text-2xl transition sm:h-12 sm:w-12',
              current === m.value
                ? 'bg-gradient-to-br from-violet-500/40 to-pink-500/30 ring-2 ring-violet-400 shadow-[0_0_20px_-2px_rgba(167,139,250,0.7)]'
                : current
                  ? 'opacity-40 grayscale-[40%] hover:opacity-100'
                  : 'bg-slate-900/5 dark:bg-white/5',
            )}
          >
            {m.emoji}
          </motion.button>
        ))}
      </div>
      <p className="muted mt-2 text-center text-[11px]">One check-in per day — tap again to change it.</p>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="moodLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'} vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: dark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tickFormatter={(v) => moodEmoji(v)} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: dark ? '#14112a' : '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, fontSize: 12 }}
              formatter={(v) => [`${moodEmoji(Number(v))} ${MOODS[Number(v) - 1]?.label ?? ''}`, 'Mood']}
            />
            <Line type="monotone" dataKey="mood" stroke="url(#moodLine)" strokeWidth={3} dot={{ r: 4, fill: '#a855f7', strokeWidth: 0 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
