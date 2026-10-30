import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SITE_URL } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  AuthLayout,
  authMessage,
  emailProblem,
  FieldError,
  fieldProps,
  focusFirstInvalid,
  FormError,
  hasErrors,
  SendAgain,
  type FieldErrors,
} from "./AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: FieldErrors = { email: emailProblem(email) };
    setFieldErrors(errs);
    if (hasErrors(errs)) return focusFirstInvalid(formRef.current, errs);
    setBusy(true);
    const err = await sendLink();
    setBusy(false);
    if (err) return setError(err);
    setSent(true);
  };
  async function sendLink() {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    return error ? authMessage(error) : "";
  }
  return (
    <AuthLayout
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={
        sent
          ? undefined
          : "Enter your email and we’ll send you a link to choose a new password."
      }
      footer={
        <Link to="/login" className="link">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <>
          <p className="text-sm">
            If there’s an account for <strong>{email}</strong>, a reset link is
            on its way. Open it on this device; it expires in an hour.
          </p>
          <SendAgain send={sendLink} />
        </>
      ) : (
        <form ref={formRef} onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              {...fieldProps("email", fieldErrors)}
            />
            <FieldError id="email-error" message={fieldErrors.email} />
          </div>
          <FormError message={error} />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
