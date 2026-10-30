import { cn } from '../../lib/utils';

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-[color,background-color,border-color,opacity] duration-fast disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-raised ring-1 ring-inset ring-control/70',
      )}
    >
      <span className={cn('absolute left-0.5 top-0.5 h-4 w-4 rounded-full shadow transition-transform duration-fast ease-out', checked ? 'translate-x-4 bg-accent-ink' : 'bg-muted')} />
    </button>
  );
}
