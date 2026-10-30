import { useRef } from 'react';
import { MOODS } from '../../lib/moods';
import { cn } from '../../lib/utils';

/**
 * Five-emoji daily check-in, as an ARIA radio group: one tab stop (the chosen mood, or the
 * first), arrow keys move and choose, Home/End jump to the ends.
 */
export function MoodPicker({ value, onPick, size = 'md' }: { value?: number; onPick?: (v: number) => void; size?: 'sm' | 'md' }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = MOODS.findIndex((m) => m.value === value);
  const tabIndexAt = checkedIndex >= 0 ? checkedIndex : 0;

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = MOODS.length - 1;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onPick?.(MOODS[next].value);
  };

  return (
    <div className="flex justify-between gap-1" role="radiogroup" aria-label="How are you feeling today?">
      {MOODS.map((m, i) => (
        <button
          key={m.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          tabIndex={i === tabIndexAt ? 0 : -1}
          aria-label={m.label}
          title={m.label}
          onClick={() => onPick?.(m.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
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
