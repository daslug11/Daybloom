import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

interface Props {
  value: number;
  onChange: (weeks: number) => void;
  min?: number;
  max: number;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

/**
 * A number of weeks. What you type is kept as typed (so clearing the field and typing "3" gives 3,
 * not 13); a whole number in range is used straight away, and anything else is clamped into range
 * when you leave the field.
 */
export function WeeksInput({ value, onChange, min = 1, max, className, disabled, id, ...rest }: Props) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft((d) => (Number(d) === value ? d : String(value))), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  return (
    <input
      id={id}
      className={cn('input', className)}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      disabled={disabled}
      aria-label={rest['aria-label']}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => {
        const n = Number(draft);
        const next = draft.trim() === '' || !Number.isFinite(n) ? value : clamp(n);
        setDraft(String(next));
        if (next !== value) onChange(next);
      }}
    />
  );
}
