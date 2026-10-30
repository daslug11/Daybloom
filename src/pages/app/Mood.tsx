import { Check } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import type { Mood as MoodRow } from '../../lib/types';

// The chart library is large; load it after the rest of the page.
const MoodChart = lazy(() => import('../../components/mood/MoodChart').then((m) => ({ default: m.MoodChart })));

const moodFor = (score: number) => MOODS.find((m) => m.value === score) ?? { value: score, emoji: '❔', label: `Score ${score}` };

/** Reflect reads the last 14 days and needs at least 3 check-ins in them (the server checks the same). */
const REFLECT_DAYS = 14;
const REFLECT_MIN = 3;

/** How long typing has to pause before the note saves. */
const NOTE_SAVE_MS = 800;

/**
 * Today's note. Saves after a short pause in typing, on blur, when you leave the page
 * (pagehide) and when the page unmounts, and says so: "Saving…" then "Saved".
 */
function MoodNote({
  todayMood,
  note,
  setNote,
  save,
}: {
  todayMood?: MoodRow;
  note: string | null;
  setNote: (n: string) => void;
  save: (m: MoodRow, done: (ok: boolean) => void) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef(0);
  // Read by the timer and the pagehide/unmount flush, which run outside a render.
  const live = useRef({ note, todayMood, save });
  live.current = { note, todayMood, save };
  const lastSaved = useRef<string | null>(null);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const { note: n, todayMood: m, save: doSave } = live.current;
    if (!m || n === null || n === m.note || n === lastSaved.current) return;
    lastSaved.current = n;
    setStatus('saving');
    doSave({ ...m, note: n }, (ok) => {
      if (!ok) lastSaved.current = null;
      // A newer edit may already be waiting; only report on the latest text.
      if (live.current.note === n) setStatus(ok ? 'saved' : 'error');
    });
  }, []);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  const value = note ?? todayMood?.note ?? '';
  const statusText = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Couldn’t save your note. Keep typing to try again.' : '';

  return (
    <>
      <label className="mt-4 block">
        <span className="label">A word about today (optional)</span>
        <textarea
          rows={2}
          maxLength={1000}
          className="input resize-none"
          placeholder={todayMood ? 'What made today feel this way?' : 'Pick a mood first'}
          disabled={!todayMood}
          value={value}
          aria-describedby="mood-note-hint"
          onChange={(e) => {
            setNote(e.target.value);
            lastSaved.current = null;
            setStatus('idle');
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(flush, NOTE_SAVE_MS);
          }}
          onBlur={flush}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <p id="mood-note-hint" className="faint">
          One check-in per day — tap again to change it.{todayMood ? ' Your note saves as you type.' : ''}
        </p>
        {/* Always in the DOM so the change is announced; empty while idle. */}
        <span role="status" className={`inline-flex items-center gap-1 font-medium ${status === 'error' ? 'text-danger' : status === 'saved' ? 'text-success' : 'faint'}`}>
          {status === 'saved' && <Check size={12} strokeWidth={3} aria-hidden />}
          {statusText}
        </span>
      </div>
    </>
  );
}

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
            <MoodPicker
              value={todayMood?.score}
              onPick={(score) => {
                // Keep whatever note is on screen (it may not have saved yet).
                setMood.mutate({ day: today, score, note: note ?? todayMood?.note ?? '' });
              }}
            />
            <MoodNote key={today} todayMood={todayMood} note={note} setNote={setNote} save={(m, done) => setMood.mutate(m, { onSuccess: () => done(true), onError: () => done(false) })} />
          </Card>
          <Card>
            <CardTitle>Last 7 days</CardTitle>
            <Suspense fallback={<div className="h-40" aria-hidden />}>
              <MoodChart moods={list} today={today} />
            </Suspense>
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
