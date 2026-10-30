import { X } from 'lucide-react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTasks } from '../../hooks/data/tasks';
import { useOverlay } from '../../hooks/useOverlay';
import { useTimer } from '../../hooks/useTimer';
import { TimerDisplay } from '../focus/TimerDisplay';

/** Full-screen focus mode: hides everything except the timer. */
export function FocusOverlay() {
  const { fullscreen, setFullscreen, taskId } = useTimer();
  const { data: tasks = [] } = useTasks();
  const root = useRef<HTMLDivElement>(null);
  useOverlay({ open: fullscreen, onEscape: () => setFullscreen(false), container: root });
  if (!fullscreen) return null;
  const task = tasks.find((t) => t.id === taskId);
  return createPortal(
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Full-screen focus" className="dark fixed inset-0 z-[80] flex flex-col items-center justify-center gap-8 bg-canvas text-ink">
      <TimerDisplay size={300} taskTitle={task?.title} />
      <button onClick={() => setFullscreen(false)} className="flex items-center gap-2 rounded-full border border-line-strong px-5 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
        <X size={15} /> Exit full screen (Esc)
      </button>
    </div>,
    document.body,
  );
}
