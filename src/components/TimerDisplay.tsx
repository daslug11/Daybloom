import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { formatTime, useTimer } from '../hooks/useTimer';
import { cn } from '../lib/utils';
import { ProgressRing } from './ProgressRing';

export function TimerDisplay({ size = 280 }: { size?: number }) {
  const t = useTimer();
  const progress = t.total ? 1 - t.remaining / t.total : 0;
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex rounded-full border border-slate-900/10 bg-white/50 p-1 dark:border-white/10 dark:bg-white/5">
        {(['work', 'rest'] as const).map((m) => (
          <button
            key={m}
            onClick={() => t.setMode(m)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition',
              t.mode === m ? 'bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-lg' : 'muted',
            )}
          >
            {m === 'work' ? '🧠 Focus' : '☕ Break'}
          </button>
        ))}
      </div>
      <ProgressRing progress={progress} size={size}>
        <div className="font-mono text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">{formatTime(t.remaining)}</div>
        <div className="muted mt-2 text-sm">{t.running ? (t.mode === 'work' ? 'Locked in 🔒' : 'Recharging 🔋') : 'Ready when you are'}</div>
      </ProgressRing>
      <div className="flex items-center gap-3">
        <button className="icon-btn h-12 w-12" onClick={t.reset} aria-label="Reset timer">
          <RotateCcw size={20} />
        </button>
        <button
          onClick={t.running ? t.pause : t.start}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-indigo-500 to-blue-500 text-white shadow-[0_0_40px_-4px_rgba(139,92,246,0.8)] transition hover:scale-105 active:scale-95"
          aria-label={t.running ? 'Pause' : 'Start'}
        >
          {t.running ? <Pause size={26} /> : <Play size={26} className="ml-1" />}
        </button>
        <button className="icon-btn h-12 w-12" onClick={t.skip} aria-label="Skip to next">
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  );
}
