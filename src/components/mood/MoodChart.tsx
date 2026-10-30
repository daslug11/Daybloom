import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, parseKey } from '../../lib/dates';
import { moodEmoji, MOODS } from '../../lib/moods';
import type { Mood } from '../../lib/types';

const moodLabel = (v: number) => MOODS.find((m) => m.value === v)?.label ?? '';

/**
 * Mood over the last `days` days on the 1–5 scale. Straight segments join only consecutive
 * check-ins; a skipped day is a gap, never an invented in-between value.
 */
export function MoodChart({ moods, today, days = 7, height = 160 }: { moods: Mood[]; today: string; days?: number; height?: number }) {
  const byDay = new Map(moods.map((m) => [m.day, m.score]));
  const data = Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i - days + 1);
    return { day: d === today ? 'Today' : parseKey(d).toLocaleDateString(undefined, { weekday: 'short' }), mood: byDay.get(d) ?? null };
  });
  const logged = data.filter((d) => d.mood != null);
  const summary = logged.length ? data.map((d) => `${d.day} ${d.mood != null ? `${moodLabel(d.mood)} (${d.mood})` : 'no check-in'}`).join(', ') : 'no check-ins yet';
  return (
    <div style={{ height }} role="img" aria-label={`Mood over the last ${days} days, from 1 = Rough to 5 = Amazing: ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: -24 }} accessibilityLayer={false}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} interval={days > 10 ? 2 : 0} padding={{ left: 8, right: 8 }} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={(v) => moodEmoji(v)} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'rgb(var(--overlay))', border: '1px solid rgb(var(--line-strong))', borderRadius: 10, fontSize: 12, color: 'rgb(var(--ink))' }}
            formatter={(v) => [`${moodEmoji(Number(v))} ${moodLabel(Number(v))} (${Number(v)}/5)`, 'Mood']}
          />
          <Line type="linear" dataKey="mood" stroke="rgb(var(--ink))" strokeWidth={2} dot={{ r: 4, fill: 'rgb(var(--ink))', strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
