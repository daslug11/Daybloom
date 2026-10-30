import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from '../../hooks/useOverlay';
import { cn } from '../../lib/utils';

interface MenuProps {
  /** Accessible name of the trigger button. */
  label: string;
  /** Visible trigger content (usually an icon). */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Which trigger edge the menu lines up with. */
  align?: 'left' | 'right';
  width?: number;
  children: (close: () => void) => ReactNode;
}

const GAP = 6;

/**
 * Dropdown menu rendered in a top-level layer, so it never hides under a neighbouring
 * card. Opens below its trigger (above it when there isn't room), closes on Escape,
 * outside click or a choice, and supports ↑/↓/Home/End between items.
 */
export function Menu({ label, trigger, triggerClassName, align = 'right', width = 224, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const close = () => setOpen(false);
  useOverlay({ open, onEscape: close, container: panel, trapFocus: false, initialFocus: false });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = button.current?.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 0;
      if (!t) return;
      const below = t.bottom + GAP;
      const top = below + h > window.innerHeight - 8 && t.top - GAP - h > 8 ? t.top - GAP - h : below;
      const rawLeft = align === 'right' ? t.right - width : t.left;
      setPos({ top, left: Math.max(8, Math.min(rawLeft, window.innerWidth - width - 8)) });
    };
    place();
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!panel.current?.contains(n) && !button.current?.contains(n)) setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, align, width]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => (e.preventDefault(), items[(n + items.length) % items.length].focus());
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <>
      <button ref={button} type="button" className={triggerClassName ?? 'icon-btn h-8 w-8'} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label}>
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
            className={cn('menu-panel fixed z-[75]', !pos && 'invisible')}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({ onClick, children, disabled, danger }: { onClick: () => void; children: ReactNode; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className={cn('menu-item', danger && 'text-danger')}>
      {children}
    </button>
  );
}
