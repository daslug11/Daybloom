import { useCallback, useEffect, useRef, type RefObject } from 'react';

/**
 * Shared behaviour for everything that sits on top of the page — dialogs, side panels,
 * menus, the tour and the voice HUD:
 *  - only the top-most open layer reacts to Escape (one press closes one thing);
 *  - Tab stays inside the layer while it's open (optional, for menus it's off);
 *  - focus moves in once on open and returns to whatever opened it on close.
 */
interface Layer {
  id: number;
  onEscape: () => void;
}

const stack: Layer[] = [];
let nextId = 1;
let listening = false;

function onEscapeKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  e.stopPropagation();
  stack[stack.length - 1].onEscape();
}

/** True while any dialog, panel, menu or HUD is open. */
export const hasOpenLayer = () => stack.length > 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusablesIn(el: HTMLElement) {
  return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
}

interface Options {
  open: boolean;
  onEscape: () => void;
  container: RefObject<HTMLElement | null>;
  /** Keep Tab inside the layer (dialogs, panels, the HUD). Off for menus. */
  trapFocus?: boolean;
  /** Move focus into the layer on open: the first `[data-autofocus]`, field, or the container. */
  initialFocus?: boolean;
}

export function useOverlay({ open, onEscape, container, trapFocus = true, initialFocus = true }: Options) {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  const id = useRef(0);
  // Remember the opener during render, before any child's autoFocus moves focus.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') opener.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;

  useEffect(() => {
    if (!open) return;
    const layer: Layer = { id: nextId++, onEscape: () => escape.current() };
    id.current = layer.id;
    stack.push(layer);
    if (!listening) {
      window.addEventListener('keydown', onEscapeKey, true);
      listening = true;
    }

    const raf = initialFocus
      ? requestAnimationFrame(() => {
          const el = container.current;
          if (!el || el.contains(document.activeElement)) return;
          const target = el.querySelector<HTMLElement>('[data-autofocus], [autofocus]') ?? focusablesIn(el).find((n) => n.matches('input, textarea, select')) ?? el;
          target.focus({ preventScroll: true });
        })
      : 0;

    const onTab = (e: KeyboardEvent) => {
      const el = container.current;
      if (e.key !== 'Tab' || !trapFocus || !el || stack[stack.length - 1]?.id !== layer.id) return;
      const items = focusablesIn(el);
      if (!items.length) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = el.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onTab);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onTab);
      const i = stack.findIndex((l) => l.id === layer.id);
      if (i >= 0) stack.splice(i, 1);
      if (!stack.length && listening) {
        window.removeEventListener('keydown', onEscapeKey, true);
        listening = false;
      }
      // Give focus back to the opener — unless the user already moved it somewhere real.
      const back = opener.current;
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (back?.isConnected && (!active || active === document.body)) back.focus({ preventScroll: true });
      });
    };
    // Only (re)run when the layer opens or closes; callbacks are read through refs.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Whether this layer is the top-most one right now (e.g. to ignore shortcuts under a dialog). */
  return useCallback(() => stack[stack.length - 1]?.id === id.current, []);
}
