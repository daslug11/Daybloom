import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Loader2, Mic, RotateCcw, Send, Square, Trash2, X } from 'lucide-react';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { atlasKey, useAtlasMessages } from '../../hooks/data/atlas';
import { useAiStatus, useAiStatusUpdater } from '../../hooks/useAi';
import { useUserId } from '../../hooks/useAuth';
import { useInvalidateUserData } from '../../hooks/useInvalidateAll';
import { useOverlay } from '../../hooks/useOverlay';
import { useProfile } from '../../hooks/useProfile';
import { useToast } from '../../hooks/useToast';
import { apiFetch, ApiError, atlasStream } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { AtlasAction } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Markdown } from '../notes/Markdown';
import { PlanCard } from '../plans/PlanCard';
import { AiAllowance } from '../ui/Ai';
import { OrbGlyph, takePointerOpen } from './AtlasOrb';

const SUGGESTIONS = ["What's on today?", 'Add a task to call the bank tomorrow at 10', 'Process my inbox', 'Make me a 4-week workout plan'];

/**
 * The message being sent and Atlas's reply to it, until the saved history takes over.
 * - streaming: the reply is arriving.
 * - stopped: the user pressed Stop; the partial reply stays until the next message.
 * - notSent: the request never reached Atlas (network, limit, pause); the message is kept with Retry.
 * - failed: the connection dropped mid-reply; what arrived stays, with the error.
 * - notice: the reply finished but reported an error; only the error is shown (history holds the rest).
 */
interface Turn {
  message: string;
  state: 'streaming' | 'stopped' | 'notSent' | 'failed' | 'notice';
  text: string;
  actions: AtlasAction[];
  error?: string;
}

interface Pending {
  id: string;
  summary: string;
}

