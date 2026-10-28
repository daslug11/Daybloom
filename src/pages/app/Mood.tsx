import { useState } from 'react';
import { MoodChart } from '../../components/mood/MoodChart';
import { MoodPicker } from '../../components/mood/MoodPicker';
import { AiButton } from '../../components/ui/Ai';
import { Card, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/States';
import { useMoods, useSetMood } from '../../hooks/data/moods';
import { useAi } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { addDays, parseKey } from '../../lib/dates';
import { MOODS } from '../../lib/moods';

export default function Mood() {
  const { today } = useToday();
  const moods = useMoods(today);
  const setMood = useSetMood();
  const reflect = useAi<{ reflection: string; suggestion: string }>('reflect');
  const [reflection, setReflection] = useState<{ reflection: string; suggestion: string } | null>(null);
  const list = moods.data ?? [];
  const todayMood = list.find((m) => m.day === today);
  const [note, setNote] = useState<string | null>(null);
  const week = list.filter((m) => m.day > addDays(today, -7));
  const avg = week.length ? week.reduce((s, m) => s + m.score, 0) / week.length : null;
  const recent = [...list].reverse().slice(0, 14);

  return (
    <div>
      <PageHeader title="Mood" description="A ten-second daily check-in. Over time it shows how your weeks feel — and ✨ Reflect can point out what seems to help." />
      <QueryState isLoading={moods.isLoading} error={moods.error} onRetry={() => moods.refetch()} />
      {moods.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>{todayMood ? `Today: ${MOODS[todayMood.score - 1].emoji} ${MOODS[todayMood.score - 1].label}` : 'How are you feeling today?'}</CardTitle>
            <MoodPicker value={todayMood?.score} onPick={(score) => setMood.mutate({ day: today, score, note: todayMood?.note ?? '' })} />
            <label className="mt-4 block">
              <span className="label">A word about today (optional)</span>
              <textarea
                rows={2}
                maxLength={1000}
                className="input resize-none"
                placeholder={todayMood ? 'What made today feel this way?' : 'Pick a mood first'}
                disabled={!todayMood}
                value={note ?? todayMood?.note ?? ''}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if (todayMood && note !== null && note !== todayMood.note) setMood.mutate({ ...todayMood, note });
                  setNote(null);
                }}
              />
            </label>
            <p className="faint mt-2 text-xs">One check-in per day — tap again to change it.</p>
          </Card>
          <Card>
            <CardTitle>Last 7 days</CardTitle>
            <MoodChart moods={list} today={today} />
            <p className="muted mt-2 text-sm">
              {avg ? (
                <>
                  Average <strong>{avg.toFixed(1)} / 5</strong> from {week.length} check-in{week.length === 1 ? '' : 's'}.
                </>
              ) : (
                'No check-ins this week yet.'
              )}
            </p>
          </Card>
          <Card className="lg:col-span-2">
            <CardTitle
              action={
                <AiButton size="sm" loading={reflect.isPending} disabled={list.length < 3} onClick={() => reflect.mutate({}, { onSuccess: (r) => setReflection(r.result) })} hint="Notice trends in your last two weeks">
                  Reflect
                </AiButton>
              }
            >
              Reflect
            </CardTitle>
            {reflection ? (
              <div className="space-y-2 text-sm">
                <p>{reflection.reflection}</p>
                <p className="rounded-xl bg-violet-500/10 p-3">💡 {reflection.suggestion}</p>
                <p className="faint text-xs">Not medical advice. If you’re struggling, please talk to someone you trust or a professional.</p>
              </div>
            ) : (
              <p className="muted text-sm">
                {list.length < 3 ? 'After 3 check-ins, ✨ Reflect can look at your last two weeks (with your habits) and point out patterns.' : '✨ Reflect looks at your last two weeks of check-ins and habits and points out patterns.'}
              </p>
            )}
            {recent.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-900/5 text-sm dark:divide-white/5">
                {recent.map((m) => (
                  <li key={m.day} className="flex items-start gap-3 py-2">
                    <span aria-hidden>{MOODS[m.score - 1].emoji}</span>
                    <span className="faint w-24 shrink-0 text-xs leading-5">{parseKey(m.day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="muted">{m.note || MOODS[m.score - 1].label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
