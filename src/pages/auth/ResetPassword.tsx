import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/ui/States';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../lib/supabase';
import { AuthLayout, authMessage, authMessageFromUrl, FieldError, fieldProps, focusFirstInvalid, FormError, hasErrors, type FieldErrors } from './AuthLayout';

/** Opened from the reset email: the link signs the user in for recovery, then they choose a new password. */
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waited, setWaited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 2500);
    return () => window.clearTimeout(id);
  }, []);

  const urlError = new URLSearchParams(window.location.search).get('error_description') ?? new URLSearchParams(window.location.hash.slice(1)).get('error_description');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errs: FieldErrors = {
      pw: !password ? 'Choose a new password.' : password.length < 8 ? `Use at least 8 characters (you have ${password.length}).` : '',
      pw2: password.length >= 8 && password !== confirm ? 'The two passwords don’t match.' : '',
    };
    setFieldErrors(errs);
    if (hasErrors(errs)) return focusFirstInvalid(formRef.current, errs);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(authMessage(error));
    toast('Password updated. Use it next time you log in.');
    navigate('/app', { replace: true });
  };

  if (!session && (loading || !waited) && !urlError) {
    return (
      <AuthLayout title="Checking your link…">
        <Spinner label="Checking your reset link" />
      </AuthLayout>
    );
  }
  if (!session) {
    return (
      <AuthLayout title="That link didn’t work" footer={<Link to="/login" className="link">Go to log in</Link>}>
        <p className="text-sm">{urlError ? authMessageFromUrl(urlError) : 'Reset links expire after an hour and only work once, in the browser you requested them from.'}</p>
        <Link to="/forgot-password" className="btn-primary mt-5 w-full">
          Send a new link
        </Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Choose a new password" subtitle={<>For {session.user.email}</>}>
      <form ref={formRef} onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="pw">
            New password
          </label>
          <input
            id="pw"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...fieldProps('pw', fieldErrors, 'pw-help')}
          />
          <FieldError id="pw-error" message={fieldErrors.pw} />
          <p id="pw-help" className="faint mt-1 text-xs">
            At least 8 characters.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="pw2">
            Confirm new password
          </label>
          <input id="pw2" type="password" autoComplete="new-password" required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} {...fieldProps('pw2', fieldErrors)} />
          <FieldError id="pw2-error" message={fieldErrors.pw2} />
        </div>
        <FormError message={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthLayout>
  );
}
