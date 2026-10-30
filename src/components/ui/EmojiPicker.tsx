import { useId } from 'react';
import { cn } from '../../lib/utils';

/**
 * A row of emoji buttons; the chosen one is exposed with aria-pressed, not just the ring.
 * With `label` it renders its own visible label; without one, the group is named "Emoji"
 * (callers already show an "Emoji" label above it).
 */
export function EmojiPicker({ options, value, onChange, label }: { options: string[]; value: string; onChange: (e: string) => void; label?: string }) {
  const id = useId();
  return (
    <div>
      {label && (
        <span id={id} className="label">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={label ? id : undefined} aria-label={label ? undefined : 'Emoji'}>
        {options.map((e) => (
          <button
            type="button"
            key={e}
            onClick={() => onChange(e)}
            aria-pressed={value === e}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-control text-lg transition-colors duration-fast hover:bg-raised',
              value === e ? 'bg-raised ring-2 ring-ink' : 'border border-line hover:border-line-strong',
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
