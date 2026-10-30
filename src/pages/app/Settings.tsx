import { Check, Download, ListChecks, LogOut, MailCheck, Play, Shield, Upload } from 'lucide-react';
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
    if (password.length < 8) return toast('Use at least 8 characters.');
    setBusy('password');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) return toast(error.message);
    setPassword('');
    toast('Password updated.');
  };

  const exportData = async () => {
    setBusy('export');
    try {
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at } };
      for (const t of EXPORT_TABLES) {
        const { data, error } = await supabase.from(t).select('*').limit(50_000);
        if (error) throw error;
        out[t] = data;
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const file = `daybloom-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = URL.createObjectURL(blob);
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setExported(file);
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
          <Row label={`Speed · ${(voice.rate ?? 1).toFixed(2)}×`} htmlFor="s-rate">
            <input id="s-rate" type="range" min={0.7} max={1.4} step={0.05} value={voice.rate ?? 1} onChange={(e) => setVoice({ rate: Number(e.target.value) })} className="h-6 w-full accent-ink sm:w-48" />
          </Row>
          <Row label={`Pitch · ${(voice.pitch ?? 0.85).toFixed(2)}`} htmlFor="s-pitch">
            <input id="s-pitch" type="range" min={0.5} max={1.5} step={0.05} value={voice.pitch ?? 0.85} onChange={(e) => setVoice({ pitch: Number(e.target.value) })} className="h-6 w-full accent-ink sm:w-48" />
          </Row>
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
          <Row label="Password" hint="At least 8 characters." htmlFor="s-pass">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void changePassword(); }}>
              <input id="s-pass" type="password" minLength={8} required className="input" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <button className="btn-ghost shrink-0" disabled={busy === 'password' || !password}>
                Update
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
            hint={exported ? `Downloaded ${exported}.` : 'Every note, task, habit, goal, plan, repeating block, mood, focus session, calendar and Atlas message, as one JSON file.'}
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
                  <Check size={14} strokeWidth={3} className="text-success" aria-hidden /> Exported to {exported}.
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
