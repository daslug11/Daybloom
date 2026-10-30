import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/ui/States';
import { useAuth } from '../../hooks/useAuth';
import { AuthLayout, authMessageFromUrl } from './AuthLayout';

/**
 * Where email links land (confirm sign-up, magic link, email change).
 * The Supabase client exchanges the ?code= automatically; we wait for the session.
 */
export default function AuthCallback() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const error = search.get('error_description') ?? hash.get('error_description');
  const next = search.get('next')?.startsWith('/') ? search.get('next')! : '/app';
  const emailChange = search.get('type') === 'email_change' || hash.get('type') === 'email_change';
  // Secure email change: the first of the two links (old + new address) only returns a message.
  const halfway = emailChange && !!(search.get('message') ?? hash.get('message'));

  useEffect(() => {
    if (session && !error && !halfway) {
      const id = window.setTimeout(() => navigate(emailChange ? '/app/settings?email=updated' : next, { replace: true }), emailChange ? 1200 : 0);
      return () => window.clearTimeout(id);
    }
  }, [session, error, next, emailChange, halfway, navigate]);

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), 6000);
    return () => window.clearTimeout(id);
  }, []);

  if (halfway) {
    return (
      <AuthLayout title="One more link to click" footer={<Link to="/app" className="link">Back to Daybloom</Link>}>
        <p className="text-sm">That confirmed one address. To finish changing your email, open the link we sent to the other address too.</p>
      </AuthLayout>
    );
  }
  if (error || (timedOut && !session)) {
    return (
      <AuthLayout title="That link didn’t work" footer={<Link to="/login" className="link">Go to log in</Link>}>
        <p className="text-sm">
          {error
            ? authMessageFromUrl(error)
            : 'Your email may already be confirmed — try logging in. Links only work once, and must be opened in the browser where you signed up.'}
        </p>
        {emailChange ? (
          <Link to="/app/settings" className="btn-primary mt-5 w-full">
            Request a new link in Settings
          </Link>
        ) : (
          <Link to="/login?method=link" className="btn-primary mt-5 w-full">
            Send a new link
          </Link>
        )}
      </AuthLayout>
    );
  }
  if (emailChange && session) {
    return (
      <AuthLayout title="Email updated">
        <p role="status" className="flex items-center gap-2 text-sm">
          <CheckCircle2 size={18} className="shrink-0 text-success" aria-hidden />
          Your new email is confirmed. Taking you to Settings…
        </p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Signing you in…">
      <Spinner label="Signing you in" />
    </AuthLayout>
  );
}
