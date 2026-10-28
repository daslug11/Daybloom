import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTimer } from '../hooks/useTimer';
import { TimerDisplay } from './TimerDisplay';

/** Deep Work Mode 🧠: dims the whole app and leaves only the glowing timer. */
export function DeepWorkOverlay() {
  const { deepWork, setDeepWork } = useTimer();
  return createPortal(
    <AnimatePresence>
      {deepWork && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-8 bg-black/90 text-white backdrop-blur-md"
        >
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="dark">
            <div className="text-slate-100">
              <TimerDisplay size={320} />
            </div>
          </motion.div>
          <button
            onClick={() => setDeepWork(false)}
            className="rounded-full border border-white/15 px-5 py-2 text-sm text-slate-300 transition hover:bg-white/10"
          >
            Exit Deep Work Mode
          </button>
          <p className="text-xs text-slate-500">Notifications: muted. Distractions: banished. ✨</p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
