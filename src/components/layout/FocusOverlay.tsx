import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTasks } from '../../hooks/data/tasks';
import { useTimer } from '../../hooks/useTimer';
import { TimerDisplay } from '../focus/TimerDisplay';

/** Full-screen focus mode: hides everything except the timer. */
export function FocusOverlay() {
  const { fullscreen, setFullscreen, taskId } = useTimer();
  const { data: tasks = [] } = useTasks();
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, setFullscreen]);
  if (!fullscreen) return null;
  const task = tasks.find((t) => t.id === taskId);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Full-screen focus" className="dark fixed inset-0 z-[80] flex flex-col items-center justify-center gap-8 bg-[#06050b] text-slate-100">
      <TimerDisplay size={300} taskTitle={task?.title} />
      <button onClick={() => setFullscreen(false)} className="flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm text-slate-300 hover:bg-white/10">
        <X size={15} /> Exit full screen (Esc)
      </button>
    </div>,
    document.body,
  );
}
