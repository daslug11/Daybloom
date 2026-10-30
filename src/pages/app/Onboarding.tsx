import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/layout/Logo';
import { Card } from '../../components/ui/Card';
import { EmojiPicker } from '../../components/ui/EmojiPicker';
import { useAddHabits } from '../../hooks/data/habits';
import { useAddNote, useDeleteNote, useUpdateNote } from '../../hooks/data/notes';
import { useAddTasks, useDeleteTask } from '../../hooks/data/tasks';
import { useAuth } from '../../hooks/useAuth';
import { useProfile, useToday, useUpdateProfile } from '../../hooks/useProfile';
import { parseQuickAdd, taskFromParsed } from '../../lib/quickAdd';
import { cn } from '../../lib/utils';
import { useDocumentTitle } from '../public/useDocumentTitle';

const AREAS = ['Work', 'Study', 'Health', 'Fitness', 'Side project', 'Family', 'Money', 'Home', 'Creativity', 'Reading', 'Mindfulness', 'Social life'];
const HABIT_EMOJIS = ['💧', '🏃', '📚', '🧘', '🥗', '😴', '✍️', '🎸', '🌱', '🚶'];
const STEPS = ['About you', 'Brain dump', 'First task', 'First habit'] as const;
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** What each step has already saved, so going Back and Continuing again edits it instead of adding a copy. */
interface Saved {
  note?: { id: string; body: string };
  task?: { id: string; text: string };
  habit?: string;
}

