import { MOODS } from '../../lib/moods';
import { cn } from '../../lib/utils';

/** Five-emoji daily check-in. */
export function MoodPicker({ value, onPick, size = 'md' }: { value?: number; onPick?: (v: number) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex justify-between gap-1" role="radiogroup" aria-label="How are you feeling today?">
      {MOODS.map((m) => (
        <button
          key={m.value}
          role="radio"
          aria-checked={value === m.value}
          aria-label={m.label}
          title={m.label}
          onClick={() => onPick?.(m.value)}
          className={cn(
            'flex flex-col items-center gap-1 rounded-2xl transition',
            size === 'md' ? 'px-2 py-2 text-3xl' : 'px-1.5 py-1.5 text-2xl',
            value === m.value ? 'bg-violet-500/20 ring-2 ring-violet-500' : value ? 'opacity-50 hover:opacity-100' : 'hover:bg-slate-900/5 dark:hover:bg-white/5',
          )}
        >
          <span aria-hidden>{m.emoji}</span>
          {size === 'md' && <span className="muted text-[11px] font-medium">{m.label}</span>}
        </button>
      ))}
    </div>
  );
}
