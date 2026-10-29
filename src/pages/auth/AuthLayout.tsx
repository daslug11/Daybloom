import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/layout/Logo';

/** Branded frame for sign-up / log-in / reset screens. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-8" aria-label="Daybloom home">
        <Logo />
      </Link>
      <main className="glass w-full max-w-sm p-6 sm:p-8">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="muted mt-1.5 text-sm">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
      {footer && <div className="muted mt-6 text-sm">{footer}</div>}
      <p className="faint mt-8 text-xs">
        <Link to="/terms" className="hover:underline">
          Terms
        </Link>{' '}
        ·{' '}
        <Link to="/privacy" className="hover:underline">
          Privacy
        </Link>
      </p>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
      {message}
    </p>
  );
}

/** Supabase auth errors → plain language. */
export function authMessage(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!err) return '';
  const m = (err.message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password don’t match. Try again, or reset your password.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox for the link we sent.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'There’s already an account with that email. Log in instead.';
  if (m.includes('password should be') || m.includes('weak')) return 'Choose a stronger password: at least 8 characters.';
  if (m.includes('signups not allowed') || m.includes('user not found')) return 'No account with that email yet. Sign up first.';
  if (m.includes('rate limit') || err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('expired') || (m.includes('invalid') && m.includes('link'))) return 'That link has expired or was already used. Request a new one.';
  if (m.includes('same password') || m.includes('different from the old')) return 'Your new password must be different from the old one.';
  if (m.includes('fetch')) return 'Can’t reach Daybloom right now. Check your connection.';
  return err.message ?? 'Something went wrong. Please try again.';
}