/** First-run setup: a few small steps that each create something real. Every step after the first can be skipped. */
export default function Onboarding() {
  useDocumentTitle('Welcome · Daybloom');
  const { data: profile } = useProfile();
  const { signOut } = useAuth();
  const update = useUpdateProfile();
  const addNote = useAddNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const addTasks = useAddTasks();
  const deleteTask = useDeleteTask();
  const addHabits = useAddHabits();
  const navigate = useNavigate();
  const { today } = useToday();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name ?? '');
  const [areas, setAreas] = useState<string[]>(profile?.focus_areas ?? []);
  const [dump, setDump] = useState('');
  const [task, setTask] = useState('');
  const [habit, setHabit] = useState('');
  const [emoji, setEmoji] = useState('💧');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saved = useRef<Saved>({});

  /** Runs one step's writes; on failure keeps the typed text and shows an inline error. */
  const attempt = async (work: () => Promise<void>, message: string) => {
    setSaving(true);
    setError('');
    try {
      await work();
      return true;
    } catch {
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveNote = async () => {
    const body = dump.trim();
    const prev = saved.current.note;
    if (prev?.body === body) return;
    if (prev && !body) {
      await deleteNote.mutateAsync(prev.id);
      saved.current.note = undefined;
    } else if (prev) {
      await updateNote.mutateAsync({ id: prev.id, patch: { body } });
      saved.current.note = { id: prev.id, body };
    } else if (body) {
      const n = await addNote.mutateAsync({ body });
      saved.current.note = { id: n.id, body };
    }
  };

  const saveTask = async () => {
    const text = task.trim();
    const prev = saved.current.task;
    if (prev?.text === text) return;
    // Re-parse from scratch when the text changed: the date, priority and tags may all be different.
    if (prev) {
      await deleteTask.mutateAsync(prev.id);
      saved.current.task = undefined;
    }
    if (!text) return;
    // Same parsing as the quick-add bar; an undated first task becomes one of today's top 3.
    const t = taskFromParsed(parseQuickAdd(text), text);
    const [created] = await addTasks.mutateAsync([{ ...t, top_date: t.due_date ? null : today }]);
    saved.current.task = { id: created.id, text };
  };

  const finish = async (withHabit = true) => {
    const ok = await attempt(async () => {
      if (withHabit && habit.trim() && !saved.current.habit) {
        await addHabits.mutateAsync([{ name: habit.trim().slice(0, 80), emoji }]);
        saved.current.habit = habit.trim();
      }
      await update.mutateAsync({ name: name.trim().slice(0, 60), focus_areas: areas, timezone: tz(), onboarded_at: new Date().toISOString() });
    }, 'Couldn’t finish setting up. Check your connection and try again — nothing you typed is lost.');
    if (ok) navigate('/app?tour=1', { replace: true });
  };

  const next = async () => {
    if (step === 0) {
      if (!name.trim()) return;
      if (!(await attempt(() => update.mutateAsync({ name: name.trim().slice(0, 60), focus_areas: areas }).then(() => undefined), 'Couldn’t save your name. Check your connection and try again.'))) return;
    }
    if (step === 1 && !(await attempt(saveNote, 'Couldn’t save your note. Check your connection and try again — your text is still here.'))) return;
    if (step === 2 && !(await attempt(saveTask, 'Couldn’t save your task. Check your connection and try again — your text is still here.'))) return;
    if (step === 3) return finish();
    setStep(step + 1);
  };

  const go = (to: number) => {
    setError('');
    setStep(to);
  };

  const skipAll = async () => {
    const ok = await attempt(
      () =>
        update
          .mutateAsync({ name: (name.trim() || profile?.name || '').slice(0, 60), focus_areas: areas, timezone: tz(), onboarded_at: new Date().toISOString() })
          .then(() => undefined),
      'Couldn’t skip setup. Check your connection and try again.',
    );
    if (ok) navigate('/app', { replace: true });
  };

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <Logo />
      </div>
      <ol className="mb-6 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <span className={cn('h-1.5 rounded-full', i <= step ? 'bg-accent' : 'bg-line ')} aria-hidden />
            <span className={cn('text-xs font-medium', i === step ? '' : 'faint')} aria-current={i === step ? 'step' : undefined}>
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
                placeholder={'e.g. ask about the essay extension, idea for Sam’s birthday, fix my bike light, want to read more'}
                aria-label="Your first brain dump"
                aria-describedby={error ? 'onboarding-error' : undefined}
              />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl font-bold">One thing to get done</h1>
              <p className="muted mt-1 text-sm">Add a task you want to finish soon. You can type dates naturally — “submit essay friday 3pm”. Without a date, it becomes one of today’s top 3.</p>
              <input
                autoFocus
                className="input mt-4"
                maxLength={300}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g. Finish the lab report tomorrow"
                aria-label="Your first task"
                aria-describedby={error ? 'onboarding-error' : undefined}
              />
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-xl font-bold">A small daily habit</h1>
              <p className="muted mt-1 text-sm">Pick something tiny you’d like to do every day. Tick it off on the dashboard to build a streak.</p>
              <input
                autoFocus
                className="input mt-4"
                maxLength={80}
                value={habit}
                onChange={(e) => setHabit(e.target.value)}
                placeholder="e.g. Drink a glass of water"
                aria-label="Your first habit"
                aria-describedby={error ? 'onboarding-error' : undefined}
              />
              <div className="mt-4">
                <EmojiPicker options={HABIT_EMOJIS} value={emoji} onChange={setEmoji} label="Habit icon" />
              </div>
            </>
          )}

          {error && (
            <p id="onboarding-error" role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center gap-2">
            {step > 0 && (
              <button type="button" className="btn-ghost" onClick={() => go(step - 1)} disabled={saving}>
                <ArrowLeft size={15} /> Back
              </button>
            )}
            {step === 0 ? (
              <button type="button" className="link ml-1 text-sm" onClick={skipAll} disabled={saving}>
                Skip setup
              </button>
            ) : (
              <button type="button" className="link ml-1 text-sm" onClick={() => (step === 3 ? finish(false) : go(step + 1))} disabled={saving}>
                Skip this step
              </button>
            )}
            <button className="btn-primary ml-auto" disabled={saving || (step === 0 && !name.trim())}>
              {saving ? (step === 3 ? 'Setting up…' : 'Saving…') : step === 3 ? 'Finish' : 'Continue'} <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </Card>
      <p className="mt-6 text-center text-sm">
        <button type="button" className="muted hover:underline" onClick={() => void signOut().then(() => navigate('/'))}>
          Not you? Log out
        </button>
      </p>
    </main>
  );
}
