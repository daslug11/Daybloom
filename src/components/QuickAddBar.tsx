import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, Sparkles } from 'lucide-react';
import { forwardRef, useMemo, useState } from 'react';
import { useQuickAdd } from '../hooks/useQuickAdd';
import { parseQuickAdd } from '../lib/quickAdd';
import { cn } from '../lib/utils';
import { TaskChips } from './TaskChips';

export function QuickAddPreview({ text }: { text: string }) {
  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="muted text-[11px] font-semibold uppercase tracking-wider">Task</span>
        <span className="truncate font-semibold">{parsed.title || <span className="muted italic">untitled</span>}</span>
      </div>
      <TaskChips due={parsed.due} time={parsed.time} tags={parsed.tags} priority={parsed.priority} duration={parsed.duration} />
      {parsed.due && parsed.time && <p className="muted text-[11px]">🗓️ Will be time-blocked on the Planner.</p>}
    </div>
  );
}

interface Props {
  className?: string;
  autoFocus?: boolean;
  onAdded?: () => void;
  placeholder?: string;
  /** Render the parse preview in the flow (e.g. inside a modal) instead of as a dropdown. */
  inlinePreview?: boolean;
}

/** Natural-language quick add: "gym tomorrow 6pm #health !high". */
export const QuickAddBar = forwardRef<HTMLInputElement, Props>(function QuickAddBar(
  { className, autoFocus, onAdded, inlinePreview, placeholder = 'Quick add… “gym tomorrow 6pm #health !high”' },
  ref,
) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const add = useQuickAdd();
  const open = (focused || inlinePreview) && text.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (add(text)) {
      setText('');
      onAdded?.();
    }
  };

  return (
    <form onSubmit={submit} className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border bg-white/50 px-3 py-2 transition dark:bg-white/5',
          focused
            ? 'border-violet-400/60 shadow-[0_0_30px_-8px_rgba(139,92,246,0.7)]'
            : 'border-slate-900/10 dark:border-white/10',
        )}
      >
        <Sparkles size={16} className="shrink-0 text-violet-400" />
        <input
          ref={ref}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setText('');
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={placeholder}
          aria-label="Quick add a task"
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {text && (
          <kbd className="muted hidden shrink-0 items-center gap-1 rounded-md border border-slate-900/10 px-1.5 py-0.5 text-[10px] sm:flex dark:border-white/10">
            <CornerDownLeft size={10} /> add
          </kbd>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              'z-40 mt-2 rounded-2xl',
              !inlinePreview && 'absolute inset-x-0 top-full',
            )}
          >
            <div className="rounded-2xl border border-slate-900/10 bg-white/95 p-3 shadow-[0_20px_60px_-20px_rgba(139,92,246,0.6)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#14112a]/95"
          >
            <QuickAddPreview text={text} />
            <p className="muted mt-2 border-t border-slate-900/5 pt-2 text-[10px] dark:border-white/5">
              Try: tomorrow · fri 3pm · next week · for 45m · #tag · !high / !med / !low
            </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
});
