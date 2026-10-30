import { useQueryClient } from '@tanstack/react-query';
import { Keyboard, Mic, MicOff, Square, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { atlasKey } from '../../hooks/data/atlas';
import { usePlans } from '../../hooks/data/plans';
import { useTasks } from '../../hooks/data/tasks';
import { useAiStatus, useAiStatusUpdater } from '../../hooks/useAi';
import { useUserId } from '../../hooks/useAuth';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useInvalidateUserData } from '../../hooks/useInvalidateAll';
import { useOverlay } from '../../hooks/useOverlay';
import { useProfile, useToday } from '../../hooks/useProfile';
import { ApiError, atlasStream } from '../../lib/api';
import { addDays, dayIn, daysBetween, greeting } from '../../lib/dates';
import { createRecognizer, speak, speechInputSupported, speechOutputSupported, stopSpeaking, type Recognizer } from '../../lib/speech';
import { cn } from '../../lib/utils';
import { PlanCard } from '../plans/PlanCard';
import { AllowanceMeter, BootLine, CountUp, delay, Elapsed, HUD_CSS, HudClock, HudRings, Readout } from './HudParts';
import { useWaveform, type HudPhase } from './useWaveform';

const WAKE = /\bhey,?\s+atlas\b[,.!?]?\s*/i;
const MS_PER_CHAR = 28;
const NO_AI = "You've used today's AI allowance. It resets at midnight UTC.";

/** The full boot plays once per page load; reopening voice mode boots quickly. */
let bootedOnce = false;

const PHASE_LABEL: Record<HudPhase, string> = { booting: 'Booting', idle: 'Standing by', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' };

/** "14:30", "Tomorrow 09:00", "Thu 09:00" or "12 Nov 09:00", in the user's time zone. */
function whenLabel(at: number, today: string, tz?: string) {
  const d = new Date(at);
  const key = dayIn(tz, d);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: tz });
  if (key === today) return time;
  if (key === addDays(today, 1)) return `Tomorrow ${time}`;
  if (daysBetween(today, key) < 7) return `${d.toLocaleDateString(undefined, { weekday: 'short', timeZone: tz })} ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: tz })} ${time}`;
}

/** "T−42 MIN" / "T−3 H" for things later today. */
function countdown(at: number, now: number) {
  const mins = Math.max(0, Math.round((at - now) / 60_000));
  return mins < 60 ? `T−${mins} min` : `T−${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ''}`.trim();
}

/**
 * Voice mode: a full-screen holographic HUD. Speak to Atlas (Web Speech API),
 * hear replies (speechSynthesis). Every reply uses one AI action.
 */
