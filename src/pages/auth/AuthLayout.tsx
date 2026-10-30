import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/layout/Logo";
import { useDocumentTitle } from "../public/useDocumentTitle";

/** Branded frame for sign-up / log-in / reset screens. `pageTitle` is the browser tab title (defaults to the heading). */
export function AuthLayout({
  title,
  pageTitle,
  subtitle,
  children,
  footer,
}: {
  title: string;
  pageTitle?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useDocumentTitle(`${pageTitle ?? title} · Daybloom`);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-8" aria-label="Daybloom home">
        <Logo />
      </Link>
      <main className="card w-full max-w-sm p-6 sm:p-8">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="muted mt-1.5 text-sm">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
      {footer && <div className="muted mt-6 text-sm">{footer}</div>}
      <p className="faint mt-8 text-xs">
        <Link to="/terms" className="hover:underline">
          Terms
        </Link>{" "}
        ·{" "}
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
    <p
      role="alert"
      className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}

/** A message under one field, tied to it with aria-describedby. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-danger">
      {message}
    </p>
  );
}

export type FieldErrors = Partial<Record<string, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** '' when the email looks usable, otherwise what to fix. */
export function emailProblem(email: string): string {
  const v = email.trim();
  if (!v) return "Enter your email address.";
  if (!EMAIL_RE.test(v))
    return "That doesn’t look like an email address. Check for typos.";
  return "";
}

/** Props that connect an input to its FieldError (and, optionally, a hint). */
export function fieldProps(id: string, errors: FieldErrors, hintId?: string) {
  const err = errors[id];
  const describedBy = [err ? `${id}-error` : "", hintId ?? ""]
    .filter(Boolean)
    .join(" ");
  return {
    "aria-invalid": err ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

/**
 * Moves focus to the first field (in DOM order) that has an error. Waits a frame so the
 * error text and aria-describedby are rendered before a screen reader announces the field.
 */
export function focusFirstInvalid(
  form: HTMLFormElement | null,
  errors: FieldErrors,
) {
  if (!form) return;
  requestAnimationFrame(() => {
    const first = [
      ...form.querySelectorAll<HTMLElement>("input, textarea, select"),
    ].find((el) => el.id && errors[el.id]);
    first?.focus();
  });
}

/** True when there is at least one field error. */
export const hasErrors = (errors: FieldErrors) =>
  Object.values(errors).some(Boolean);

/** A neutral confirmation (not an error), announced politely. */
export function FormNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-line bg-raised px-3 py-2 text-sm text-ink"
    >
      {message}
    </p>
  );
}

/**
 * "Send it again" for every "check your email" screen. A link was just sent, so it starts
 * with a short cooldown, and waits a minute between later sends.
 * `send` resolves to an error message, or '' on success.
 */
export function SendAgain({
  send,
  label = "Send it again",
}: {
  send: () => Promise<string>;
  label?: string;
}) {
  const [wait, setWait] = useState(30);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const click = async () => {
    setBusy(true);
    setNotice("");
    setError("");
    const err = await send();
    setBusy(false);
    if (err) return setError(err);
    setNotice("Sent again. Check your inbox, and your spam folder too.");
    setWait(60);
  };

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        className="btn-ghost w-full"
        onClick={click}
        disabled={busy || wait > 0}
      >
        {busy ? "Sending…" : wait > 0 ? `${label} in ${wait}s` : label}
      </button>
      <FormNotice message={notice} />
      <FormError message={error} />
    </div>
  );
}

/** Supabase auth errors → plain language. */
function knownAuthMessage(err: {
  message?: string;
  status?: number;
}): string | null {
  const m = (err.message ?? "").toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don’t match. Try again, or reset your password.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the link we sent.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "There’s already an account with that email. Log in instead.";
  if (m.includes("password should be") || m.includes("weak"))
    return "Choose a stronger password: at least 8 characters.";
  if (m.includes("signups not allowed") || m.includes("user not found"))
    return "No account with that email yet. Sign up first.";
  if (m.includes("rate limit") || err.status === 429)
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("expired") || (m.includes("invalid") && m.includes("link")))
    return "That link has expired or was already used. Request a new one.";
  if (m.includes("same password") || m.includes("different from the old"))
    return "Your new password must be different from the old one.";
  if (m.includes("fetch"))
    return "Can’t reach Daybloom right now. Check your connection.";
  return null;
}

/** Friendly text for an error returned by Supabase Auth. */
export function authMessage(
  err: { message?: string; code?: string; status?: number } | null | undefined,
): string {
  if (!err) return "";
  return (
    knownAuthMessage(err) ??
    err.message ??
    "Something went wrong. Please try again."
  );
}

/**
 * Friendly text for an error that arrived in the URL (e.g. `?error_description=` on an email link).
 * Anyone can put text in a URL, so unknown messages are never shown verbatim.
 */
export function authMessageFromUrl(text: string | null | undefined): string {
  if (!text) return "";
  return (
    knownAuthMessage({ message: text }) ??
    "That didn’t work. Please try again, or request a new link."
  );
}
