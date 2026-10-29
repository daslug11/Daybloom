import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SITE_URL } from '../../lib/env';
import { supabase } from '../../lib/supabase';
import { AuthLayout, authMessage, FormError } from './AuthLayout';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (!agree) return setError('Please agree to the Terms and Privacy Policy.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${SITE_URL}/auth/callback` } });
    setBusy(false);
    if (error) return setError(authMessage(error));
    // Supabase returns a user with no identities when the email already exists (to avoid leaking accounts).
    if (data.user && data.user.identities?.length === 0) return setError('There’s already an account with that email. Log in instead.');
    setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your email 📬" subtitle={<>We sent a confirmation link to <strong>{sentTo}</strong>.</>} footer={<Link to="/login" className="link">Back to log in</Link>}>
        <p className="text-sm">Open the link on this device to finish setting up your account. It can take a minute to arrive — check your spam folder too.</p>
        <button
          className="btn-ghost mt-4 w-full"
          onClick={async () => {
            const { error } = await supabase.auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: `${SITE_URL}/auth/callback` } });
            setError(error ? authMessage(error) : '');
            if (!error) setError('Sent again — check your inbox.');
          }}
        >
          Resend the link
        </button>
        <div className="mt-3">
          <FormError message={error} />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your free account"
      subtitle="Capture everything, plan your day, build habits — synced across your devices."
      footer={
        <>
          Already have an account? <Link to="/login" className="link">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-help" />
          <p id="pw-help" className="faint mt-1 text-xs">
            At least 8 characters.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-violet-600" />
          <span>
            I agree to the{' '}
            <Link to="/terms" className="link" target="_blank">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="link" target="_blank">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <FormError message={error} />
        <button className="btn-primary w-full" disabled={busy || !email || !password}>
          {busy ? 'Creating your account…' : 'Sign up free'}
        </button>
      </form>
    </AuthLayout>
  );
}
