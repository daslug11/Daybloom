import { cn } from '../../lib/utils';

export function EmojiPicker({ options, value, onChange }: { options: string[]; value: string; onChange: (e: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((e) => (
        <button
          type="button"
          key={e}
          onClick={() => onChange(e)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-control text-lg transition-colors duration-fast hover:bg-raised',
            value === e ? 'bg-raised ring-2 ring-ink' : 'border border-line hover:border-line-strong',
          )}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
