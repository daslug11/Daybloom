import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/layout/Logo';
import { useAuth } from '../../hooks/useAuth';

export function PublicHeader() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="Daybloom home">
          <Logo />
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-2" aria-label="Site">
          <a href="/#features" className="hidden rounded-lg px-3 py-2 font-medium text-ink hover:bg-raised sm:inline">
            Features
          </a>
          <a href="/#faq" className="hidden rounded-lg px-3 py-2 font-medium text-ink hover:bg-raised sm:inline">
            FAQ
          </a>
          {user ? (
            <Link to="/app" className="btn-primary !px-3.5 !py-2">
              Open Daybloom
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 font-medium text-ink hover:bg-raised">
                Log in
              </Link>
              <Link to="/signup" className="btn-primary !px-3.5 !py-2">
                Sign up free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-8 text-sm sm:px-6">
        <Logo />
        <span className="muted">A calm place to organise your life.</span>
        <nav className="ml-auto flex gap-4" aria-label="Legal">
          <Link to="/terms" className="muted hover:underline">
            Terms
          </Link>
          <Link to="/privacy" className="muted hover:underline">
            Privacy
          </Link>
          <a href="mailto:hello@daybloom.online" className="muted hover:underline">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

/**
 * A value the owner still has to fill in (company name, dates, legal clauses).
 * Rendered as a dashed amber token so nobody mistakes it for final text.
 */
export function Pending({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded-[4px] border border-dashed border-warning/60 bg-warning/10 px-1 font-medium text-warning [box-decoration-break:clone]">
      <span className="sr-only">Not filled in yet: </span>
      {children}
    </mark>
  );
}

/** Long-form page wrapper for legal text. */
export function LegalPage({ title, updated, children }: { title: string; updated: ReactNode; children: ReactNode }) {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div role="note" className="mb-8 max-w-[68ch] rounded-card border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <strong>Placeholder — review before launch.</strong> This text is a starting point written for Daybloom, not legal advice. Everything marked like{' '}
          <Pending>this</Pending> still has to be filled in, and the whole text checked for your jurisdiction.
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="muted mt-2 text-sm">Last updated: {updated}</p>
        <div className="legal mt-8 max-w-[68ch] space-y-4 text-[15px] leading-relaxed [&_h2]:!mt-12 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
      </article>
    </PublicLayout>
  );
}
