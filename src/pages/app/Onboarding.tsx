import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EmojiPicker } from '../../components/ui/EmojiPicker';
import { useAddHabits } from '../../hooks/data/habits';
import { useAddNote } from '../../hooks/data/notes';
import { useAddTasks } from '../../hooks/data/tasks';
import { useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { cn } from '../../lib/utils';

const AREAS = ['Work', 'Study', 'Health', 'Fitness', 'Side project', 'Family', 'Money', 'Home', 'Creativity', 'Reading', 'Mindfulness', 'Social life'];
const HABIT_EMOJIS = ['💧', '🏃', '📚', '🧘', '🥗', '😴', '✍️', '🎸', '🌱', '🚶'];
const STEPS = ['About you', 'Brain dump', 'First task', 'First habit'] as const;

/** First-run setup: a few small steps that each create something real. Every step after the first can be skipped. */
export default function Onboarding() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const addNote = useAddNote();
  const addTasks = useAddTasks();
  const addHabits = useAddHabits();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name ?? '');
  const [areas, setAreas] = useState<string[]>(profile?.focus_areas ?? []);
  const [dump, setDump] = useState('');
  const [task, setTask] = useState('');
  const [habit, setHabit] = useState('');
  const [emoji, setEmoji] = useState('💧');
  const [saving, setSaving] = useState(false);

  const finish = async (withHabit = true) => {
    setSaving(true);
    try {
      if (withHabit && habit.trim()) await addHabits.mutateAsync([{ name: habit.trim().slice(0, 80), emoji }]);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await update.mutateAsync({ name: name.trim().slice(0, 60), focus_areas: areas, timezone: tz, onboarded_at: new Date().toISOString() });
      navigate('/app?tour=1', { replace: true });
    } catch {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === 0) {
      if (!name.trim()) return;
      update.mutate({ name: name.trim().slice(0, 60), focus_areas: areas });
    }
    if (step === 1 && dump.trim()) addNote.mutate({ body: dump });
    if (step === 2 && task.trim()) addTasks.mutate([{ title: task.trim().slice(0, 300) }]);
    if (step === 3) return finish();
    setStep(step + 1);
  };

  const skipAll = async () => {
    setSaving(true);
    try {
      await update.mutateAsync({ name: (name.trim() || profile?.name || '').slice(0, 60), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', onboarded_at: new Date().toISOString() });
      navigate('/app', { replace: true });
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-4">
      <ol className="mb-6 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <span className={cn('h-1.5 rounded-full', i <= step ? 'bg-violet-600' : 'bg-slate-900/10 dark:bg-white/10')} aria-hidden />
            <span className={cn('text-[11px] font-medium', i === step ? '' : 'faint')} aria-current={i === step ? 'step' : undefined}>
              {s}
            </span>
          </li>
        ))}
      </ol>

      <Card className="!p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void next();
          }}
        >
          {step === 0 && (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight">Welcome to Daybloom 🌸</h1>
              <p className="muted mt-1 text-sm">Two quick questions, then we’ll set up your first note, task and habit. Takes about a minute.</p>
              <label className="mt-5 block">
                <span className="label">What should we call you?</span>
                <input autoFocus required className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" />
              </label>
              <fieldset className="mt-5">
                <legend className="label">What do you want to organise? (optional)</legend>
                <div className="flex flex-wrap gap-2">
                  {AREAS.map((a) => {
                    const on = areas.includes(a);
                    return (
                      <button type="button" key={a} className={on ? 'chip-on' : 'chip-off'} aria-pressed={on} onClick={() => setAreas(on ? areas.filter((x) => x !== a) : [...areas, a])}>
                        {on && <Check size={12} />} {a}
                      </button>
                    );
                  })}
                </div>
                <p className="faint mt-2 text-xs">Atlas uses these to tailor suggestions. Change them any time in Settings.</p>
              </fieldset>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-xl font-bold">Empty your head</h1>
              <p className="muted mt-1 text-sm">
                The Brain Dump is where anything goes — ideas, worries, things to do. Write whatever’s on your mind; you’ll sort it later (or let ✨ AI do it). Later, press <kbd className="kbd">N</kbd> anywhere to capture.
              </p>
              <textarea
                autoFocus
                className="input mt-4 min-h-[140px]"
                maxLength={10000}
                value={dump}
                onChange={(e) => setDump(e.target.value)}
                placeholder={'e.g. call the dentist, idea for a birthday gift for Sam, need to sort out the car insurance, want to read more'}
                aria-label="Your first brain dump"
              />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl font-bold">One thing to get done</h1>
              <p className="muted mt-1 text-sm">Add a task you want to finish soon. You can type dates naturally — “submit report friday 3pm”.</p>
              <input autoFocus className="input mt-4" maxLength={300} value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Book a dentist appointment tomorrow" aria-label="Your first task" />
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-xl font-bold">A small daily habit</h1>
              <p className="muted mt-1 text-sm">Pick something tiny you’d like to do every day. Tick it off on the dashboard to build a streak.</p>
              <input autoFocus className="input mt-4" maxLength={80} value={habit} onChange={(e) => setHabit(e.target.value)} placeholder="e.g. Drink a glass of water" aria-label="Your first habit" />
              <div className="mt-3">
                <EmojiPicker options={HABIT_EMOJIS} value={emoji} onChange={setEmoji} />
              </div>
            </>
          )}

          <div className="mt-6 flex items-center gap-2">
            {step > 0 && (
              <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={15} /> Back
              </button>
            )}
            {step === 0 ? (
              <button type="button" className="link ml-1 text-sm" onClick={skipAll} disabled={saving}>
                Skip setup
              </button>
            ) : (
              <button type="button" className="link ml-1 text-sm" onClick={() => (step === 3 ? finish(false) : setStep(step + 1))} disabled={saving}>
                Skip this step
              </button>
            )}
            <button className="btn-primary ml-auto" disabled={saving || (step === 0 && !name.trim())}>
              {step === 3 ? (saving ? 'Setting up…' : 'Finish') : 'Continue'} <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
