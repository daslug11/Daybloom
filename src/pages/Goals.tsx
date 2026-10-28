import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../components/Card';
import { EmojiPicker } from '../components/EmojiPicker';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { useGoals } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { celebrate } from '../lib/confetti';
import type { Goal } from '../lib/types';
import { uid } from '../lib/utils';

const GOAL_EMOJIS = ['📚', '🏃', '💰', '🗾', '🚀', '🎸', '🧘', '🏋️', '✍️', '🌱', '🎨', '💻', '🍳', '🧠', '🏆', '❤️'];
const EMPTY = { title: '', emoji: '🎯', target: '10', current: '0', unit: '' };

export default function Goals() {
  const [goals, setGoals] = useGoals();
  const toast = useToast();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);

  const openEditor = (g: Goal | 'new') => {
    setEditing(g);
    setForm(g === 'new' ? EMPTY : { title: g.title, emoji: g.emoji, target: String(g.target), current: String(g.current), unit: g.unit });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const target = Math.max(1, Number(form.target) || 1);
    const current = Math.max(0, Number(form.current) || 0);
    const data = { title: form.title.trim(), emoji: form.emoji, target, current, unit: form.unit.trim() };
    if (editing === 'new') setGoals((all) => [...all, { id: uid(), ...data }]);
    else if (editing) setGoals((all) => all.map((g) => (g.id === editing.id ? { ...g, ...data } : g)));
    setEditing(null);
  };

  const bump = (g: Goal, delta: number) => {
    const next = Math.max(0, g.current + delta);
    if (g.current < g.target && next >= g.target) {
      celebrate();
      toast(`${g.emoji} Goal crushed! You absolute legend. 🏆`);
    }
    setGoals((all) => all.map((x) => (x.id === g.id ? { ...x, current: next } : x)));
  };

  const remove = (goal: Goal) => {
    const index = goals.findIndex((g) => g.id === goal.id);
    setGoals((all) => all.filter((g) => g.id !== goal.id));
    toast('Goal deleted', { label: 'Undo', onClick: () => setGoals((all) => [...all.slice(0, index), goal, ...all.slice(index)]) });
  };

  const step = (g: Goal) => (g.target >= 1000 ? 50 : g.target >= 100 ? 5 : 1);

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Big dreams, measurable progress. 📈"
        action={
          <button className="btn-primary" onClick={() => openEditor('new')}>
            <Plus size={16} /> New goal
          </button>
        }
      />
      {goals.length === 0 ? (
        <Card>
          <EmptyState emoji="🎯" hint="Set a goal with a target number and start tracking." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence>
            {goals.map((g, i) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              return (
                <motion.div key={g.id} layout exit={{ opacity: 0, scale: 0.95 }}>
                  <Card delay={i * 0.06} className="group h-full">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/20 text-2xl">{g.emoji}</div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">
                          {g.title} {g.target.toLocaleString()} {g.unit} {g.emoji} <span className="gradient-text font-extrabold">– {pct}%</span>
                        </h3>
                        <p className="muted text-sm">
                          {g.current.toLocaleString()} / {g.target.toLocaleString()} {g.unit}
                        </p>
                      </div>
                      <div className="flex opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                        <button className="icon-btn" onClick={() => openEditor(g)} aria-label="Edit goal"><Pencil size={15} /></button>
                        <button className="icon-btn hover:!text-rose-400" onClick={() => remove(g)} aria-label="Delete goal"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-pink-500 shadow-[0_0_16px_rgba(139,92,246,0.7)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 + i * 0.06 }}
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="muted text-xs">{pct >= 100 ? 'Completed 🏆' : `${(g.target - g.current).toLocaleString()} ${g.unit} to go`}</span>
                      <div className="flex gap-1">
                        <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => bump(g, -step(g))} aria-label="Decrease"><Minus size={14} /></button>
                        <button className="btn-primary !px-2.5 !py-1.5" onClick={() => bump(g, step(g))} aria-label="Increase"><Plus size={14} /> {step(g)}</button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New goal 🎯' : 'Edit goal ✏️'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label" htmlFor="goal-title">Goal</label>
            <input id="goal-title" autoFocus className="input" placeholder="e.g. Read  →  “Read 24 books 📚”" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label>
              <span className="label">Current</span>
              <input type="number" min={0} className="input" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
            </label>
            <label>
              <span className="label">Target</span>
              <input type="number" min={1} className="input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
            </label>
            <label>
              <span className="label">Unit</span>
              <input className="input" placeholder="books" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
          </div>
          <div>
            <span className="label">Emoji</span>
            <EmojiPicker options={GOAL_EMOJIS} value={form.emoji} onChange={(emoji) => setForm({ ...form, emoji })} />
          </div>
          <p className="muted text-sm">
            Preview: <strong>{form.title || 'Goal'} {form.target} {form.unit} {form.emoji}</strong>
          </p>
          <button className="btn-primary w-full" disabled={!form.title.trim()}>Save goal</button>
        </form>
      </Modal>
    </div>
  );
}
