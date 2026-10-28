import { Loader2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAiStatus } from '../../hooks/useAi';
import { cn } from '../../lib/utils';

/** "✨ 14 left today" — or why AI is unavailable. */
export function AiAllowance({ className }: { className?: string }) {
  const { data, isLoading } = useAiStatus();
  if (isLoading || !data) return null;
  const text = data.enabled ? `✨ ${data.remaining} left today` : data.paused ? 'AI is resting until tomorrow 🌙' : '✨ AI off';
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium',
        data.enabled && data.remaining > 0
          ? 'border-violet-400/40 bg-violet-500/10 text-violet-700 dark:text-violet-200'
          : 'border-slate-900/10 bg-slate-900/5 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400',
        className,
      )}
      title={data.enabled ? `You can use ✨ AI actions ${data.remaining} more times today (resets at midnight UTC).` : data.message}
    >
      {text}
    </span>
  );
}

interface AiButtonProps {
  onClick: () => void;
  loading?: boolean;
  children: ReactNode;
  className?: string;
  /** Short hint for screen readers / tooltips. */
  hint?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

/** A ✨ action. Uses one AI request from the daily allowance when pressed. */
export function AiButton({ onClick, loading, children, className, hint, size = 'md', disabled }: AiButtonProps) {
  const { data } = useAiStatus();
  const unavailable = data ? !data.enabled || data.remaining <= 0 : false;
  const title = unavailable ? (data?.message ?? "You've used today's AI allowance.") : `${hint ? hint + ' · ' : ''}Uses 1 of your ${data?.remaining ?? ''} AI actions left today`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || unavailable || disabled}
      title={title}
      className={cn('btn-ai', size === 'sm' && '!px-2.5 !py-1.5 !text-xs', className)}
    >
      {loading ? <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" aria-hidden /> : <Sparkles size={size === 'sm' ? 13 : 15} aria-hidden />}
      {children}
    </button>
  );
}
