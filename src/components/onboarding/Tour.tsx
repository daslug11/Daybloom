import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUpdateProfile } from '../../hooks/useProfile';

interface Step {
  target?: string; // data-tour value
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { title: 'A quick tour 👋', body: 'Seven stops, about a minute. You can skip any time and replay it later from Settings.' },
  { target: 'capture', title: 'Capture anything', body: 'Press N anywhere (or the + button) to jot a thought or add a task. Notes land in your Brain Dump inbox; you can also dictate.' },
  { target: 'nav-brain-dump', title: 'Brain Dump', body: 'Your inbox for everything you capture. “Process inbox” goes through notes one by one: make a task, schedule it, add it to a goal, keep it as an idea, or archive it.' },
  { target: 'nav-tasks', title: 'Tasks', body: 'Everything to do, grouped by when it\'s due. Star up to three as today\'s top 3 — they show on your dashboard.' },
  { target: 'nav-planner', title: 'Planner', body: 'Drag tasks onto a day/week timeline to block time. Synced calendar events appear as locked, striped blocks.' },
  { target: 'nav-habits', title: 'Habits, goals & more', body: 'Track daily habits and streaks, measurable goals, focus sessions, mood, and a weekly review — all in the sidebar.' },
  { target: 'atlas', title: 'Meet Atlas', body: 'Your assistant. Ask it (⌘J) to add tasks, sort your inbox, block time or summarise your day — or talk to it in voice mode. Each reply uses one of your daily ✨ AI actions.' },
  { target: 'checklist', title: 'Getting started', body: 'This checklist tracks your first steps and disappears once you\'re done. That\'s the tour — enjoy Daybloom!' },
];

function visibleTarget(name?: string) {
  if (!name) return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return els.find((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0) ?? null;
}

/** Skippable spotlight tour over the main parts of the app. */
export default function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const update = useUpdateProfile();
  const step = STEPS[i];

  const finish = () => {
    update.mutate({ tour_completed_at: new Date().toISOString() });
    onClose();
  };

  useLayoutEffect(() => {
    const measure = () => {
      const el = visibleTarget(step.target);
      if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const id = window.setTimeout(measure, 120);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', measure);
    };
  }, [step.target]);

  useEffect(() => {
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const pad = 6;
  const W = Math.min(340, window.innerWidth - 32);
  let style: React.CSSProperties = { width: W, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  if (rect) {
    const below = rect.bottom + 12 + 180 < window.innerHeight;
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - W / 2), window.innerWidth - W - 16);
    const rightSide = rect.right + 16 + W < window.innerWidth && rect.height > 200;
    style = rightSide
      ? { width: W, left: rect.right + 16, top: Math.max(16, rect.top) }
      : below
        ? { width: W, left, top: rect.bottom + 12 }
        : { width: W, left, top: Math.max(16, rect.top - 12 - 200) };
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-violet-400 transition-all duration-200"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(3,2,10,0.65)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/65" />
      )}
      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="absolute rounded-2xl border border-violet-400/40 bg-white p-5 shadow-2xl outline-none dark:bg-[#15121f]"
        style={style}
      >
        <div className="faint text-[11px] font-semibold uppercase tracking-wider">
          Step {i + 1} of {STEPS.length}
        </div>
        <h2 id="tour-title" className="mt-1 text-base font-bold">
          {step.title}
        </h2>
        <p className="muted mt-1.5 text-sm leading-relaxed">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-400" onClick={finish}>
            Skip tour
          </button>
          <div className="ml-auto flex gap-2">
            {i > 0 && (
              <button className="btn-ghost !px-3 !py-1.5" onClick={() => setI(i - 1)}>
                Back
              </button>
            )}
            {i < STEPS.length - 1 ? (
              <button className="btn-primary !px-3 !py-1.5" onClick={() => setI(i + 1)} autoFocus>
                Next
              </button>
            ) : (
              <button className="btn-primary !px-3 !py-1.5" onClick={finish} autoFocus>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
