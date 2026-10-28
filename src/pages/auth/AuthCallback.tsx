import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/ui/States';
import { useAuth } from '../../hooks/useAuth';
import { AuthLayout, authMessage } from './AuthLayout';

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

  useEffect(() => {
    if (session && !error) {
      const id = window.setTimeout(() => navigate(emailChange ? '/app/settings?email=updated' : next, { replace: true }), emailChange ? 1200 : 0);
      return () => window.clearTimeout(id);
    }
  }, [session, error, next, emailChange, navigate]);

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), 6000);
    return () => window.clearTimeout(id);
  }, []);

  if (error || (timedOut && !session)) {
    return (
      <AuthLayout title="That link didn’t work" footer={<Link to="/login" className="link">Go to log in</Link>}>
        <p className="text-sm">
          {error
            ? authMessage({ message: error })
            : 'Your email may already be confirmed — try logging in. Links only work once, and must be opened in the browser where you signed up.'}
        </p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title={emailChange && session ? 'Email updated ✅' : 'Signing you in…'}>
      <Spinner label="Signing you in" />
    </AuthLayout>
  );
}
