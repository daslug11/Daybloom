import { Check, Download, Eye, EyeOff, ListChecks, LogOut, MailCheck, Play, Shield, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { importedFromThisDevice, openLocalImport, useLocalImportPending } from '../../components/onboarding/LocalImportPrompt';
import { Card, CardTitle } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Switch } from '../../components/ui/Switch';
import { useAiStatus } from '../../hooks/useAi';
import { useAppActions } from '../../hooks/useAppActions';
import { useAuth } from '../../hooks/useAuth';
import { applyTheme, useProfile, useUpdateProfile } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { apiFetch, ApiError } from '../../lib/api';
import { SITE_URL } from '../../lib/env';
import { localDataSummary } from '../../lib/localImport';
import { loadVoices, pickVoice, speak, speechInputSupported, speechOutputSupported } from '../../lib/speech';
import { supabase } from '../../lib/supabase';
import type { Profile, VoiceSettings } from '../../lib/types';

const EXPORT_TABLES = ['profiles', 'notes', 'tasks', 'goals', 'milestones', 'habits', 'habit_logs', 'moods', 'focus_sessions', 'calendar_groups', 'calendars', 'atlas_messages', 'plans', 'block_series', 'series_occurrences'] as const;
/** Rows per request when exporting. The API caps a single response, so every table is paged until a short page. */
const EXPORT_PAGE = 1000;
/** A stable order for paging; tables without an `id` column use their primary key. */
const EXPORT_ORDER: Partial<Record<(typeof EXPORT_TABLES)[number], string[]>> = { habit_logs: ['habit_id', 'day'], moods: ['day'], series_occurrences: ['series_id', 'day'] };

function Row({ label, hint, children, htmlFor, status }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string; status?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </label>
          {status}
        </div>
        {hint && <p className="faint text-xs [text-wrap:pretty]">{hint}</p>}
      </div>
      <div className="shrink-0 sm:max-w-[60%]">{children}</div>
    </div>
  );
}

/** A small "Saved" confirmation next to a field. The live region always exists so the change is announced. */
function Saved({ show }: { show: boolean }) {
  return (
    <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-success">
      {show && (
        <>
          <Check size={13} strokeWidth={3} aria-hidden /> Saved
        </>
      )}
    </span>
  );
}

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['UTC'];
  }
}

type ProfilePatch = Partial<Omit<Profile, 'id' | 'created_at'>>;

/**
 * A voice slider that keeps its own value while it moves, and saves once: on release
 * (pointer up, key up, blur) or 300ms after the last change. It only follows the saved
 * value again once that save has settled, so it never snaps back mid-drag.
 */
function VoiceSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onCommit: (v: number, done: () => void) => void;
}) {
  const [local, setLocal] = useState(value);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const timer = useRef(0);
  const latest = useRef(value);
  latest.current = local;
  // The debounce timer fires from an older render; read the current saved value and callback.
  const saved = useRef(value);
  saved.current = value;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (!dirty.current && !inFlight.current) setLocal(value);
  }, [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = () => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    if (latest.current === saved.current) return;
    inFlight.current = true;
    onCommitRef.current(latest.current, () => {
      inFlight.current = false;
      // After a failed save the cache rolls back; follow it on the next tick unless the user is dragging again.
      window.setTimeout(() => !dirty.current && setLocal(saved.current), 0);
    });
  };

  return (
    <Row label={`${label} · ${format(local)}`} htmlFor={id}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        onChange={(e) => {
          dirty.current = true;
          setLocal(Number(e.target.value));
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(commit, 300);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="h-6 w-full accent-ink sm:w-48"
      />
    </Row>
  );
}

/** New-password field with a show/hide toggle and a live 8-character check. */
function NewPassword({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string }) {
  const [show, setShow] = useState(false);
  const n = value.length;
  const hint = !n ? 'At least 8 characters.' : n < 8 ? `${8 - n} more character${8 - n === 1 ? '' : 's'} needed.` : 'Long enough.';
  return (
    <div className="min-w-0 flex-1">
      <div className="relative">
        <input
          id="s-pass"
          type={show ? 'text' : 'password'}
          minLength={8}
          required
          className="input pr-11"
          placeholder="New password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 's-pass-error s-pass-hint' : 's-pass-hint'}
        />
        <button type="button" className="icon-btn absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2" aria-label="Show password" aria-pressed={show} onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        </button>
      </div>
      {error && (
        <p id="s-pass-error" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <p id="s-pass-hint" className={`mt-1 flex items-center gap-1 text-xs ${n >= 8 ? 'text-success' : 'faint'}`}>
        {n >= 8 && <Check size={12} strokeWidth={3} aria-hidden />}
        {hint}
      </p>
    </div>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const { data: ai } = useAiStatus();
  const { startTour } = useAppActions();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [emailUpdated, setEmailUpdated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [exported, setExported] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const savedTimer = useRef(0);
  const importOpen = useLocalImportPending();

  useEffect(() => setName(profile?.name ?? ''), [profile?.name]);
  useEffect(() => {
    loadVoices().then((v) => setVoices(v.filter((x) => /^en/i.test(x.lang))));
  }, []);
  // A requested email change waits for both confirmation links; Supabase keeps it on the user as new_email.
  useEffect(() => setPendingEmail(user?.new_email ?? ''), [user?.new_email]);
  // Arriving from the second confirmation link (AuthCallback → ?email=updated).
  useEffect(() => {
    if (params.get('email') !== 'updated') return;
    setEmailUpdated(true);
    setPendingEmail('');
    params.delete('email');
    setParams(params, { replace: true });
  }, [params, setParams]);
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  if (!profile || !user) return null;
  const voice: VoiceSettings = profile.voice ?? {};
  const autoVoice = pickVoice(voices);
  const zones = timeZones();
  const localData = !importOpen && !importedFromThisDevice(user.id) && localDataSummary() !== null;

  /** Saves a profile change; `field` gets an inline "Saved" tick, and a failure is never silent. */
  const save = (patch: ProfilePatch, field?: string) =>
    update.mutate(patch, {
      onSuccess: () => {
        if (!field) return;
        setSaved(field);
        window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(() => setSaved(null), 2500);
      },
      onError: () => toast('Couldn’t save that change. Check your connection and try again.'),
    });
  const setVoice = (patch: Partial<VoiceSettings>) => save({ voice: { ...voice, ...patch } });
  /** A slider save: merges into the voice settings and tells the slider when the save has settled. */
  const commitVoice = (patch: Partial<VoiceSettings>, done: () => void) =>
    update.mutate({ voice: { ...voice, ...patch } }, { onError: () => toast('Couldn’t save that change. Check your connection and try again.'), onSettled: done });

  const changeEmail = async () => {
    const next = email.trim();
    setBusy('email');
    const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: `${SITE_URL}/auth/callback?type=email_change` });
    setBusy(null);
    if (error) return toast(error.message);
    setEmail('');
    setEmailUpdated(false);
    setPendingEmail(next);
  };

  const changePassword = async () => {
    if (password.length < 8) {
      setPasswordError(`Use at least 8 characters (you have ${password.length}).`);
      document.getElementById('s-pass')?.focus();
      return;
    }
    setPasswordError('');
    setBusy('password');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) {
      setPasswordError(error.message);
      document.getElementById('s-pass')?.focus();
      return;
    }
    setPassword('');
    toast('Password updated.');
  };

  const exportData = async () => {
    setBusy('export');
    try {
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at } };
      const counts: Record<string, number> = {};
      for (const t of EXPORT_TABLES) {
        const rows: unknown[] = [];
        for (let from = 0; ; from += EXPORT_PAGE) {
          let q = supabase.from(t).select('*');
          for (const col of EXPORT_ORDER[t] ?? ['id']) q = q.order(col, { ascending: true });
          const { data, error } = await q.range(from, from + EXPORT_PAGE - 1);
          if (error) throw error;
          rows.push(...(data ?? []));
          if (!data || data.length < EXPORT_PAGE) break;
        }
        out[t] = rows;
        counts[t] = rows.length;
      }
      out.counts = counts;
      // "Items" are the things you made; the profile row holds your settings, so it isn't counted.
      const items = Object.entries(counts).reduce((sum, [t, n]) => (t === 'profiles' ? sum : sum + n), 0);
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const file = `daybloom-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = URL.createObjectURL(blob);
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setExported(`Exported ${items.toLocaleString()} item${items === 1 ? '' : 's'} to ${file}.`);
    } catch {
      toast('Export failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const closeDelete = () => {
    if (busy === 'delete') return;
    setDeleting(false);
    setConfirmText('');
  };
  const confirmed = confirmText.trim().toUpperCase() === 'DELETE';

  const deleteAccount = async () => {
    setBusy('delete');
    try {
      await apiFetch('/api/account', { action: 'delete', confirm: 'DELETE' });
      await supabase.auth.signOut({ scope: 'local' });
      navigate('/', { replace: true });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not delete your account.');
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Your profile, how Atlas sounds, your login details and your data." />
      <div className="space-y-4">
        <Card>
          <CardTitle>Profile</CardTitle>
          <Row label="Name" hint="Used in greetings and by Atlas." htmlFor="s-name" status={<Saved show={saved === 'name'} />}>
            <input
              id="s-name"
              className="input"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== profile.name && save({ name: name.trim() }, 'name')}
            />
          </Row>
          <Row label="Time zone" hint="Decides when your day starts and ends." htmlFor="s-tz" status={<Saved show={saved === 'timezone'} />}>
            <select id="s-tz" className="input" value={profile.timezone} onChange={(e) => save({ timezone: e.target.value }, 'timezone')}>
              {!zones.includes(profile.timezone) && <option value={profile.timezone}>{profile.timezone}</option>}
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Theme" status={<Saved show={saved === 'theme'} />}>
            <div className="flex gap-2" role="radiogroup" aria-label="Theme">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={profile.theme === t}
                  className={profile.theme === t ? 'chip-on' : 'chip-off'}
                  onClick={() => {
                    applyTheme(t);
                    save({ theme: t }, 'theme');
                  }}
                >
                  {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Product tour" hint="A 1-minute walk through the main parts of the app.">
            <button className="btn-ghost" onClick={startTour}>
              <Play size={14} /> Replay tour
            </button>
          </Row>
          {profile.checklist_dismissed_at && (
            <Row label="Getting started checklist" hint="The list of first steps on your dashboard. You hid it; bring it back any time.">
              <button className="btn-ghost" onClick={() => save({ checklist_dismissed_at: null }, 'checklist')}>
                <ListChecks size={14} /> Show it again
              </button>
            </Row>
          )}
        </Card>

        <Card>
          <CardTitle>Atlas voice</CardTitle>
          {!speechOutputSupported() && <p className="muted mb-2 text-sm">This browser can’t speak. Voice mode still works with typing.</p>}
          {!speechInputSupported() && <p className="muted mb-2 text-sm">This browser doesn’t support speech recognition (Chrome, Edge and Safari do). You can still type in voice mode.</p>}
          <Row label="Voice" hint="Atlas prefers a British male voice when your device has one." htmlFor="s-voice">
            <div className="flex gap-2">
              <select id="s-voice" className="input" value={voice.voiceURI ?? ''} onChange={(e) => setVoice({ voiceURI: e.target.value || undefined })} disabled={!voices.length}>
                <option value="">Automatic{autoVoice ? ` (${autoVoice.name})` : ''}</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </select>
              <button
                className="btn-ghost shrink-0"
                disabled={!speechOutputSupported()}
                onClick={() => speak(`Good day, ${profile.name || 'there'}. Atlas at your service.`, voice)}
              >
                <Play size={14} /> Test
              </button>
            </div>
          </Row>
          <VoiceSlider id="s-rate" label="Speed" value={voice.rate ?? 1} min={0.7} max={1.4} step={0.05} format={(v) => `${v.toFixed(2)}×`} onCommit={(rate, done) => commitVoice({ rate }, done)} />
          <VoiceSlider id="s-pitch" label="Pitch" value={voice.pitch ?? 0.85} min={0.5} max={1.5} step={0.05} format={(v) => v.toFixed(2)} onCommit={(pitch, done) => commitVoice({ pitch }, done)} />
          <Row label="Speak replies aloud" hint="In voice mode, Atlas reads its answers out.">
            <Switch label="Speak replies aloud" checked={voice.speak !== false} onChange={(v) => setVoice({ speak: v })} />
          </Row>
          <Row label="“Hey Atlas” wake phrase" hint="While voice mode is open, listen for “Hey Atlas” instead of pressing the mic. Your mic stays on while the HUD is open.">
            <Switch label="Hey Atlas wake phrase" checked={!!voice.wakeWord} onChange={(v) => setVoice({ wakeWord: v })} />
          </Row>
        </Card>

        <Card>
          <CardTitle>Account</CardTitle>
          <Row label="Email" hint={`Currently ${user.email}. For safety, you’ll confirm the change from both the old and the new address.`} htmlFor="s-email">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void changeEmail(); }}>
              <input id="s-email" type="email" required className="input" placeholder="new@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <button className="btn-ghost shrink-0" disabled={busy === 'email' || !email.trim()}>
                {busy === 'email' ? 'Sending…' : 'Change'}
              </button>
            </form>
          </Row>
          {(pendingEmail || emailUpdated) && (
            <div role="status" className="mb-3 flex items-start gap-2 rounded-control border border-line bg-raised p-3 text-sm">
              <MailCheck size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              {emailUpdated ? (
                <p>
                  Email updated. You now log in with <strong>{user.email}</strong>.
                </p>
              ) : (
                <p>
                  Change to <strong className="break-all">{pendingEmail}</strong> is waiting for you. We sent confirmation links to {user.email} and {pendingEmail}. Your
                  email changes once you’ve clicked both.
                </p>
              )}
            </div>
          )}
          <Row label="Password" hint="Choose a new password for logging in." htmlFor="s-pass">
            <form
              className="flex items-start gap-2"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void changePassword();
              }}
            >
              <NewPassword
                value={password}
                error={passwordError}
                onChange={(v) => {
                  setPassword(v);
                  if (passwordError && v.length >= 8) setPasswordError('');
                }}
              />
              <button className="btn-ghost shrink-0" disabled={busy === 'password' || !password}>
                {busy === 'password' ? 'Saving…' : 'Update'}
              </button>
            </form>
          </Row>
          <Row label="✨ AI allowance" hint="AI features and Atlas share one daily allowance. It resets at midnight UTC.">
            <span className="text-sm">{ai ? (ai.enabled ? `${ai.remaining} of ${ai.limit} left today` : ai.message ?? 'Unavailable') : '—'}</span>
          </Row>
          <Row label="Log out">
            <button className="btn-ghost" onClick={() => signOut().then(() => navigate('/'))}>
              <LogOut size={14} /> Log out
            </button>
          </Row>
          {ai?.admin && (
            <Row label="Admin" hint="Usage, spend and per-user limits.">
              <Link className="btn-ghost" to="/admin">
                <Shield size={14} /> Open admin
              </Link>
            </Row>
          )}
        </Card>

        <Card>
          <CardTitle>Your data</CardTitle>
          <Row
            label="Export everything"
            hint={exported ? exported : 'Every note, task, habit, goal, plan, repeating block, mood, focus session, calendar and Atlas message, as one JSON file.'}
            status={exported ? <Check size={14} strokeWidth={3} className="text-success" aria-hidden /> : undefined}
          >
            <button className="btn-ghost" onClick={exportData} disabled={busy === 'export'}>
              <Download size={14} /> {busy === 'export' ? 'Preparing…' : 'Download JSON'}
            </button>
          </Row>
          {localData && (
            <Row label="Import from this device" hint="This browser still has data from the earlier, offline-only Daybloom. Skip this if you already imported it — importing twice makes copies.">
              <button className="btn-ghost" onClick={openLocalImport}>
                <Upload size={14} /> Review and import
              </button>
            </Row>
          )}
        </Card>

        <Card>
          <CardTitle>Delete account</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="muted text-sm [text-wrap:pretty]">Permanently deletes your login and all of your data. This can’t be undone, so export first if you might want it later.</p>
            <button className="btn-danger shrink-0" onClick={() => setDeleting(true)}>
              Delete account…
            </button>
          </div>
        </Card>
        <p className="faint text-xs">
          <Link to="/terms" className="link">Terms</Link> · <Link to="/privacy" className="link">Privacy</Link>
        </p>
      </div>

      {deleting && (
        <Modal open onClose={closeDelete} title="Delete your account?" description="This removes your login and every piece of data you’ve stored in Daybloom. There is no undo.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (confirmed) void deleteAccount();
            }}
          >
            <div className="text-sm" role="status">
              {busy === 'export' ? (
                <p>Preparing your export…</p>
              ) : exported ? (
                <p className="flex items-center gap-1.5">
                  <Check size={14} strokeWidth={3} className="text-success" aria-hidden /> {exported}
                </p>
              ) : (
                <p>
                  Consider <button type="button" className="link" onClick={exportData}>exporting your data</button> first.
                </p>
              )}
            </div>
            <label className="block">
              <span className="label">Type DELETE to confirm</span>
              <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={closeDelete} disabled={busy === 'delete'}>
                Cancel
              </button>
              <button className="btn-danger" disabled={!confirmed || busy === 'delete'}>
                {busy === 'delete' ? 'Deleting…' : 'Delete everything'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
