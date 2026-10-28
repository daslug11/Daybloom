import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback<ShowToast>(
    (message, action) => {
      const id = uid();
      setToasts((t) => [...t.slice(-2), { id, message, action }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), action ? 6000 : 3000));
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white shadow-[0_10px_40px_-10px_rgba(139,92,246,0.6)] backdrop-blur-xl"
            >
              <span>{t.message}</span>
              {t.action && (
                <button
                  className="rounded-lg bg-violet-500/30 px-2.5 py-1 font-semibold text-violet-100 hover:bg-violet-500/50"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
