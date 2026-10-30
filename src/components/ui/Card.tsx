import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds the hover border for clickable cards. */
  interactive?: boolean;
  as?: 'div' | 'section' | 'article';
  'aria-label'?: string;
  'data-tour'?: string;
}

export function Card({ children, className, interactive, as: Tag = 'div', ...rest }: CardProps) {
  return (
    <Tag className={cn('card relative animate-fade-in p-5', interactive && 'card-hover', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardTitle({ icon, children, action, id }: { icon?: ReactNode; children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 id={id} className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-wide text-ink">
        {icon}
        <span className="truncate">{children}</span>
      </h2>
      {action}
    </div>
  );
}
