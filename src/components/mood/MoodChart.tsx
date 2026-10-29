import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, parseKey } from '../../lib/dates';
import { moodEmoji, MOODS } from '../../lib/moods';
import type { Mood } from '../../lib/types';

/** Mood over the last `days` days (gaps where you didn't check in). */
export function MoodChart({ moods, today, days = 7, height = 160 }: { moods: Mood[]; today: string; days?: number; height?: number }) {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const byDay = new Map(moods.map((m) => [m.day, m.score]));
  const data = Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i - days + 1);
    return { day: d === today ? 'Today' : parseKey(d).toLocaleDateString(undefined, { weekday: 'short' }), mood: byDay.get(d) ?? null };
  });
  const logged = data.filter((d) => d.mood != null);
  return (
    <div style={{ height }} role="img" aria-label={`Mood over the last ${days} days: ${logged.length ? logged.map((d) => `${d.day} ${MOODS[d.mood! - 1].label}`).join(', ') : 'no check-ins yet'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: dark ? '#94a3b8' : '#475569' }} axisLine={false} tickLine={false} interval={days > 10 ? 2 : 0} />
          <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tickFormatter={(v) => moodEmoji(v)} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: dark ? '#14112a' : '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, fontSize: 12 }}
            formatter={(v) => [`${moodEmoji(Number(v))} ${MOODS[Number(v) - 1]?.label ?? ''}`, 'Mood']}
          />
          <Line type="monotone" dataKey="mood" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