export default function VoiceHud({ onClose }: { onClose: () => void }) {
  const uid = useUserId();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  // Minute resolution is enough here; the seconds clock is its own component.
  const { today, minutes, now, tz } = useToday(60_000);
  const { data: tasks = [] } = useTasks();
  const { events } = useCalendarSync();
  const { data: plans } = usePlans();
  const ai = useAiStatus();
  const updateStatus = useAiStatusUpdater();
  const invalidate = useInvalidateUserData();
  const voice = profile?.voice ?? {};
  const name = profile?.name || 'there';

  const reduced = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const touch = useMemo(() => typeof window !== 'undefined' && !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches, []);
  const [fastBoot] = useState(() => bootedOnce || reduced);
  const bootLine = useMemo(() => `Systems online. ${greeting(minutes)}, ${name}.`, []); // eslint-disable-line react-hooks/exhaustive-deps
  const bootMs = fastBoot ? 450 : bootLine.length * MS_PER_CHAR + 350;

  const [phase, setPhase] = useState<HudPhase>('booting');
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState('');
  const [typed, setTyped] = useState('');
  /** Seconds from sending to Atlas's first word, for the last reply. */
  const [latency, setLatency] = useState<number | null>(null);
  /** A plan Atlas drafted during this voice session, shown as a card on screen. */
  const [planId, setPlanId] = useState<string | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(!speechInputSupported());
  /** Wake-phrase listening stopped after a real error (mic blocked, no mic, offline) until the orb is tapped. */
  const [wakePaused, setWakePaused] = useState(false);
  /** The screen-reader status: "Voice mode ready", a notice, or a finished reply. Never per character or token. */
  const [announce, setAnnounce] = useState('');

  const root = useRef<HTMLDivElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const typedInput = useRef<HTMLInputElement>(null);
  const keyboardToggled = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const recognizer = useRef<Recognizer | null>(null);
  /** Identifies the live recognizer; callbacks from an older one are ignored. */
  const recToken = useRef<object | null>(null);
  const meter = useRef<{ ctx: AudioContext; analyser: AnalyserNode; stream: MediaStream } | null>(null);
  const boundaryPulse = useRef(0);
  const phaseRef = useRef<HudPhase>('booting');
  /** Bumped by every new request, interruption or close; work from an older run stops touching the HUD. */
  const runId = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const aiOff = !!ai.data && (!ai.data.enabled || ai.data.remaining <= 0);
  const aiMessage = ai.data?.message ?? NO_AI;
  const aiOffRef = useRef(aiOff);
  aiOffRef.current = aiOff;

  const go = useCallback((p: HudPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const kick = useWaveform({
    canvas,
    phase: phaseRef,
    meter,
    pulse: boundaryPulse,
    reduced,
    bootMs,
  });
  useEffect(kick, [phase, kick]);

  // ---- real readouts -------------------------------------------------------
  const tasksLeft = tasks.filter((t) => !t.done && !t.parent_id && (t.top_date === today || (t.due_date && t.due_date <= today) || t.sched_date === today)).length;
  const nextUp = useMemo(() => {
    const nowMs = now.getTime();
    const items: { title: string; at: number }[] = [];
    for (const e of events) if (!e.allDay && new Date(e.start).getTime() > nowMs) items.push({ title: e.title, at: new Date(e.start).getTime() });
    for (const t of tasks) {
      if (t.done || !t.sched_date || t.sched_start == null) continue;
      const [y, m, d] = t.sched_date.split('-').map(Number);
      const at = new Date(y, m - 1, d, 0, t.sched_start).getTime();
      if (at > nowMs) items.push({ title: t.title, at });
    }
    items.sort((a, b) => a.at - b.at);
    return items[0] ?? null;
  }, [events, tasks, now]);

  const finishBoot = useCallback(() => {
    window.setTimeout(() => {
      bootedOnce = true;
      setAnnounce((a) => a || 'Voice mode ready.');
      if (phaseRef.current === 'booting') go('idle');
    }, fastBoot ? 450 : 350);
  }, [fastBoot, go]);

  // ---- microphone level (for the waveform) -----------------------------------
  const stopMeter = useCallback(() => {
    meter.current?.stream.getTracks().forEach((t) => t.stop());
    meter.current?.ctx.close().catch(() => {});
    meter.current = null;
  }, []);

  const startMeter = useCallback(async (token: object) => {
    if (meter.current || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Listening may have ended while the browser asked for the mic.
      if (recToken.current !== token || meter.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      meter.current = { ctx, analyser, stream };
    } catch {
      /* the recognizer will report mic problems */
    }
  }, []);

  const endRecognizer = useCallback(() => {
    recToken.current = null;
    recognizer.current?.abort();
    recognizer.current = null;
    stopMeter();
  }, [stopMeter]);

  // ---- talking to Atlas ------------------------------------------------------
  const ask = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text) return;
      if (aiOffRef.current) {
        setNotice(aiMessage);
        return;
      }
      const run = ++runId.current;
      endRecognizer();
      stopSpeaking();
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setHeard(text);
      setReply('');
      setNotice('');
      setAnnounce('');
      setLatency(null);
      go('thinking');
      const sent = performance.now();
      let full = '';
      try {
        for await (const ev of atlasStream(text, 'voice', ctrl.signal)) {
          if (run !== runId.current) return;
          if (ev.t === 'text') {
            if (!full) setLatency((performance.now() - sent) / 1000);
            full += ev.v;
            setReply(full);
          } else if (ev.t === 'action' && ev.plan_id) {
            setPlanId(ev.plan_id);
            invalidate();
          } else if (ev.t === 'confirm') setNotice(`Confirm in the Atlas panel: ${ev.summary}`);
          else if (ev.t === 'error') setNotice(ev.message);
          else if (ev.t === 'done') updateStatus(ev.remaining);
        }
      } catch (err) {
        if (run !== runId.current || ctrl.signal.aborted) return;
        setNotice(err instanceof ApiError ? err.message : 'Atlas is unavailable right now.');
        if (err instanceof ApiError && err.data.reason === 'daily_limit') updateStatus(0);
        if (err instanceof ApiError && String(err.data.reason ?? '').startsWith('paused')) updateStatus(null, { enabled: false, paused: true, message: err.message });
        go('idle');
        return;
      }
      qc.invalidateQueries({ queryKey: atlasKey(uid) });
      invalidate();
      if (run !== runId.current) return;
      const aloud = !!full && voice.speak !== false && speechOutputSupported();
      // Read the reply once, when it's complete, unless it is about to be spoken aloud anyway.
      if (full && !aloud) setAnnounce(`Atlas: ${full}`);
      if (aloud) {
        go('speaking');
        await speak(full, voice, { onBoundary: () => (boundaryPulse.current = 1) });
      }
      // Only fall back to idle if nothing (a barge-in, a new request) took over meanwhile.
      if (run === runId.current && (phaseRef.current === 'speaking' || phaseRef.current === 'thinking')) go('idle');
    },
    [qc, uid, invalidate, updateStatus, voice, go, endRecognizer, aiMessage],
  );

  const listen = useCallback(() => {
    if (aiOffRef.current) {
      setNotice(aiMessage);
      return;
    }
    if (!speechInputSupported()) {
      setShowKeyboard(true);
      setNotice("Speech input isn't supported in this browser — type instead, or try Chrome, Edge or Safari.");
      return;
    }
    runId.current++; // a reply that is still being spoken no longer owns the HUD
    stopSpeaking();
    endRecognizer();
    setNotice('');
    setHeard('');
    setWakePaused(false);
    let finalText = '';
    const wake = !!voice.wakeWord;
    const token = {};
    recToken.current = token;
    // Wake mode restarts recognition whenever the browser ends it (silence, a routine abort). A
    // session that ends almost at once is retried with backoff instead of in a tight loop.
    let startedAt = Date.now();
    let quickEnds = 0;
    const restart = () => {
      quickEnds = Date.now() - startedAt < 3000 ? quickEnds + 1 : 0;
      const wait = quickEnds ? Math.min(8000, 250 * 2 ** (quickEnds - 1)) : 0;
      window.setTimeout(() => {
        if (recToken.current !== token || phaseRef.current !== 'listening') return;
        startedAt = Date.now();
        rec?.start();
      }, wait);
    };
    const rec = createRecognizer({
      continuous: wake,
      onText: (t, isFinal) => {
        if (recToken.current !== token) return;
        if (wake) {
          if (!WAKE.test(t)) return;
          const command = t.replace(WAKE, '');
          setHeard(command);
          if (isFinal && command.trim()) ask(command);
          return;
        }
        setHeard(isFinal ? (finalText = t) : t);
      },
      onEnd: () => {
        if (recToken.current !== token) return;
        if (!wake && finalText) {
          ask(finalText);
          return;
        }
        if (phaseRef.current === 'listening' && wake) {
          restart(); // keep waiting for the wake phrase
          return;
        }
        endRecognizer();
        if (phaseRef.current === 'listening') go('idle');
      },
      onError: (msg, code) => {
        if (recToken.current !== token) return;
        // Silence is normal while waiting for "Hey Atlas"; onEnd restarts recognition. ('aborted' never gets here.)
        if (wake && code === 'no-speech') return;
        endRecognizer();
        setNotice(wake ? `${msg} Wake phrase paused — tap the orb to resume.` : msg);
        if (wake) setWakePaused(true);
        go('idle');
      },
    });
    recognizer.current = rec;
    go('listening');
    startMeter(token);
    rec?.start();
  }, [ask, startMeter, endRecognizer, voice.wakeWord, go, aiMessage]);

  const stopListening = useCallback(() => {
    recognizer.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    runId.current++;
    abort.current?.abort();
    stopSpeaking();
    go('idle');
  }, [go]);

  const close = useCallback(() => {
    runId.current++;
    abort.current?.abort();
    endRecognizer();
    stopSpeaking();
    onClose();
  }, [onClose, endRecognizer]);

  const orbAction = () => {
    const p = phaseRef.current;
    if (p === 'booting') return;
    if (p === 'listening') stopListening();
    else if (p === 'thinking') cancel();
    else listen();
  };

  // Wake-phrase mode starts listening as soon as the HUD is ready.
  useEffect(() => {
    if (phase === 'idle' && voice.wakeWord && speechInputSupported() && !notice && !aiOff) listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'idle']);

  // Escape and focus containment come from the shared layer stack, so a dialog opened
  // on top of the HUD (e.g. editing a plan) gets Escape first.
  const isTopLayer = useOverlay({ open: true, onEscape: close, container: root });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !isTopLayer()) return;
      // Space on a focused control (Exit, the keyboard toggle, a plan card button) activates that control.
      if ((e.target as HTMLElement | null)?.closest('button, a, input, textarea, select, [role="button"], [contenteditable]')) return;
      e.preventDefault();
      if (phaseRef.current === 'listening') stopListening();
      else if (phaseRef.current === 'idle' || phaseRef.current === 'speaking') listen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listen, stopListening, isTopLayer]);

  useEffect(
    () => () => {
      runId.current++;
      abort.current?.abort();
      endRecognizer();
      stopSpeaking();
    },
    [endRecognizer],
  );

  // Keep the latest line of a long reply in view.
  useEffect(() => {
    const el = transcript.current;
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
  }, [heard, reply, notice]);

  useEffect(() => {
    if (showKeyboard && keyboardToggled.current) typedInput.current?.focus();
  }, [showKeyboard]);

  // Notices (errors, "confirm in the panel") are announced once each.
  useEffect(() => {
    if (notice) setAnnounce(notice);
  }, [notice]);

  const status =
    phase === 'listening' && voice.wakeWord ? 'Say “Hey Atlas”' : phase === 'idle' && aiOff ? 'AI unavailable' : phase === 'idle' && wakePaused ? 'Wake phrase paused' : PHASE_LABEL[phase];
  const hint = voice.wakeWord ? 'Say “Hey Atlas”, then your request.' : touch ? 'Tap the orb, then speak.' : 'Tap the orb or press Space, then speak.';
  const orbLabel = phase === 'listening' ? 'Stop listening' : phase === 'thinking' ? 'Cancel request' : 'Talk to Atlas (Space)';
  const orbInactive = phase === 'booting' || (aiOff && phase !== 'listening' && phase !== 'thinking');

  const aiReadout = !ai.data ? (
    '—'
  ) : ai.data.paused ? (
    <span className="text-amber-300">Paused</span>
  ) : !ai.data.enabled ? (
    <span className="text-amber-300">Off</span>
  ) : (
    <CountUp value={ai.data.remaining} reduced={reduced} />
  );

  const nextUpReadout = (className?: string, align: 'left' | 'right' = 'left') => (
    <Readout label="Next up" align={align} className={className} enter={400}>
      {nextUp ? (
        <>
          <div className="truncate text-sm">{nextUp.title}</div>
          <div className="mt-0.5 truncate text-xs tabular-nums text-cyan-300/80">
            {whenLabel(nextUp.at, today, tz)}
            {dayIn(tz, new Date(nextUp.at)) === today && <span className="hidden sm:inline"> · {countdown(nextUp.at, now.getTime())}</span>}
          </div>
        </>
      ) : (
        <div className="text-sm text-cyan-300/80">Nothing scheduled</div>
      )}
    </Readout>
  );

  return createPortal(
    <div
      ref={root}
      tabIndex={-1}
      data-phase={phase}
      data-ai-off={aiOff}
      className="hud-root fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#020409] font-mono text-cyan-100 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Atlas voice mode"
    >
      <style>{HUD_CSS}</style>
      <p className="sr-only" role="status">
        {announce}
      </p>
      <div className="hud-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="hud-scan pointer-events-none absolute inset-0" aria-hidden />
      {phase === 'booting' && !fastBoot && <div className="hud-boot-sweep pointer-events-none absolute inset-x-0" aria-hidden />}

      {/* Header: clock left, next up and Exit right */}
      <header className="relative z-10 flex items-start justify-between gap-4">
        <HudClock tz={tz} />
        <div className="flex min-w-0 items-start gap-6">
          {nextUpReadout('hidden max-w-[32vw] sm:block', 'right')}
          <button
            onClick={close}
            className="hud-rise flex h-11 shrink-0 items-center gap-2 rounded-full border border-cyan-400/50 px-4 text-xs uppercase tracking-[0.2em] text-cyan-100 transition-colors duration-150 hover:bg-cyan-400/10"
            style={delay(150)}
            aria-label="Exit voice mode (Esc)"
          >
            <X size={15} aria-hidden /> Exit
          </button>
        </div>
      </header>

      {/* Orb, status and transcript */}
      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-2">
        <div className="hud-orb-box relative shrink-0">
          <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
          <HudRings phase={phase} reduced={reduced} />
          <button
            onClick={orbAction}
            aria-disabled={orbInactive || undefined}
            data-autofocus
            className={cn(
              'absolute left-1/2 top-1/2 flex h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-cyan-300',
              orbInactive && phase !== 'booting' && 'cursor-not-allowed opacity-50',
            )}
            aria-label={orbLabel}
            title={aiOff ? aiMessage : undefined}
          >
            {phase === 'listening' ? (
              <MicOff size={26} className="text-cyan-950/80" aria-hidden />
            ) : phase === 'thinking' ? (
              <Square size={20} className="fill-cyan-950/70 text-cyan-950/70" aria-hidden />
            ) : (
              <Mic size={26} className="text-cyan-950/70" aria-hidden />
            )}
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-cyan-300" role="status">
            <span className="hud-led h-1.5 w-1.5 rounded-full" aria-hidden />
            <span>{status}</span>
            {phase === 'thinking' && (
              // Ticks ten times a second: shown, never announced.
              <span className="tracking-[0.2em] text-cyan-400/80" aria-hidden>
                · <Elapsed />
              </span>
            )}
            {phase === 'idle' && latency != null && (
              <span className="hidden tracking-[0.2em] text-cyan-400/80 sm:inline" title="Time to Atlas's first word" aria-hidden>
                · first word {latency.toFixed(1)} s
              </span>
            )}
          </div>
          {phase === 'booting' && (
            <div className="h-px w-28 overflow-hidden bg-cyan-400/20" aria-hidden>
              <div className="hud-progress h-full w-full bg-cyan-300" style={{ '--boot': `${bootMs}ms` } as CSSProperties} />
            </div>
          )}
        </div>

        <div
          ref={transcript}
          className="hud-transcript w-full max-w-2xl overflow-y-auto overscroll-contain px-2 text-center text-sm font-light leading-relaxed"
          style={{ maxHeight: 'min(26vh, 14rem)', minHeight: '4.5rem' }}
        >
          {phase === 'booting' ? (
            <BootLine line={bootLine} msPerChar={fastBoot ? 0 : MS_PER_CHAR} onDone={finishBoot} />
          ) : (
            <div className="space-y-2">
              {heard && <p className="break-words text-cyan-300/90">&gt; {heard}</p>}
              {reply && <p className="whitespace-pre-wrap break-words text-cyan-50">{reply}</p>}
              {aiOff && !reply && !notice ? (
                <p className="text-amber-300">{aiMessage}</p>
              ) : (
                !heard && !reply && !notice && (
                  <>
                    {/* The greeting stays until the first request. */}
                    <p className="text-cyan-50" aria-hidden>
                      {bootLine}
                    </p>
                    <p className="text-cyan-400/80">
                      {hint} <span className="whitespace-nowrap">Each reply uses 1 ✨.</span>
                    </p>
                  </>
                )
              )}
              {notice && <p className="text-amber-300">{notice}</p>}
            </div>
          )}
        </div>
      </main>

      {/* Wait for the plans list to include the new draft, so the card never flashes "removed". */}
      {planId && plans?.some((p) => p.id === planId) && (
        <div className="absolute inset-x-3 bottom-36 z-20 mx-auto max-h-[50dvh] max-w-xl overflow-y-auto rounded-2xl bg-[#020409] lg:inset-x-auto lg:bottom-auto lg:right-8 lg:top-28 lg:max-h-[65vh] lg:w-[380px]">
          <div className="flex items-center justify-between pl-1 text-[11px] uppercase tracking-[0.3em] text-cyan-400/80">
            <span>Plan</span>
            <button onClick={() => setPlanId(null)} className="flex h-11 w-11 items-center justify-center rounded-full text-cyan-200 hover:bg-cyan-400/10" aria-label="Hide plan card">
              <X size={16} aria-hidden />
            </button>
          </div>
          <PlanCard planId={planId} variant="hud" />
        </div>
      )}

      {/* Footer: readouts flank the typing fallback */}
      <footer className="relative z-10 flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_minmax(0,34rem)_1fr] sm:items-end sm:gap-6">
        <div className="grid grid-cols-2 gap-3 sm:contents">
          {nextUpReadout('col-span-2 sm:hidden')}
          <Readout label="Tasks left today" className="sm:col-start-1 sm:row-start-1" enter={480}>
            <span className="text-xl sm:text-2xl">
              <CountUp value={tasksLeft} reduced={reduced} />
            </span>
          </Readout>
          <Readout label="AI uses left" align="right" className="sm:col-start-3 sm:row-start-1" enter={560}>
            <span className="text-xl sm:text-2xl">{aiReadout}</span>
            {ai.data?.enabled && ai.data.limit > 0 && <AllowanceMeter remaining={ai.data.remaining} limit={ai.data.limit} />}
          </Readout>
        </div>

        <div className="hud-rise flex items-center justify-center gap-2 sm:col-start-2 sm:row-start-1" style={delay(620)}>
          <button
            onClick={() => {
              keyboardToggled.current = true;
              setShowKeyboard((v) => !v);
            }}
            className={cn(
              'flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-cyan-400/50 text-cyan-200 transition-colors duration-150 hover:bg-cyan-400/10',
              showKeyboard ? 'w-11' : 'px-4 text-xs uppercase tracking-[0.2em]',
            )}
            aria-label={showKeyboard ? 'Hide keyboard input' : 'Type instead'}
          >
            <Keyboard size={16} aria-hidden />
            {!showKeyboard && <span aria-hidden>Type</span>}
          </button>
          {showKeyboard && (
            <form
              className="flex min-w-0 flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                // Typing during the boot line is fine: the request simply cuts the boot short.
                if (!typed.trim()) return;
                ask(typed);
                setTyped('');
              }}
            >
              <label htmlFor="hud-input" className="sr-only">
                Type to Atlas
              </label>
              <input
                id="hud-input"
                ref={typedInput}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                maxLength={2000}
                disabled={aiOff}
                enterKeyHint="send"
                autoComplete="off"
                placeholder={aiOff ? 'AI is unavailable right now' : 'Type to Atlas…'}
                className="h-11 min-w-0 flex-1 rounded-full border border-cyan-400/60 bg-transparent px-4 text-base text-cyan-50 outline-none transition-colors duration-150 placeholder:text-cyan-500 focus:border-cyan-200 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50 sm:text-sm"
              />
            </form>
          )}
        </div>
      </footer>
    </div>,
    document.body,
  );
}
