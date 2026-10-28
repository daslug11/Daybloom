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
            'flex h-9 w-9 items-center justify-center rounded-xl text-lg transition hover:scale-110',
            value === e ? 'bg-violet-500/25 ring-2 ring-violet-400' : 'bg-slate-900/5 dark:bg-white/5',
          )}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
