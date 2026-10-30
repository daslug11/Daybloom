import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Tasks and habits done per day (Weekly Review). Its own chunk, so the page doesn't wait for the chart library. */
export default function ReviewChart({ data }: { data: { day: string; key: string; Tasks: number; Habits: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} accessibilityLayer={false}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgb(var(--ink) / 0.05)' }} contentStyle={{ background: 'rgb(var(--overlay))', border: '1px solid rgb(var(--line-strong))', borderRadius: 10, fontSize: 12, color: 'rgb(var(--ink))' }} />
        <Bar dataKey="Tasks" name="Tasks done" fill="rgb(var(--ink))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="Habits" name="Habits done" fill="rgb(var(--faint))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
