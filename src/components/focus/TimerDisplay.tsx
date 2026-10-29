import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { formatClock, useTimer } from '../../hooks/useTimer';
import { cn } from '../../lib/utils';
import { ProgressRing } from '../ui/ProgressRing';

export interface TimerViewProps {
  mode: 'work' | 'rest';
  remaining: number;
  total: number;
  running: boolean;
  taskTitle?: string | null;
  size?: number;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onSkip?: () => void;
  onMode?: (m: 'work' | 'rest') => void;
}

/** Presentational timer (also used, with static props, on the landing page). */
export function TimerView({ mode, remaining, total, running, taskTitle, size = 260, onStart, onPause, onReset, onSkip, onMode }: TimerViewProps) {
  const progress = total ? 1 - remaining / total : 0;
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex rounded-full border border-slate-900/10 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5" role="tablist" aria-label="Timer mode">
        {(['work', 'rest'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => onMode?.(m)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-semibold transition', mode === m ? 'bg-violet-600 text-white' : 'muted')}
          >
            {m === 'work' ? 'Focus' : 'Break'}
          </button>
        ))}
      </div>
      <ProgressRing progress={progress} size={size}>
        <div className="font-mono text-5xl font-bold tabular-nums tracking-tight" aria-live="off">
          {formatClock(remaining)}
        </div>
        <div className="muted mt-2 max-w-[70%] truncate text-center text-sm">
          {taskTitle ? `On: ${taskTitle}` : running ? (mode === 'work' ? 'Focusing' : 'On a break') : 'Ready'}
        </div>
      </ProgressRing>
      <div className="flex items-center gap-3">
        <button className="icon-btn h-11 w-11" onClick={onReset} aria-label="Reset timer">
          <RotateCcw size={19} />
        </button>
        <button
          onClick={running ? onPause : onStart}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500"
          aria-label={running ? 'Pause timer' : 'Start timer'}
        >
          {running ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
        </button>
        <button className="icon-btn h-11 w-11" onClick={onSkip} aria-label={mode === 'work' ? 'Skip to break' : 'Skip to focus'}>
          <SkipForward size={19} />
        </button>
      </div>
    </div>
  );
}

/** The live, app-wide timer. */
export function TimerDisplay({ size, taskTitle }: { size?: number; taskTitle?: string | null }) {
  const t = useTimer();
  return (
    <TimerView
      mode={t.mode}
      remaining={t.remaining}
      total={t.total}
      running={t.running}
      taskTitle={taskTitle}
      size={size}
      onStart={t.start}
      onPause={t.pause}
      onReset={t.reset}
      onSkip={t.skip}
      onMode={t.setMode}
    />
  );
}
