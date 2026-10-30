import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLogFocus } from './data/focus';
import { useUserId } from './useAuth';
import { useToast } from './useToast';

export type TimerMode = 'work' | 'rest';

/** Something that would end a focus block early; waits for "Log N min" or "Discard". */
export type StopAction = { kind: 'reset' } | { kind: 'skip' };

interface TimerState {
  mode: TimerMode;
  remaining: number; // seconds
  total: number;
  running: boolean;
  /** A block has been started and not yet finished, reset or skipped (running or paused). */
  inProgress: boolean;
  /** Seconds actually spent running in the current focus block. */
  elapsed: number;
  workMin: number;
  restMin: number;
  taskId: string | null;
  fullscreen: boolean;
  /** Set while asking whether to log or discard the minutes of a block that's being stopped early. */
  stopping: StopAction | null;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  skip: () => void;
  /** Answer the "stopping" question. */
  resolveStop: (choice: 'log' | 'discard' | 'cancel') => void;
  setMode: (m: TimerMode) => void;
  setDurations: (work: number, rest: number) => void;
  setTaskId: (id: string | null) => void;
  setFullscreen: (v: boolean) => void;
}

const TimerContext = createContext<TimerState | null>(null);
const PREFS = 'daybloom:pomodoro';
export const WORK_RANGE = { min: 1, max: 180 };
export const REST_RANGE = { min: 1, max: 60 };
/** Stopping a focus block with less than this much time in it doesn't ask; there's nothing worth logging. */
const ASK_AFTER_S = 60;

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}');
    return { work: Number(p.work) || 25, rest: Number(p.rest) || 5 };
  } catch {
    return { work: 25, rest: 5 };
  }
}

/** A block in progress, saved so a reload or a discarded tab picks it up where it was. Per user. */
const stateKey = (uid: string) => `daybloom:timer:${uid}`;
interface SavedBlock {
  v: 1;
  mode: TimerMode;
  running: boolean;
  /** Seconds left when paused. While running, `endAt` is the source of truth. */
  remaining: number;
  endAt: number | null;
  banked: number;
  runFrom: number | null;
  startedAt: string | null;
  taskId: string | null;
}

function loadBlock(uid: string): SavedBlock | null {
  if (!uid) return null;
  try {
    const b = JSON.parse(localStorage.getItem(stateKey(uid)) ?? 'null') as SavedBlock | null;
    if (!b || b.v !== 1 || (b.mode !== 'work' && b.mode !== 'rest') || !Number.isFinite(b.remaining)) return null;
    if (b.running && !Number.isFinite(b.endAt)) return null;
    return b;
  } catch {
    return null;
  }
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside <TimerProvider>');
  return ctx;
}

const toMinutes = (seconds: number) => Math.round(seconds / 60);

/**
 * App-wide Pomodoro: keeps ticking while you move between pages. Focus minutes are the time
 * the timer actually ran — logged when a block finishes, when you stop early and choose
 * "Log", or (split) when you switch task mid-block — linked to the task chosen at the time.
 */
