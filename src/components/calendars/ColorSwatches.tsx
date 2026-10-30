import { Check } from 'lucide-react';
import { CALENDAR_COLORS } from '../../lib/calendars';
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
          style={{ background: c.hex }}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-overlay transition-shadow duration-fast hover:ring-2 hover:ring-line-strong',
            value === i && '!ring-2 !ring-ink',
          )}
        >
          {value === i && <Check size={16} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
