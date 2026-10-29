import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLogFocus } from './data/focus';
import { useToast } from './useToast';

export type TimerMode = 'work' | 'rest';

interface TimerState {
  mode: TimerMode;
  remaining: number; // seconds
  total: number;
  running: boolean;
  workMin: number;
  restMin: number;
  taskId: string | null;
  fullscreen: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (m: TimerMode) => void;
  setDurations: (work: number, rest: number) => void;
  setTaskId: (id: string | null) => void;
  setFullscreen: (v: boolean) => void;
}

const TimerContext = createContext<TimerState | null>(null);
const PREFS = 'daybloom:pomodoro';

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}');
    return { work: Number(p.work) || 25, rest: Number(p.rest) || 5 };
  } catch {
    return { work: 25, rest: 5 };
  }
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside <TimerProvider>');
  return ctx;
}

/**
 * App-wide Pomodoro: keeps ticking while you move between pages. When a focus
 * block finishes, the minutes are logged (linked to the chosen task, if any).
 */
export function TimerProvider({ children }: { children: ReactNode }) {
  const [{ work, rest }, setPrefs] = useState(loadPrefs);
  const [mode, setModeState] = useState<TimerMode>('work');
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const total = (mode === 'work' ? work : rest) * 60;
  const [remaining, setRemaining] = useState(total);
  const endAt = useRef<number | null>(null);
  const startedAt = useRef<string | null>(null);
  const logFocus = useLogFocus();
  const toast = useToast();

  useEffect(() => {
    if (!running) setRemaining(total);
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    setRunning(false);
    endAt.current = null;
    if (mode === 'work') {
      logFocus.mutate({ task_id: taskId, started_at: startedAt.current ?? new Date(Date.now() - work * 60_000).toISOString(), minutes: work });
      toast(`Focus session done — ${work} minutes logged. Time for a break ☕`);
    } else {
      toast('Break over — ready for the next focus block?');
    }
    startedAt.current = null;
    const next: TimerMode = mode === 'work' ? 'rest' : 'work';
    setModeState(next);
    setRemaining((next === 'work' ? work : rest) * 60);
  }, [mode, work, rest, taskId, logFocus, toast]);

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

  const pause = () => {
    setRunning(false);
    endAt.current = null;
  };
  const value: TimerState = {
    mode,
    remaining,
    total,
    running,
    workMin: work,
    restMin: rest,
    taskId,
    fullscreen,
    start: () => {
      endAt.current = Date.now() + remaining * 1000;
      if (mode === 'work' && !startedAt.current) startedAt.current = new Date().toISOString();
      setRunning(true);
    },
    pause,
    reset: () => {
      pause();
      startedAt.current = null;
      setRemaining(total);
    },
    skip: () => {
      pause();
      startedAt.current = null;
      const next: TimerMode = mode === 'work' ? 'rest' : 'work';
      setModeState(next);
      setRemaining((next === 'work' ? work : rest) * 60);
    },
    setMode: (m) => {
      pause();
      startedAt.current = null;
      setModeState(m);
      setRemaining((m === 'work' ? work : rest) * 60);
    },
    setDurations: (w, r) => {
      const next = { work: Math.min(Math.max(Math.round(w), 1), 180), rest: Math.min(Math.max(Math.round(r), 1), 60) };
      setPrefs(next);
      try {
        localStorage.setItem(PREFS, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    setTaskId,
    setFullscreen,
  };
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function formatClock(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
