import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { uid } from '../lib/utils';

interface ToastAction {
  label: string;
  onClick: () => void;
}
interface Toast {
  id: string;
  message: string;
  action?: ToastAction;
}
type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** How long a toast stays: long enough to read, longer when there's something to do (Undo). */
const DURATION = { plain: 5000, action: 8000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const reduce = useReducedMotion();
  // Per toast: the running timer and how much time it has left (paused while hovered or focused).
  const timers = useRef(new Map<string, { handle: number; left: number; started: number }>());
  const paused = useRef(false);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    window.clearTimeout(timers.current.get(id)?.handle);
    timers.current.delete(id);
  }, []);

  const start = useCallback(
    (id: string, left: number) => {
      timers.current.set(id, { handle: window.setTimeout(() => dismiss(id), left), left, started: Date.now() });
    },
    [dismiss],
  );

  const show = useCallback<ShowToast>(
    (message, action) => {
      const id = uid();
      setToasts((t) => {
        // Keep at most three; drop the oldest (and its timer).
        const kept = t.slice(-2);
        for (const old of t.slice(0, -2)) {
          window.clearTimeout(timers.current.get(old.id)?.handle);
          timers.current.delete(old.id);
        }
        return [...kept, { id, message, action }];
      });
      const left = action ? DURATION.action : DURATION.plain;
      if (paused.current) timers.current.set(id, { handle: 0, left, started: Date.now() });
      else start(id, left);
    },
    [start],
  );

  const pause = () => {
    if (paused.current) return;
    paused.current = true;
    for (const t of timers.current.values()) {
      window.clearTimeout(t.handle);
      t.left = Math.max(1500, t.left - (Date.now() - t.started));
    }
  };
  const resume = () => {
    if (!paused.current) return;
    paused.current = false;
    for (const [id, t] of timers.current) start(id, t.left);
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* The live region is always present so screen readers announce each new message. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6"
        onPointerEnter={pause}
        onPointerLeave={resume}
        onFocus={pause}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && resume()}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }}
              transition={reduce ? { duration: 0.15 } : undefined}
              className="toast pointer-events-auto"
            >
              <span className="min-w-0 flex-1">{t.message}</span>
              {t.action && (
                <button
                  className="toast-action"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
