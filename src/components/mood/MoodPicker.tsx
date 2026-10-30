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
            'flex flex-col items-center gap-1 rounded-2xl transition-colors duration-fast',
            size === 'md' ? 'px-2 py-2 text-3xl' : 'px-1.5 py-1.5 text-2xl',
            value === m.value ? 'bg-ink/10 ring-2 ring-ink/40' : value ? 'opacity-50 hover:opacity-100' : 'hover:bg-raised ',
          )}
        >
          <span aria-hidden>{m.emoji}</span>
          {size === 'md' && <span className="muted text-xs font-medium">{m.label}</span>}
        </button>
      ))}
    </div>
  );
}
