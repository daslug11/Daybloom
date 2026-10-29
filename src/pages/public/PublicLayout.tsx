import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/layout/Logo';

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-900/5 bg-slate-100/80 backdrop-blur-xl dark:border-white/5 dark:bg-[#08070f]/80">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="Daybloom home">
          <Logo />
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-2" aria-label="Site">
          <a href="/#features" className="hidden rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-900/5 sm:inline dark:text-slate-300 dark:hover:bg-white/5">
            Features
          </a>
          <a href="/#faq" className="hidden rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-900/5 sm:inline dark:text-slate-300 dark:hover:bg-white/5">
            FAQ
          </a>
          <Link to="/login" className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5">
            Log in
          </Link>
          <Link to="/signup" className="btn-primary !px-3.5 !py-2">
            Sign up free
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-900/10 dark:border-white/10">
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

/** Long-form page wrapper for legal text. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div role="note" className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
          <strong>Placeholder — review before launch.</strong> This text is a starting point written for Daybloom, not legal advice. Replace everything in
          [square brackets] and have it checked for your jurisdiction.
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="muted mt-2 text-sm">Last updated: {updated}</p>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
      </article>
    </PublicLayout>
  );
}
