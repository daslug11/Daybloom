import { useState } from 'react';
import { MoodChart } from '../../components/mood/MoodChart';
import { MoodPicker } from '../../components/mood/MoodPicker';
import { AiButton } from '../../components/ui/Ai';
import { Card, CardTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/States';
import { useMoods, useSetMood } from '../../hooks/data/moods';
import { useUserId } from '../../hooks/useAuth';
import { useAi, useAiStatus } from '../../hooks/useAi';
import { useToday } from '../../hooks/useProfile';
import { addDays, parseKey } from '../../lib/dates';
import { MOODS } from '../../lib/moods';
import { useSavedResult } from '../../lib/savedResult';
import { meanScore } from '../../lib/stats';

const moodFor = (score: number) => MOODS.find((m) => m.value === score) ?? { value: score, emoji: '❔', label: `Score ${score}` };

/** Reflect reads the last 14 days and needs at least 3 check-ins in them (the server checks the same). */
const REFLECT_DAYS = 14;
const REFLECT_MIN = 3;

interface Reflection {
  reflection: string;
  suggestion: string;
  /** True when the answer came from the saved copy and used no action. */
  cached: boolean;
}

export default function Mood() {
  const { today } = useToday();
  const uid = useUserId();
  const moods = useMoods(today);
  const setMood = useSetMood();
  const reflect = useAi<{ reflection: string; suggestion: string }>('reflect');
  const { data: ai } = useAiStatus();
  const [reflection, setReflection] = useSavedResult<Reflection>(['reflect', uid, today]);
  const list = moods.data ?? [];
  const todayMood = list.find((m) => m.day === today);
  const [note, setNote] = useState<string | null>(null);
  const week = list.filter((m) => m.day > addDays(today, -7));
  const avg = meanScore(week.map((m) => m.score));
  const recent = [...list].reverse().slice(0, 14);
  const reflectable = list.filter((m) => m.day > addDays(today, -REFLECT_DAYS)).length;

  return (
    <div>
      <PageHeader title="Mood" description="A ten-second daily check-in. Over time it shows how your weeks feel — and ✨ Reflect can point out what seems to help." />
      <QueryState isLoading={moods.isLoading} error={moods.error} onRetry={() => moods.refetch()} />
      {moods.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>{todayMood ? `Today: ${moodFor(todayMood.score).emoji} ${moodFor(todayMood.score).label}` : 'How are you feeling today?'}</CardTitle>
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
              {avg !== null ? (
                <>
                  Average <strong className="text-ink">{avg.toFixed(1)} / 5</strong> from {week.length} check-in{week.length === 1 ? '' : 's'}.
                </>
              ) : (
                'No check-ins in the last 7 days yet.'
              )}
            </p>
            <p className="muted mt-1 text-xs">Mean of your check-ins in the last 7 days (1 = Rough, 5 = Amazing). Days you skipped are gaps, not zeros.</p>
          </Card>
          <Card className="lg:col-span-2">
            <CardTitle
              action={
                <AiButton
                  size="sm"
                  loading={reflect.isPending}
                  disabled={reflectable < REFLECT_MIN}
                  onClick={() => reflect.mutate({}, { onSuccess: (r) => setReflection({ ...r.result, cached: r.cached }) })}
                  hint="Notice trends in your last two weeks"
                >
                  {reflection ? 'Reflect again' : 'Reflect'}
                </AiButton>
              }
            >
              Patterns
            </CardTitle>
            {ai?.enabled && reflectable >= REFLECT_MIN && (
              <p className="muted -mt-2 mb-3 text-xs">Uses 1 of your {ai.remaining} ✨ actions left today — free if your check-ins haven’t changed since the last reflection.</p>
            )}
            <div aria-live="polite">
              {reflection ? (
                <div className="space-y-2 rounded-card border border-atlas/30 bg-atlas/[0.04] p-3 text-sm">
                  <p>{reflection.reflection}</p>
                  <p className="rounded-control bg-ink/[0.06] p-3">💡 {reflection.suggestion}</p>
                  <p className="muted text-xs">
                    {reflection.cached ? 'Saved reflection — no action used.' : 'Used 1 ✨ action.'} Not medical advice. If you’re struggling, please talk to someone you trust or a professional.
                  </p>
                </div>
              ) : (
                <p className="muted text-sm">
                  {reflectable < REFLECT_MIN
                    ? `After ${REFLECT_MIN} check-ins in the last two weeks (you have ${reflectable}), ✨ Reflect can look at them with your habits and point out patterns.`
                    : '✨ Reflect looks at your last two weeks of check-ins and habits and points out patterns.'}
                </p>
              )}
            </div>
          </Card>
          {recent.length > 0 && (
            <Card className="lg:col-span-2">
              <CardTitle>Recent check-ins</CardTitle>
              <ul className="divide-y divide-line text-sm">
                {recent.map((m) => {
                  const mood = moodFor(m.score);
                  return (
                    <li key={m.day} className="flex items-start gap-3 py-2">
                      <span className="muted w-28 shrink-0 text-xs leading-5">{parseKey(m.day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="min-w-0">
                        <span className="font-medium">
                          <span aria-hidden>{mood.emoji}</span> {mood.label}
                        </span>
                        {m.note && <span className="muted block">{m.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