export function TimerProvider({ children }: { children: ReactNode }) {
  const uid = useUserId();
  // A block saved by an earlier page load (read once).
  const [saved] = useState(() => loadBlock(uid));
  const [{ work, rest }, setPrefs] = useState(loadPrefs);
  const [mode, setModeState] = useState<TimerMode>(saved?.mode ?? 'work');
  const [running, setRunning] = useState(!!saved?.running);
  const [taskId, setTaskIdState] = useState<string | null>(saved?.taskId ?? null);
  const [fullscreen, setFullscreen] = useState(false);
  const [stopping, setStopping] = useState<StopAction | null>(null);
  const [started, setStarted] = useState(!!saved);
  const total = (mode === 'work' ? work : rest) * 60;
  const [remaining, setRemaining] = useState(() => (saved ? (saved.running && saved.endAt ? Math.max(0, Math.round((saved.endAt - Date.now()) / 1000)) : saved.remaining) : total));
  const endAt = useRef<number | null>(saved?.running ? saved.endAt : null);
  // Real running time in the current focus block: banked on pause, plus the live run.
  const banked = useRef(saved?.banked ?? 0);
  const runFrom = useRef<number | null>(saved?.running ? saved.runFrom : null);
  const startedAt = useRef<string | null>(saved?.startedAt ?? null);
  const logFocus = useLogFocus();
  const toast = useToast();
  const inProgress = running || started;

  // A run never counts past the block's end (e.g. the tab was closed and the block ended meanwhile).
  const elapsedMs = () => banked.current + (runFrom.current !== null ? Math.max(0, Math.min(Date.now(), endAt.current ?? Infinity) - runFrom.current) : 0);

  // Save the block in progress (on every start, pause, mode or task change; not every tick).
  const pausedRemaining = running ? -1 : remaining;
  useEffect(() => {
    if (!uid) return;
    try {
      if (!started && !running) return localStorage.removeItem(stateKey(uid));
      const block: SavedBlock = { v: 1, mode, running, remaining, endAt: endAt.current, banked: banked.current, runFrom: runFrom.current, startedAt: startedAt.current, taskId };
      localStorage.setItem(stateKey(uid), JSON.stringify(block));
    } catch {
      /* private mode: the timer still works, it just won't survive a reload */
    }
  }, [uid, mode, running, started, taskId, pausedRemaining]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!started) setRemaining(total);
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Log the focus minutes so far against `task`, and start counting afresh. */
  const logSoFar = useCallback(
    (task: string | null, done?: (minutes: number) => void) => {
      const ms = elapsedMs();
      const minutes = toMinutes(ms / 1000);
      if (minutes >= 1) {
        logFocus.mutate({ task_id: task, started_at: startedAt.current ?? new Date(Date.now() - ms).toISOString(), minutes }, { onSuccess: () => done?.(minutes) });
      }
      banked.current = 0;
      runFrom.current = runFrom.current !== null ? Date.now() : null;
      startedAt.current = runFrom.current !== null ? new Date().toISOString() : null;
      return minutes;
    },
    [logFocus],
  );

  const clearBlock = () => {
    setStarted(false);
    banked.current = 0;
    runFrom.current = null;
    startedAt.current = null;
    endAt.current = null;
  };

  const goTo = (next: TimerMode) => {
    setRunning(false);
    clearBlock();
    setModeState(next);
    setRemaining((next === 'work' ? work : rest) * 60);
  };

  const finish = useCallback(() => {
    setRunning(false);
    if (mode === 'work') {
      const minutes = logSoFar(taskId, (m) => toast(`Focus block done — ${m} min logged. Time for a break ☕`));
      if (minutes < 1) toast('Focus block done. Time for a break ☕');
    } else {
      toast('Break over — ready for the next focus block?');
    }
    clearBlock();
    const next: TimerMode = mode === 'work' ? 'rest' : 'work';
    setModeState(next);
    setRemaining((next === 'work' ? work : rest) * 60);
  }, [mode, work, rest, taskId, logSoFar, toast]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (endAt.current === null) return;
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) finish();
    }, 250);
    return () => window.clearInterval(id);
  }, [running, finish]);

  useEffect(() => {
    const base = 'Daybloom';
    if (!running) {
      document.title = base;
      return;
    }
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    document.title = `${mm}:${ss} ${mode === 'work' ? 'Focus' : 'Break'} · ${base}`;
  }, [running, remaining, mode]);

  const start = () => {
    endAt.current = Date.now() + remaining * 1000;
    if (mode === 'work') {
      runFrom.current = Date.now();
      if (!startedAt.current) startedAt.current = new Date().toISOString();
    }
    setStarted(true);
    setRunning(true);
  };
  const pause = () => {
    setRunning(false);
    endAt.current = null;
    if (runFrom.current !== null) {
      banked.current += Date.now() - runFrom.current;
      runFrom.current = null;
    }
  };

  /** Run `action` now, or — if it would throw away a minute or more of focus — ask first. */
  const stopOrAsk = (action: StopAction) => {
    if (mode === 'work' && elapsedMs() >= ASK_AFTER_S * 1000) {
      setStopping(action);
      return;
    }
    perform(action);
  };
  const perform = (action: StopAction) => {
    if (action.kind === 'reset') goTo(mode);
    else goTo(mode === 'work' ? 'rest' : 'work');
  };

  const value: TimerState = {
    mode,
    remaining,
    total,
    running,
    inProgress,
    elapsed: Math.floor(elapsedMs() / 1000),
    workMin: work,
    restMin: rest,
    taskId,
    fullscreen,
    stopping,
    start,
    pause,
    toggle: () => (running ? pause() : start()),
    reset: () => stopOrAsk({ kind: 'reset' }),
    skip: () => stopOrAsk({ kind: 'skip' }),
    resolveStop: (choice) => {
      const action = stopping;
      setStopping(null);
      if (!action || choice === 'cancel') return;
      if (choice === 'log') {
        logSoFar(taskId, (m) => toast(`${m} min of focus logged.`));
        perform(action);
        return;
      }
      // Discard, with a way back: the block is restored paused, exactly where it was.
      const snapshot = { mode, remaining, banked: elapsedMs(), startedAt: startedAt.current };
      perform(action);
      toast(`Discarded ${toMinutes(snapshot.banked / 1000)} min of focus.`, {
        label: 'Undo',
        onClick: () => {
          setRunning(false);
          setStarted(true);
          endAt.current = null;
          runFrom.current = null;
          banked.current = snapshot.banked;
          startedAt.current = snapshot.startedAt;
          setModeState(snapshot.mode);
          setRemaining(snapshot.remaining);
        },
      });
    },
    // Changing mode is only offered between blocks (the buttons are locked mid-block).
    setMode: (m) => {
      if (m === mode) return;
      if (inProgress) return stopOrAsk({ kind: 'skip' });
      goTo(m);
    },
    setDurations: (w, r) => {
      const next = {
        work: Math.min(Math.max(Math.round(w), WORK_RANGE.min), WORK_RANGE.max),
        rest: Math.min(Math.max(Math.round(r), REST_RANGE.min), REST_RANGE.max),
      };
      setPrefs(next);
      try {
        localStorage.setItem(PREFS, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    // Switching task mid-block splits it: the minutes so far go to the task you were on.
    setTaskId: (id) => {
      if (id === taskId) return;
      if (mode === 'work' && elapsedMs() >= 60_000) {
        logSoFar(taskId, (m) => toast(`${m} min logged to the previous task.`));
      }
      setTaskIdState(id);
    },
    setFullscreen,
  };
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function formatClock(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
