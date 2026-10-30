import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { formatClock, useTimer, type StopAction } from '../../hooks/useTimer';
import { cn } from '../../lib/utils';
import { ProgressRing } from '../ui/ProgressRing';

export interface TimerViewProps {
  mode: 'work' | 'rest';
  remaining: number;
  total: number;
  running: boolean;
  /** A block is underway (running or paused): mode can't be switched. */
  inProgress?: boolean;
  taskTitle?: string | null;
  size?: number;
  /** Asking whether to log the minutes of a focus block that's being stopped early. */
  stopping?: StopAction | null;
  elapsedMin?: number;
  onResolveStop?: (choice: 'log' | 'discard' | 'cancel') => void;
  /** Focus Start/Pause when shown (the full-screen overlay). */
  autoFocusMain?: boolean;
  /** Move focus to the log/discard question when it appears (off for a copy hidden behind the overlay). */
  autoFocusQuestion?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onSkip?: () => void;
  onMode?: (m: 'work' | 'rest') => void;
}

/** Presentational timer (also used, with static props, on the landing page). */
export function TimerView({ mode, remaining, total, running, inProgress = running, taskTitle, size = 260, stopping, elapsedMin = 0, onResolveStop, autoFocusMain, autoFocusQuestion = true, onStart, onPause, onReset, onSkip, onMode }: TimerViewProps) {
  const progress = total ? 1 - remaining / total : 0;
  const paused = inProgress && !running;
  const state = running ? (mode === 'work' ? 'Focusing' : 'On a break') : paused ? 'Paused' : 'Ready';
  const questionId = useId();
  const main = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);
  // When the log/discard question goes away, put focus back on Start/Pause instead of losing it.
  useEffect(() => {
    if (autoFocusQuestion && wasAsking.current && !stopping && (!document.activeElement || document.activeElement === document.body)) main.current?.focus();
    wasAsking.current = !!stopping;
  }, [stopping, autoFocusQuestion]);
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex rounded-full border border-line bg-surface p-1" role="group" aria-label="Timer mode">
        {(['work', 'rest'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={inProgress && mode !== m}
            title={inProgress && mode !== m ? 'Finish, skip or reset the current block first' : undefined}
            onClick={() => onMode?.(m)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-fast disabled:opacity-50', mode === m ? 'bg-accent text-accent-ink' : 'muted')}
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
          {taskTitle ? `On: ${taskTitle}` : state}
        </div>
        {taskTitle && <div className="muted text-xs">{state}</div>}
      </ProgressRing>
      {stopping ? (
        <div role="group" aria-labelledby={questionId} className="flex max-w-xs flex-col items-center gap-3 text-center">
          <p id={questionId} className="text-sm">
            You’ve focused for {elapsedMin} min in this block. {stopping.kind === 'skip' ? 'Log it before skipping?' : 'Log it before resetting?'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => onResolveStop?.('log')} autoFocus={autoFocusQuestion}>
              Log {elapsedMin} min
            </button>
            <button type="button" className="btn-ghost" onClick={() => onResolveStop?.('discard')}>
              Discard
            </button>
            <button type="button" className="btn-ghost" onClick={() => onResolveStop?.('cancel')}>
              Keep going
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button className="icon-btn h-11 w-11" onClick={onReset} aria-label="Reset timer">
            <RotateCcw size={19} />
          </button>
          <button
            ref={main}
            data-autofocus={autoFocusMain || undefined}
            onClick={running ? onPause : onStart}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-button transition-colors duration-fast hover:bg-accent/90"
            aria-label={running ? 'Pause timer' : 'Start timer'}
          >
            {running ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
          </button>
          <button className="icon-btn h-11 w-11" onClick={onSkip} aria-label={mode === 'work' ? 'Skip to break' : 'Skip to focus'}>
            <SkipForward size={19} />
          </button>
        </div>
      )}
    </div>
  );
}

/** The live, app-wide timer. */
export function TimerDisplay({ size, taskTitle, autoFocusMain }: { size?: number; taskTitle?: string | null; autoFocusMain?: boolean }) {
  const t = useTimer();
  return (
    <TimerView
      mode={t.mode}
      remaining={t.remaining}
      total={t.total}
      running={t.running}
      inProgress={t.inProgress}
      taskTitle={taskTitle}
      size={size}
      stopping={t.stopping}
      elapsedMin={Math.round(t.elapsed / 60)}
      onResolveStop={t.resolveStop}
      autoFocusMain={autoFocusMain}
      autoFocusQuestion={autoFocusMain || !t.fullscreen}
      onStart={t.start}
      onPause={t.pause}
      onReset={t.reset}
      onSkip={t.skip}
      onMode={t.setMode}
    />
  );
}
