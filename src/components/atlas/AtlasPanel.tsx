import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Mic, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { OrbGlyph } from './AtlasOrb';

const SUGGESTIONS = ["What's on today?", 'Add a task to call the bank tomorrow at 10', 'Process my inbox', 'Make me a 4-week workout plan'];

interface Live {
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
  const [sending, setSending] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  // How many saved messages existed when the current reply started; a refetch mid-reply must not show it twice.
  const shownCount = useRef<number | null>(null);

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
  useOverlay({ open: true, onEscape: onClose, container: root });
  // Closing the panel stops a reply that is still streaming.
  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [history.data, live, sending, pending.data]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setInput('');
    shownCount.current = history.data?.length ?? 0;
    setSending(message);
    setLive({ text: '', actions: [] });
    abort.current = new AbortController();
    try {
      for await (const ev of atlasStream(message, 'chat', abort.current.signal)) {
        if (ev.t === 'text') setLive((l) => ({ ...l!, text: l!.text + ev.v }));
        else if (ev.t === 'action') {
          setLive((l) => ({ ...l!, actions: [...l!.actions, { tool: ev.tool, summary: ev.summary, ok: ev.ok, plan_id: ev.plan_id }] }));
          if (ev.plan_id) invalidate();
        }
        else if (ev.t === 'confirm') qc.invalidateQueries({ queryKey: ['atlas_pending', uid] });
        else if (ev.t === 'error') setLive((l) => ({ ...l!, error: ev.message }));
        else if (ev.t === 'done') updateStatus(ev.remaining);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Atlas is unavailable right now.';
      setLive({ text: '', actions: [], error: msg });
      if (err instanceof ApiError && err.data.reason === 'daily_limit') updateStatus(0);
      if (err instanceof ApiError && String(err.data.reason ?? '').startsWith('paused')) updateStatus(null, { enabled: false, paused: true, message: err.message });
      setSending(null);
      shownCount.current = null;
      return;
    }
    await qc.invalidateQueries({ queryKey: atlasKey(uid) });
    invalidate();
    shownCount.current = null;
    setSending(null);
    setLive(null);
  };

  useEffect(() => {
    if (prefill) send(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (p: Pending, approve: boolean) => {
    try {
      await apiFetch('/api/atlas', { action: 'confirm', id: p.id, approve });
      invalidate();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That did not work.');
      qc.invalidateQueries({ queryKey: ['atlas_pending', uid] });
    }
  };

  const clearHistory = async () => {
    await supabase.from('atlas_messages').delete().eq('user_id', uid);
    setConfirmClear(false);
    qc.invalidateQueries({ queryKey: atlasKey(uid) });
  };

  const all = history.data ?? [];
  const messages = live && shownCount.current !== null ? all.slice(0, shownCount.current) : all;
  const aiOff = status.data && (!status.data.enabled || status.data.remaining <= 0);
  const name = profile?.name || 'there';

  return createPortal(
    <div ref={root} className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Atlas assistant">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <aside className="relative flex h-full w-full max-w-md animate-fade-in flex-col border-l border-line bg-overlay shadow-modal">
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
            <button className="btn-danger !px-3 !py-1.5" onClick={clearHistory}>
              Clear
            </button>
            <button className="btn-ghost !px-3 !py-1.5" onClick={() => setConfirmClear(false)}>
              Keep
            </button>
          </div>
        )}

        <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          {history.isLoading && <p className="muted text-sm">Loading conversation…</p>}
          {!history.isLoading && messages.length === 0 && !sending && (
            <div className="py-6 text-center">
              <OrbGlyph size={48} />
              <p className="mt-3 font-semibold">Good to see you, {name}.</p>
              <p className="muted mx-auto mt-1 max-w-xs text-sm">
                Ask me to add or finish tasks, sort your inbox, block time, log habits, make a plan (workouts, study, reading…) or tell you what's on. Each reply uses one of your daily AI actions.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip-off" onClick={() => send(s)} disabled={!!aiOff}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} text={m.content} actions={m.actions} />
          ))}
          {sending && <Bubble role="user" text={sending} actions={[]} />}
          {live && (live.text || live.actions.length || live.error) ? (
            <Bubble role="assistant" text={live.text} actions={live.actions} error={live.error} streaming={!!sending} />
          ) : sending ? (
            <p className="muted flex items-center gap-2 text-sm" role="status">
              <OrbGlyph size={16} active /> Atlas is thinking…
            </p>
          ) : null}
          {(pending.data ?? []).map((p) => (
            <div key={p.id} className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium">Confirm: {p.summary}?</p>
              <p className="muted mt-0.5 text-xs">This can't be undone.</p>
              <div className="mt-2 flex gap-2">
                <button className="btn-danger !px-3 !py-1.5" onClick={() => decide(p, true)}>
                  <Check size={14} /> Confirm
                </button>
                <button className="btn-ghost !px-3 !py-1.5" onClick={() => decide(p, false)}>
                  Cancel
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
          {aiOff && <p className="mb-2 text-xs text-warning">{status.data?.message ?? "You've used today's AI allowance. It resets at midnight UTC."}</p>}
          <div className="flex items-end gap-2">
            <label htmlFor="atlas-input" className="sr-only">
              Message Atlas
            </label>
            <textarea
              id="atlas-input"
              autoFocus
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
              className="input max-h-32 resize-none"
            />
            <button type="submit" className="btn-primary !px-3" disabled={!input.trim() || !!sending || !!aiOff} aria-label="Send">
              <Send size={16} />
            </button>
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

function Bubble({ role, text, actions, error, streaming }: { role: 'user' | 'assistant'; text: string; actions: AtlasAction[]; error?: string; streaming?: boolean }) {
  if (role === 'user') {
    return (
      <div className="ml-10 rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm text-accent-ink">
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    );
  }
  const shownActions = actions.filter((a) => a.tool !== 'confirm');
  return (
    <div className="mr-6">
      {text && (
        <div className="rounded-2xl rounded-bl-md bg-raised px-3.5 py-2.5">
          <Markdown text={text} />
          {streaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-atlas align-middle" aria-hidden />}
        </div>
      )}
      {shownActions.length > 0 && (
        <ul className="mt-1.5 space-y-1" aria-label="What Atlas did">
          {shownActions.map((a, i) => (
            <li key={i} className={cn('flex items-start gap-1.5 text-xs', a.ok ? 'text-success ' : 'text-danger')}>
              <Check size={13} className="mt-0.5 shrink-0" aria-hidden /> {a.summary}
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
}
