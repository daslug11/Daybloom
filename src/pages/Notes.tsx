import { AnimatePresence, motion } from 'framer-motion';
import { Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useNotes } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { tagsFor, TAGS, FALLBACK_TAG } from '../lib/tags';
import type { Note } from '../lib/types';
import { cn, uid } from '../lib/utils';

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Notes() {
  const [notes, setNotes] = useNotes();
  const toast = useToast();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const preview = text.trim() ? tagsFor(text) : [];

  const add = () => {
    if (!text.trim()) return;
    setNotes((all) => [{ id: uid(), text: text.trim(), createdAt: new Date().toISOString() }, ...all]);
    setText('');
  };

  const remove = (note: Note) => {
    const index = notes.findIndex((n) => n.id === note.id);
    setNotes((all) => all.filter((n) => n.id !== note.id));
    toast('Note deleted', { label: 'Undo', onClick: () => setNotes((all) => [...all.slice(0, index), note, ...all.slice(index)]) });
  };

  const tagged = useMemo(() => notes.map((n) => ({ note: n, tags: tagsFor(n.text) })), [notes]);
  const visible = filter ? tagged.filter((t) => t.tags.some((x) => x.label === filter)) : tagged;
  const usedTags = [...TAGS, FALLBACK_TAG].filter((t) => tagged.some((n) => n.tags.includes(t)));

  return (
    <div>
      <PageHeader title="Brain Dump" subtitle="Get it out of your head. We'll tag it automagically. 🪄" />

      <Card className="mb-6" hover={false}>
        <textarea
          className="input min-h-[90px] resize-none border-none bg-transparent text-base dark:bg-transparent"
          placeholder="Buy coffee beans, call Sam, idea for a startup… (⌘/Ctrl + Enter to save)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-h-[26px] flex-wrap gap-1.5">
            {preview.map((t) => (
              <span key={t.label} className={cn('chip', t.className)}>
                {t.emoji} {t.label}
              </span>
            ))}
          </div>
          <button className="btn-primary" onClick={add} disabled={!text.trim()}>
            <Send size={16} /> Capture
          </button>
        </div>
      </Card>

      {usedTags.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button className={filter === null ? 'chip-on' : 'chip-off'} onClick={() => setFilter(null)}>✨ All</button>
          {usedTags.map((t) => (
            <button key={t.label} className={filter === t.label ? 'chip-on' : 'chip-off'} onClick={() => setFilter(filter === t.label ? null : t.label)}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <Card>
          <EmptyState emoji="💭" hint="Dump a thought above — tags like 🛒 Shopping and 📞 People appear on their own." />
        </Card>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
          <AnimatePresence>
            {visible.map(({ note, tags }, i) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className="glass glass-hover group mb-4 break-inside-avoid p-4"
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.text}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => (
                    <span key={t.label} className={cn('chip', t.className)}>
                      {t.emoji} {t.label}
                    </span>
                  ))}
                  <span className="muted ml-auto text-[11px]">{timeAgo(note.createdAt)}</span>
                  <button className="icon-btn h-7 w-7 opacity-100 hover:!text-rose-400 md:opacity-0 md:group-hover:opacity-100" onClick={() => remove(note)} aria-label="Delete note">
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
