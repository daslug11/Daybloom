import type { ReactNode } from 'react';

/** Every page says what it's for and what to do there. */
export function PageHeader({ title, description, actions }: { title: string; description: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="page-title">{title}</h1>
        <p className="muted mt-1.5 max-w-[68ch] text-sm">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
