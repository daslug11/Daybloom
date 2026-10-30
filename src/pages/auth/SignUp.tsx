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

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const errs: FieldErrors = {
      email: emailProblem(email),
      password: !password
        ? "Choose a password."
        : password.length < 8
          ? `Use at least 8 characters (you have ${password.length}).`
          : "",
      agree: agree
        ? ""
        : "Please agree to the Terms and Privacy Policy to continue.",
    };
    setFieldErrors(errs);
    if (hasErrors(errs)) return focusFirstInvalid(formRef.current, errs);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    });
    setBusy(false);
    if (error) return setError(authMessage(error));
    // Supabase returns a user with no identities when the email already exists (to avoid leaking accounts).
    if (data.user && data.user.identities?.length === 0)
      return setError(
        "There’s already an account with that email. Log in instead.",
      );
    setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={
          <>
            We sent a confirmation link to <strong>{sentTo}</strong>.
          </>
        }
        footer={
          <Link to="/login" className="link">
            Back to log in
          </Link>
        }
      >
        <p className="text-sm">
          Open the link on this device to finish setting up your account. It can
          take a minute to arrive — check your spam folder too.
        </p>
        <SendAgain
          send={async () => {
            const { error } = await supabase.auth.resend({
              type: "signup",
              email: sentTo,
              options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
            });
            return error ? authMessage(error) : "";
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your free account"
      pageTitle="Sign up"
      subtitle="Capture everything, plan your day, build habits — synced across your devices."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="link">
            Log in
          </Link>
        </>
      }
    >
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
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...fieldProps("password", fieldErrors, "pw-help")}
          />
          <FieldError id="password-error" message={fieldErrors.password} />
          <p id="pw-help" className="faint mt-1 text-xs">
            At least 8 characters.
          </p>
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input
              id="agree"
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 accent-ink"
              {...fieldProps("agree", fieldErrors)}
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" className="link" target="_blank">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="link" target="_blank">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <FieldError id="agree-error" message={fieldErrors.agree} />
        </div>
        <FormError message={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating your account…" : "Sign up free"}
        </button>
      </form>
    </AuthLayout>
  );
}
