import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Card, CardTitle } from '../components/Card';
import { ContributionGrid, GridLegend } from '../components/ContributionGrid';
import { EmojiPicker } from '../components/EmojiPicker';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { useHabits } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { celebrate, originFromEvent } from '../lib/confetti';
import { dateKey, streak } from '../lib/dates';
import type { Habit } from '../lib/types';
import { cn, uid } from '../lib/utils';

const HABIT_EMOJIS = ['💧', '🏋️', '📖', '🧘', '🏃', '🥗', '😴', '✍️', '🎸', '🧹', '💊', '🌿', '📵', '🧠', '🙏', '💜'];

export default function Habits() {
  const [habits, setHabits] = useHabits();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(HABIT_EMOJIS[0]);
  const today = dateKey();

  const toggle = (id: string, key: string, e?: React.MouseEvent) => {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const has = habit.completions.includes(key);
    if (!has && key === today && e) celebrate(originFromEvent(e));
    setHabits((all) =>
      all.map((h) =>
        h.id === id
          ? { ...h, completions: has ? h.completions.filter((c) => c !== key) : [...h.completions, key] }
          : h,
      ),
    );
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setHabits((all) => [...all, { id: uid(), name: name.trim(), emoji, completions: [], createdAt: new Date().toISOString() }]);
    setName('');
    setAdding(false);
    toast(`${emoji} Habit added — you got this!`);
  };

  const remove = (habit: Habit) => {
    const index = habits.findIndex((h) => h.id === habit.id);
    setHabits((all) => all.filter((h) => h.id !== habit.id));
    toast('Habit deleted', { label: 'Undo', onClick: () => setHabits((all) => [...all.slice(0, index), habit, ...all.slice(index)]) });
  };

  const counts = new Map<string, number>();
  habits.forEach((h) => h.completions.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)));

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle="Tiny wins, compounded daily. Click any square to toggle a day. 🌱"
        action={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> New habit
          </button>
        }
      />

      {habits.length > 0 && (
        <Card className="mb-4">
          <CardTitle action={<GridLegend />}>📊 All habits · last 12 weeks</CardTitle>
          <ContributionGrid
            cell="h-4 w-4 sm:h-5 sm:w-5"
            level={(k) => (counts.get(k) ?? 0) / habits.length}
            label={(k) => `${counts.get(k) ?? 0}/${habits.length} habits`}
          />
        </Card>
      )}

      {habits.length === 0 ? (
        <Card>
          <EmptyState emoji="🌱" hint="Add your first habit to start growing your streak." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnimatePresence>
            {habits.map((h, i) => {
              const s = streak(h.completions);
              const doneToday = h.completions.includes(today);
              return (
                <motion.div key={h.id} layout exit={{ opacity: 0, scale: 0.95 }}>
                  <Card delay={i * 0.06} className="group h-full">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/20 text-2xl">{h.emoji}</div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{h.name}</h3>
                        <p className="muted text-xs">{h.completions.length} check-ins total</p>
                      </div>
                      <div className={cn('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold', s > 0 ? 'bg-orange-500/15 text-orange-500 dark:text-orange-300' : 'muted bg-slate-900/5 dark:bg-white/5')}>
                        🔥 {s}
                      </div>
                      <button className="icon-btn opacity-100 hover:!text-rose-400 md:opacity-0 md:group-hover:opacity-100" onClick={() => remove(h)} aria-label="Delete habit">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <ContributionGrid
                      level={(k) => (h.completions.includes(k) ? 0.75 : 0)}
                      label={(k) => (h.completions.includes(k) ? 'done ✅' : 'missed')}
                      onToggle={(k) => toggle(h.id, k)}
                    />
                    <button
                      onClick={(e) => toggle(h.id, today, e)}
                      className={cn('mt-4 w-full', doneToday ? 'btn-ghost' : 'btn-primary')}
                    >
                      {doneToday ? <><Check size={16} /> Done today — nice! </> : 'Mark today as done'}
                    </button>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New habit 🌱">
        <form onSubmit={add} className="space-y-5">
          <div>
            <label className="label" htmlFor="habit-name">Habit</label>
            <input id="habit-name" autoFocus className="input" placeholder="e.g. Walk 10k steps" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <span className="label">Emoji</span>
            <EmojiPicker options={HABIT_EMOJIS} value={emoji} onChange={setEmoji} />
          </div>
          <button className="btn-primary w-full" disabled={!name.trim()}>Add habit {emoji}</button>
        </form>
      </Modal>
    </div>
  );
}
