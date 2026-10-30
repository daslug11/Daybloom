import { X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from '../../hooks/useOverlay';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  /** Optional one-line explanation under the title. */
  description?: ReactNode;
  /** Stacking layer; dialogs opened from the full-screen voice HUD need one above it. */
  layer?: string;
  /** Skip the open animation (dialogs opened from keyboard shortcuts). */
  instant?: boolean;
}

/** Accessible dialog: focus moves in once, Escape closes only the top-most layer, focus returns on close. */
export function Modal({ open, onClose, title, description, children, className, layer = 'z-50', instant = false }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const descId = useId();
  useOverlay({ open, onEscape: onClose, container: panel });

  if (!open) return null;
  return createPortal(
    <div className={cn('fixed inset-0 flex items-end justify-center sm:items-center sm:p-4', layer)}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'sheet relative max-h-[92vh] w-full max-w-lg overflow-y-auto p-6',
          !instant && 'animate-fade-in',
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
            {description && <p id={descId} className="muted mt-1 text-sm">{description}</p>}
          </div>
          <button className="icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
