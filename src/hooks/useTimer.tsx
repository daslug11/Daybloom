import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { celebrate } from '../lib/confetti';
import { dateKey } from '../lib/dates';
import { useFocusSessions, useSettings } from './useData';

export type TimerMode = 'work' | 'rest';

interface TimerState {
  mode: TimerMode;
  remaining: number; // seconds
  total: number;
  running: boolean;
  deepWork: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (m: TimerMode) => void;
  setDeepWork: (v: boolean) => void;
}

const TimerContext = createContext<TimerState | null>(null);

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside <TimerProvider>');
  return ctx;
}

/** Lives at the app root so the Pomodoro keeps ticking while you browse other pages. */
export function TimerProvider({ children }: { children: ReactNode }) {
  const [settings] = useSettings();
  const [, setSessions] = useFocusSessions();
  const { work, rest } = settings.pomodoro;

  const [mode, setModeState] = useState<TimerMode>('work');
  const [running, setRunning] = useState(false);
  const [deepWork, setDeepWork] = useState(false);
  const total = (mode === 'work' ? work : rest) * 60;
  const [remaining, setRemaining] = useState(total);
  const endAt = useRef<number | null>(null);

  // Duration settings changed while idle → snap to new length.
  useEffect(() => {
    if (!running) setRemaining(total);
  }, [total]);

  const finish = useCallback(() => {
    setRunning(false);
    endAt.current = null;
    if (mode === 'work') {
      setSessions((s) => ({ ...s, [dateKey()]: (s[dateKey()] ?? 0) + 1 }));
      celebrate();
    }
    const next: TimerMode = mode === 'work' ? 'rest' : 'work';
    setModeState(next);
    setRemaining((next === 'work' ? work : rest) * 60);
  }, [mode, work, rest, setSessions]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (endAt.current === null) return;
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) finish();
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, finish]);

  useEffect(() => {
    document.title = running
      ? `${formatTime(remaining)} ${mode === 'work' ? '🧠' : '☕'} — Daybloom`
      : 'Daybloom ✨';
  }, [running, remaining, mode]);

  const start = () => {
    endAt.current = Date.now() + remaining * 1000;
    setRunning(true);
  };
  const pause = () => {
    setRunning(false);
    endAt.current = null;
  };
  const reset = () => {
    pause();
    setRemaining(total);
  };
  const setMode = (m: TimerMode) => {
    pause();
    setModeState(m);
    setRemaining((m === 'work' ? work : rest) * 60);
  };
  const skip = () => setMode(mode === 'work' ? 'rest' : 'work');

  return (
    <TimerContext.Provider
      value={{ mode, remaining, total, running, deepWork, start, pause, reset, skip, setMode, setDeepWork }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function formatTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
