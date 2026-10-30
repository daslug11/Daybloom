import { X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTasks } from '../../hooks/data/tasks';
import { useOverlay } from '../../hooks/useOverlay';
import { useTimer } from '../../hooks/useTimer';
import { TimerDisplay } from '../focus/TimerDisplay';

/** Ring size that fits any screen, phone landscape included: min(300px, 60vh, 80vw). */
function ringSize() {
  return Math.round(Math.max(160, Math.min(300, window.innerHeight * 0.6, window.innerWidth * 0.8)));
}

function useRingSize(active: boolean) {
  const [size, setSize] = useState(ringSize);
  useEffect(() => {
    if (!active) return;
    const on = () => setSize(ringSize());
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [active]);
  return size;
}

/**
 * Full-screen focus mode: hides everything except the timer. A modal layer (Escape closes it,
 * Tab stays inside, focus starts on Start/Pause and returns to the opener); Space starts or pauses.
 */
export function FocusOverlay() {
  const { fullscreen, setFullscreen, taskId, toggle, stopping } = useTimer();
  const { data: tasks = [] } = useTasks();
  const root = useRef<HTMLDivElement>(null);
  const size = useRingSize(fullscreen);
  useOverlay({ open: fullscreen, onEscape: () => setFullscreen(false), container: root });
  if (!fullscreen) return null;
  const task = tasks.find((t) => t.id === taskId);

  const onKeyDown = (e: KeyboardEvent) => {
    // Space on a button presses that button; anywhere else it starts or pauses the timer.
    if (e.key !== ' ' || stopping || (e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    e.preventDefault();
    toggle();
  };

  return createPortal(
    <div
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen focus"
      onKeyDown={onKeyDown}
      className="dark fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-canvas text-ink outline-none"
    >
      <button
        onClick={() => setFullscreen(false)}
        className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 flex min-h-[40px] items-center gap-2 rounded-full border border-line-strong bg-canvas px-4 py-2 text-sm text-muted hover:bg-raised hover:text-ink"
      >
        <X size={15} aria-hidden /> Exit<span className="hidden sm:inline"> full screen</span> <kbd className="font-mono text-xs">Esc</kbd>
      </button>
      <div className="flex min-h-full flex-col items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
        <TimerDisplay size={size} taskTitle={task?.title} autoFocusMain />
        <p className="muted mt-6 hidden text-xs sm:block">
          <kbd className="font-mono">Space</kbd> start or pause · <kbd className="font-mono">Esc</kbd> exit
        </p>
      </div>
    </div>,
    document.body,
  );
}
