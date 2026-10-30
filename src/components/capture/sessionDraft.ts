import { useCallback, useEffect, useRef } from 'react';

/**
 * Small, safe wrappers around sessionStorage for things that must survive an accidental
 * close or a page change in this tab — capture drafts, the last ✨ result — but shouldn't
 * outlive it. Storage can be missing or blocked (private mode, previews): every call is
 * wrapped, and the app works the same without it.
 */
export function loadSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveSession(key: string, value: unknown) {
  try {
    if (value == null || value === '') sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the draft just won't survive a reload */
  }
}

export const draftKey = (name: string, uid: string) => `daybloom:${name}:${uid}`;

/**
 * Remembers which way the last close of a dialog was triggered. Modal sends Escape, the ×
 * button and backdrop clicks to the same onClose; this tells a backdrop click apart (the last
 * pointer press landed outside the dialog panel just now) so a dialog with unsaved input can
 * ignore it.
 */
export function useBackdropGuard(open: boolean, inside: React.RefObject<HTMLElement | null>) {
  const lastOutside = useRef(0);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const dialog = inside.current?.closest('[role="dialog"]');
      lastOutside.current = dialog && !dialog.contains(e.target as Node) ? Date.now() : 0;
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, inside]);
  // Only a click counts: Escape (a keydown) right after a stray tap must still close.
  return useCallback(() => window.event?.type === 'click' && Date.now() - lastOutside.current < 1000, []);
}
