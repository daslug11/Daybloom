import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SITE_URL } from '../../lib/env';
import { supabase } from '../../lib/supabase';
import { AuthLayout, authMessage, FormError } from './AuthLayout';

export default function LogIn() {
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/app';
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ?? '');
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return setError(authMessage(error));
      navigate(next, { replace: true });
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` } });
      setBusy(false);
      if (error) return setError(authMessage(error));
      setSent(true);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email ✉️" subtitle={<>We sent a sign-in link to <strong>{email}</strong>.</>} footer={<button className="link" onClick={() => setSent(false)}>Use a different method</button>}>
        <p className="text-sm">Open it on this device to log in. The link works once and expires in an hour.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your Daybloom."
      footer={
        <>
          New here? <Link to="/signup" className="link">Sign up free</Link>
        </>
      }
    >
      <div className="mb-4 flex rounded-xl border border-slate-900/10 p-0.5 dark:border-white/10" role="tablist">
        {(
          [
            ['password', 'Password'],
            ['magic', 'Email me a link'],
          ] as const
        ).map(([m, label]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${mode === m ? 'bg-violet-600 text-white' : 'muted'}`}>
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === 'password' && (
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="password">
                Password
              </label>
              <Link to="/forgot-password" className="mb-1.5 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">
                Forgot password?
              </Link>
            </div>
            <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <FormError message={error} />
        <button className="btn-primary w-full" disabled={busy || !email || (mode === 'password' && !password)}>
          {busy ? 'One moment…' : mode === 'password' ? 'Log in' : 'Send me a sign-in link'}
        </button>
      </form>
    </AuthLayout>
  );
}
