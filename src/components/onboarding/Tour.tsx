import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from '../../hooks/useOverlay';
import { useUpdateProfile } from '../../hooks/useProfile';
import { useLocalImportPending } from './LocalImportPrompt';

interface Step {
  target?: string; // data-tour value
  title: string;
  body: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// Targets that live in shared layout files without a data-tour attribute: the phone's + button.
const FALLBACK: Record<string, string> = { capture: 'button[aria-label="Capture (N)"]' };

function visible(selector: string) {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return els.find((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0) ?? null;
}

function findTarget(name?: string) {
  if (!name) return null;
  return visible(`[data-tour="${name}"]`) ?? (FALLBACK[name] ? visible(FALLBACK[name]) : null);
}

const FINAL: Step = { target: 'checklist', title: 'Getting started', body: 'This checklist tracks your first steps and disappears once you’re done. That’s the tour — enjoy Daybloom!' };
const CLOSING: Step = { title: 'That’s the tour', body: 'You can replay it any time from Settings → Profile. Enjoy Daybloom!' };

/** The stops that exist on this screen, with copy for the controls the user can actually see. */
function buildSteps(): Step[] {
  const sidebar = window.matchMedia('(min-width: 768px)').matches;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const captureBar = !!visible('[data-tour="capture"]');
  const atlasKey = touch ? '' : ` (${isMac ? '⌘J' : 'Ctrl+J'})`;
  const stops: Step[] = [
    {
      target: 'capture',
      title: 'Capture anything',
      body: captureBar
        ? 'Press N anywhere, or click this bar, to jot a thought or add a task. Notes land in your Brain Dump inbox; you can also dictate.'
        : 'Tap + to jot a thought or add a task. Notes land in your Brain Dump inbox; you can also dictate.',
    },
    { target: 'nav-brain-dump', title: 'Brain Dump', body: 'Your inbox for everything you capture. “Process inbox” goes through notes one by one: make a task, schedule it, add it to a goal, keep it as an idea, or archive it.' },
    { target: 'nav-tasks', title: 'Tasks', body: 'Everything to do, grouped by when it’s due. Star up to three as today’s top 3 — they show on your dashboard.' },
    { target: 'nav-planner', title: 'Planner', body: 'Drag tasks onto a day or week timeline to block time. Synced calendar events appear as locked, striped blocks.' },
    {
      target: 'nav-habits',
      title: 'Habits, goals & more',
      body: `Track daily habits and streaks, measurable goals, focus sessions, mood and a weekly review — all ${sidebar ? 'in the sidebar' : 'under More'}.`,
    },
    {
      target: 'atlas',
      title: 'Meet Atlas',
      body: `Your assistant. ${touch ? 'Tap the orb to ask it' : `Ask it${atlasKey}`} to add tasks, sort your inbox, block time or summarise your day — or talk to it in voice mode. Each reply uses one of your daily ✨ AI actions.`,
    },
  ].filter((s) => findTarget(s.target));
  const count = stops.length + 1;
  return [{ title: 'A quick tour 👋', body: `${count} stops, about a minute. You can skip any time and replay it later from Settings.` }, ...stops, FINAL];
}

const PAD = 6; // spotlight padding around the target
const GAP = 12 + PAD;
const EDGE = 16;

/** Puts the card next to the target without covering it, using the card's measured height. */
function place(rect: DOMRect | null, W: number, H: number): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = (t: number) => Math.min(Math.max(EDGE, t), Math.max(EDGE, vh - H - EDGE));
  if (!rect) return { width: W, left: (vw - W) / 2, top: top((vh - H) / 2) };
  // Left-hand targets (sidebar): to the right. Right-hand targets (the Atlas orb): to the left.
  if (rect.right < vw * 0.4 && rect.right + GAP + W <= vw - EDGE) return { width: W, left: rect.right + GAP, top: top(rect.top + rect.height / 2 - H / 2) };
  if (rect.left > vw * 0.6 && rect.left - GAP - W >= EDGE) return { width: W, left: rect.left - GAP - W, top: top(rect.bottom - H) };
  const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - W / 2), vw - W - EDGE);
  if (rect.bottom + GAP + H <= vh - EDGE) return { width: W, left, top: rect.bottom + GAP };
  if (rect.top - GAP - H >= EDGE) return { width: W, left, top: rect.top - GAP - H };
  return { width: W, left, top: top(rect.bottom + GAP) };
}

/** Skippable spotlight tour over the main parts of the app. Waits until the local-data import offer is answered. */
export default function Tour({ onClose }: { onClose: () => void }) {
  const importPending = useLocalImportPending();
  if (importPending) return null;
  return <TourCard onClose={onClose} />;
}

function TourCard({ onClose }: { onClose: () => void }) {
  const [steps] = useState(buildSteps);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(200);
  const card = useRef<HTMLDivElement>(null);
  const update = useUpdateProfile();
  const last = i === steps.length - 1;
  // The checklist may be hidden or finished; then the last stop is a short closing card instead.
  const step = last && !findTarget(FINAL.target) ? CLOSING : steps[i];

  const finish = () => {
    update.mutate({ tour_completed_at: new Date().toISOString() });
    onClose();
  };

  useLayoutEffect(() => {
    const measure = () => {
      const el = findTarget(step.target);
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

  // Place with the real card height (copy length and text size vary), not a guess.
  useLayoutEffect(() => {
    const h = card.current?.offsetHeight;
    if (h && Math.abs(h - cardH) > 1) setCardH(h);
  });

  // Escape (top-most layer only), focus containment and focus return come from the shared layer stack.
  const isTop = useOverlay({ open: true, onEscape: () => finish(), container: card });

  // The page behind the scrim can't be tabbed into or clicked while the tour is open.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    return () => root?.removeAttribute('inert');
  }, []);

  // Each step moves focus to its main button, so Enter always goes forward.
  useEffect(() => {
    if (i > 0) card.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTop, steps.length]);

  const W = Math.min(340, window.innerWidth - EDGE * 2);
  const style = place(rect, W, cardH);

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      {rect ? (
        // Layout properties on purpose: the ring tracks a resizing rectangle, once per user.
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-ink/40 transition-[left,top,width,height] duration-base ease-out motion-reduce:transition-none"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/65" />
      )}
      <div aria-live="polite" className="sr-only">
        Step {i + 1} of {steps.length}: {step.title}
      </div>
      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute rounded-card border border-line-strong bg-overlay p-5 shadow-modal outline-none"
        style={style}
      >
        <div className="muted text-xs font-medium tabular-nums">
          Step {i + 1} of {steps.length}
        </div>
        <h2 id="tour-title" className="mt-1 text-base font-semibold">
          {step.title}
        </h2>
        <p id="tour-body" className="muted mt-1.5 text-sm leading-relaxed">
          {step.body}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button className="-ml-2 min-h-[44px] rounded-control px-2 text-sm font-medium text-muted hover:underline" onClick={finish}>
            Skip tour
          </button>
          <div className="ml-auto flex gap-2">
            {i > 0 && (
              <button className="btn-ghost" onClick={() => setI(i - 1)}>
                Back
              </button>
            )}
            {!last ? (
              <button className="btn-primary" onClick={() => setI(i + 1)} data-autofocus>
                Next
              </button>
            ) : (
              <button className="btn-primary" onClick={finish} data-autofocus>
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