export default function AtlasPanel({ prefill = '', onClose, onVoice }: { prefill?: string; onClose: () => void; onVoice: () => void }) {
  const uid = useUserId();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const history = useAtlasMessages();
  const status = useAiStatus();
  const updateStatus = useAiStatusUpdater();
  const invalidate = useInvalidateUserData();
  const toast = useToast();
  const [input, setInput] = useState(prefill);
  const [turn, setTurn] = useState<Turn | null>(null);
  /** What the sr-only status says: "Atlas is thinking…" while a reply streams, then one short summary. */
  const [announce, setAnnounce] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  /** The pending Delete/Keep being sent to the server; both its buttons are disabled meanwhile. */
  const [deciding, setDeciding] = useState<string | null>(null);
  const sending = turn?.state === 'streaming';
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  /** Whether the transcript was scrolled to (near) the bottom before the last update. */
  const pinned = useRef(true);
  const abort = useRef<AbortController | null>(null);
  // The newest saved message id when the current reply started. Saved messages after it are the
  // reply being shown live, so a refetch mid-reply (or a shifted 50-message window) can't show it twice.
  // -1 = history wasn't loaded yet: hide saved messages until the reply ends.
  const shownUpTo = useRef<number | null>(null);

  const pending = useQuery({
    queryKey: ['atlas_pending', uid],
    queryFn: async () => {
      const { data } = await supabase
        .from('atlas_pending_actions')
        .select('id, summary')
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
        .order('created_at');
      return (data ?? []) as Pending[];
    },
  });

  const root = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  useOverlay({ open: true, onEscape: onClose, container: root });
  // Opened from the orb with a pointer: slide in from the right edge. Keyboard opens (⌘J) and
  // reduced motion show the panel instantly.
  useEffect(() => {
    if (!takePointerOpen() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';
    sheet.current?.animate?.([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: 240, easing: ease });
    scrim.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: ease });
  }, []);
  // Closing the panel stops a reply that is still streaming.
  useEffect(() => () => abort.current?.abort(), []);

  // Follow new content only when the reader is already at the bottom; someone scrolled up to
  // re-read history isn't yanked down by every streamed word.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [history.data, turn, pending.data]);

  // The composer grows with its text (up to its max height) instead of scrolling a single row.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [input]);

  const patch = (fn: (t: Turn) => Partial<Turn>) => setTurn((t) => (t ? { ...t, ...fn(t) } : t));

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setInput((current) => (current.trim() === message ? '' : current));
    shownUpTo.current = history.data ? (history.data[history.data.length - 1]?.id ?? 0) : -1;
    pinned.current = true;
    setTurn({ message, state: 'streaming', text: '', actions: [] });
    setAnnounce('Atlas is thinking…');
    const ctrl = new AbortController();
    abort.current = ctrl;
    let error: string | undefined;
    try {
      for await (const ev of atlasStream(message, 'chat', ctrl.signal)) {
        if (ev.t === 'text') patch((t) => ({ text: t.text + ev.v }));
        else if (ev.t === 'action') {
          patch((t) => ({ actions: [...t.actions, { tool: ev.tool, summary: ev.summary, ok: ev.ok, plan_id: ev.plan_id }] }));
          if (ev.plan_id) invalidate();
        } else if (ev.t === 'confirm') qc.invalidateQueries({ queryKey: ['atlas_pending', uid] });
        else if (ev.t === 'error') {
          error = ev.message;
          patch(() => ({ error: ev.message }));
        } else if (ev.t === 'done') updateStatus(ev.remaining);
      }
    } catch (err) {
      if (ctrl.signal.aborted) return stopped(ctrl);
      if (err instanceof ApiError) {
        // Turned away before Atlas saw it: keep the message so it can be retried or edited.
        if (err.data.reason === 'daily_limit') updateStatus(0);
        if (String(err.data.reason ?? '').startsWith('paused')) updateStatus(null, { enabled: false, paused: true, message: err.message });
        patch(() => ({ state: 'notSent', text: '', actions: [], error: err.message }));
        setAnnounce('Message not sent.');
      } else {
        // The connection dropped mid-reply. The message reached Atlas, so it isn't offered for retry.
        patch(() => ({ state: 'failed', error: 'The connection dropped before Atlas finished. Atlas may still have made the changes it started.' }));
        setAnnounce('');
        invalidate();
      }
      return;
    }
    if (ctrl.signal.aborted) return stopped(ctrl);
    await qc.invalidateQueries({ queryKey: atlasKey(uid) });
    invalidate();
    shownUpTo.current = null;
    setTurn(error ? { message, state: 'notice', text: '', actions: [], error } : null);
    setAnnounce(error ? '' : 'Atlas replied.');
  };

  /** After Stop: keep what arrived, and refresh anything Atlas may already have changed. */
  const stopped = (ctrl: AbortController) => {
    if (abort.current !== ctrl) return;
    patch(() => ({ state: 'stopped' }));
    setAnnounce('Stopped.');
    invalidate();
    // The reply's "done" (with the new allowance) never arrives, so ask the server.
    updateStatus(null);
  };

  const stop = () => abort.current?.abort();

  useEffect(() => {
    if (prefill) send(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (p: Pending, approve: boolean) => {
    if (deciding) return;
    setDeciding(p.id);
    try {
      await apiFetch('/api/atlas', { action: 'confirm', id: p.id, approve });
      // Keep the buttons disabled until the card is gone, so it can't be decided twice.
      await qc.invalidateQueries({ queryKey: ['atlas_pending', uid] });
      invalidate();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That did not work.');
      await qc.invalidateQueries({ queryKey: ['atlas_pending', uid] });
    } finally {
      setDeciding(null);
    }
  };

  const clearHistory = async () => {
    if (clearing) return;
    setClearing(true);
    const { error } = await supabase.from('atlas_messages').delete().eq('user_id', uid);
    setClearing(false);
    if (error) {
      toast("Couldn't clear the conversation. Please try again.");
      return;
    }
    setConfirmClear(false);
    setTurn(null);
    shownUpTo.current = null;
    qc.invalidateQueries({ queryKey: atlasKey(uid) });
  };

  const all = history.data ?? [];
  const upTo = turn && turn.state !== 'notice' ? shownUpTo.current : null;
  const messages = upTo === null ? all : all.filter((m) => upTo >= 0 && m.id <= upTo);
  const aiOff = status.data && (!status.data.enabled || status.data.remaining <= 0);
  const offMessage = status.data?.message ?? "You've used today's AI allowance. It resets at midnight UTC.";
  const empty = !history.isLoading && messages.length === 0 && !turn;
  const name = profile?.name || 'there';

  return createPortal(
    <div ref={root} className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Atlas assistant">
      <div ref={scrim} className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <aside ref={sheet} className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-overlay shadow-modal">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <OrbGlyph size={28} active={!!sending} />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">Atlas</h2>
            <p className="muted truncate text-xs">Your assistant — can read and change your Daybloom data.</p>
          </div>
          <button className="icon-btn" onClick={onVoice} aria-label="Switch to voice mode" title="Voice mode">
            <Mic size={17} />
          </button>
          {messages.length > 0 && (
            <button className="icon-btn" onClick={() => setConfirmClear(true)} aria-label="Clear conversation" title="Clear conversation">
              <Trash2 size={16} />
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close Atlas">
            <X size={18} />
          </button>
        </header>

        {confirmClear && (
          <div className="flex items-center gap-2 border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm">
            <span className="flex-1">Clear your whole conversation with Atlas?</span>
            <button className="btn-danger !px-3 !py-1.5" onClick={clearHistory} disabled={clearing} aria-busy={clearing || undefined}>
              {clearing && <Loader2 size={14} className="animate-spin" aria-hidden />}
              Clear
            </button>
            <button className="btn-ghost !px-3 !py-1.5" onClick={() => setConfirmClear(false)} disabled={clearing}>
              Keep
            </button>
          </div>
        )}

        {/* Announces the state of a reply once, never token by token; errors use their own role="alert". */}
        <p className="sr-only" role="status">
          {announce}
        </p>

        <div
          ref={scroller}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {history.isLoading && <p className="muted text-sm">Loading conversation…</p>}
          {empty && (
            <div className="py-6 text-center">
              <OrbGlyph size={48} />
              <p className="mt-3 font-semibold">Good to see you, {name}.</p>
              <p className="muted mx-auto mt-1 max-w-xs text-sm">
                Ask me to add or finish tasks, sort your inbox, block time, log habits, make a plan (workouts, study, reading…) or tell you what's on. Each reply uses one of your daily AI actions.
              </p>
              {aiOff ? (
                <p className="mx-auto mt-4 max-w-xs rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{offMessage}</p>
              ) : (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chip-off" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} text={m.content} actions={m.actions} />
          ))}
          {turn?.state === 'notSent' ? (
            <div>
              <Bubble role="user" text={turn.message} actions={NO_ACTIONS} />
              <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
                <span className="font-semibold text-danger">Not sent</span>
                <button type="button" className="link inline-flex min-h-8 items-center gap-1" onClick={() => send(turn.message)} disabled={!!aiOff} aria-label="Retry sending">
                  <RotateCcw size={12} aria-hidden /> Retry
                </button>
                <button
                  type="button"
                  className="link min-h-8"
                  aria-label="Edit message"
                  onClick={() => {
                    setInput(turn.message);
                    setTurn(null);
                    textarea.current?.focus();
                  }}
                >
                  Edit
                </button>
              </div>
              <p role="alert" className="mt-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {turn.error}
              </p>
            </div>
          ) : turn?.state === 'notice' ? (
            <p role="alert" className="mr-6 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {turn.error}
            </p>
          ) : turn ? (
            <>
              <Bubble role="user" text={turn.message} actions={NO_ACTIONS} />
              {turn.text || turn.actions.length || turn.error ? (
                <Bubble role="assistant" text={turn.text} actions={turn.actions} error={turn.error} streaming={sending} />
              ) : sending ? (
                <p className="muted flex items-center gap-2 text-sm" aria-hidden>
                  <OrbGlyph size={16} active /> Atlas is thinking…
                </p>
              ) : null}
              {turn.state === 'stopped' && <p className="faint text-xs">Stopped. Atlas keeps any change it had already made.</p>}
            </>
          ) : null}
          {(pending.data ?? []).map((p) => (
            <div key={p.id} className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm" aria-busy={deciding === p.id || undefined}>
              <p className="font-medium [overflow-wrap:anywhere]">{p.summary}?</p>
              <p className="muted mt-0.5 text-xs">Atlas is asking first. This can't be undone.</p>
              <div className="mt-2 flex gap-2">
                <button className="btn-danger !px-3 !py-1.5" onClick={() => decide(p, true)} disabled={!!deciding}>
                  {deciding === p.id && <Loader2 size={14} className="animate-spin" aria-hidden />}
                  Delete
                </button>
                <button className="btn-ghost !px-3 !py-1.5" onClick={() => decide(p, false)} disabled={!!deciding}>
                  Keep
                </button>
              </div>
            </div>
          ))}
        </div>

        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          {aiOff && !empty && <p className="mb-2 text-xs text-warning">{offMessage}</p>}
          <div className="flex items-end gap-2">
            <label htmlFor="atlas-input" className="sr-only">
              Message Atlas
            </label>
            <textarea
              ref={textarea}
              id="atlas-input"
              // On touch screens, opening the panel shouldn't throw the keyboard over the conversation.
              autoFocus={typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches}
              rows={1}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={aiOff ? 'AI is unavailable right now' : 'Ask Atlas…'}
              disabled={!!aiOff}
              dir="auto"
              className="input max-h-32 resize-none overflow-y-auto"
            />
            {sending ? (
              <button type="button" className="btn-ghost !px-3" onClick={stop} aria-label="Stop" title="Stop the reply">
                <Square size={14} className="fill-current" aria-hidden />
              </button>
            ) : (
              <button type="submit" className="btn-primary !px-3" disabled={!input.trim() || !!aiOff} aria-label="Send">
                <Send size={16} aria-hidden />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <AiAllowance />
            <span className="faint text-xs">Enter to send · Esc to close</span>
          </div>
        </form>
      </aside>
    </div>,
    document.body,
  );
}

const NO_ACTIONS: AtlasAction[] = [];

/**
 * One message. Memoised: while a reply streams the panel re-renders per token, and re-parsing
 * the Markdown of every saved message each time made long conversations stutter.
 */
const Bubble = memo(function Bubble({ role, text, actions, error, streaming }: { role: 'user' | 'assistant'; text: string; actions: AtlasAction[]; error?: string; streaming?: boolean }) {
  if (role === 'user') {
    return (
      <div className="ml-10 rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm text-accent-ink">
        <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {text}
        </p>
      </div>
    );
  }
  const shownActions = actions.filter((a) => a.tool !== 'confirm');
  return (
    <div className="mr-6 min-w-0">
      {text && (
        <div dir="auto" className="min-w-0 rounded-2xl rounded-bl-md bg-raised px-3.5 py-2.5 [overflow-wrap:anywhere]">
          <Markdown text={text} />
          {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-atlas align-middle" aria-hidden />}
        </div>
      )}
      {shownActions.length > 0 && (
        <ul className="mt-1.5 space-y-1" aria-label="What Atlas did">
          {shownActions.map((a, i) => (
            <li key={i} className={cn('flex items-start gap-1.5 text-xs', a.ok ? 'text-success' : 'text-danger')}>
              {a.ok ? <Check size={13} className="mt-0.5 shrink-0" aria-hidden /> : <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />}
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {!a.ok && <span className="font-semibold">Didn't work: </span>}
                {a.summary}
              </span>
            </li>
          ))}
        </ul>
      )}
      {actions
        .filter((a) => a.plan_id)
        .map((a) => (
          <div key={a.plan_id} className="mt-2">
            <PlanCard planId={a.plan_id!} />
          </div>
        ))}
      {error && (
        <p role="alert" className="mt-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
