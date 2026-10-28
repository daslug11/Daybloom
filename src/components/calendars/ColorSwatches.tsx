import { Check } from 'lucide-react';
import { CALENDAR_COLORS, gradient } from '../../lib/calendars';
import { cn } from '../../lib/utils';

export function ColorSwatches({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CALENDAR_COLORS.map((c, i) => (
        <button
          key={c.name}
          type="button"
          title={c.name}
          aria-label={c.name}
          aria-pressed={value === i}
          onClick={() => onChange(i)}
          style={{ background: gradient(i) }}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:scale-110',
            value === i && 'ring-2 ring-white/80 ring-offset-2 ring-offset-violet-500/40 dark:ring-offset-[#12101f]',
          )}
        >
          {value === i && <Check size={16} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
