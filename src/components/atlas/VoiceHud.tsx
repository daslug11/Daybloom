import { useQueryClient } from '@tanstack/react-query';
import { Keyboard, Mic, MicOff, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { atlasKey } from '../../hooks/data/atlas';
import { useTasks } from '../../hooks/data/tasks';
import { useAiStatus, useAiStatusUpdater } from '../../hooks/useAi';
import { useUserId } from '../../hooks/useAuth';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useInvalidateUserData } from '../../hooks/useInvalidateAll';
import { useProfile, useToday } from '../../hooks/useProfile';
import { ApiError, atlasStream } from '../../lib/api';
import { greeting } from '../../lib/dates';
import { PlanCard } from '../plans/PlanCard';
import { createRecognizer, speak, speechInputSupported, speechOutputSupported, stopSpeaking, type Recognizer } from '../../lib/speech';
import { cn } from '../../lib/utils';

type Phase = 'booting' | 'idle' | 'listening' | 'thinking' | 'speaking';

const WAKE = /\bhey,?\s+atlas\b[,.!?]?\s*/i;

/**
 * Voice mode: a full-screen holographic HUD. Speak to Atlas (Web Speech API),
 * hear replies (speechSynthesis). Every reply uses one AI action.
 */
export default function VoiceHud({ onClose }: { onClose: () => void }) {
  const uid = useUserId();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { today, minutes, now } = useToday(1000);
  const { data: tasks = [] } = useTasks();
  const { events } = useCalendarSync();
  const ai = useAiStatus();
  const updateStatus = useAiStatusUpdater();
  const invalidate = useInvalidateUserData();
  const voice = profile?.voice ?? {};
  const name = profile?.name || 'there';

  const [phase, setPhase] = useState<Phase>('booting');
  const [bootText, setBootText] = useState('');
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState('');
  const [typed, setTyped] = useState('');
  /** A plan Atlas drafted during this voice session, shown as a card on screen. */
  const [planId, setPlanId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [showKeyboard, setShowKeyboard] = useState(!speechInputSupported());
  const recognizer = useRef<Recognizer | null>(null);
  const level = useRef(0); // 0–1 drives the waveform ring
  const boundaryPulse = useRef(0);
  const audio = useRef<{ ctx: AudioContext; analyser: AnalyserNode; stream: MediaStream } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('booting');
  phaseRef.current = phase;
  const abort = useRef<AbortController | null>(null);
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

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

  // ---- boot sequence ---------------------------------------------------------
  useEffect(() => {
    const line = `Systems online. ${greeting(minutes)}, ${name}.`;
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setBootText(line.slice(0, i));
      if (i >= line.length) {
        window.clearInterval(id);
        window.setTimeout(() => setPhase('idle'), reduced ? 0 : 500);
      }
    }, reduced ? 0 : 38);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- microphone level (for the waveform) -----------------------------------
  const startMeter = useCallback(async () => {
    if (audio.current || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audio.current = { ctx, analyser, stream };
    } catch {
      /* the recognizer will report mic problems */
    }
  }, []);

  const stopMeter = useCallback(() => {
    audio.current?.stream.getTracks().forEach((t) => t.stop());
    audio.current?.ctx.close().catch(() => {});
    audio.current = null;
  }, []);

  // ---- talking to Atlas ------------------------------------------------------
  const ask = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text) return;
      recognizer.current?.abort();
      setHeard(text);
      setReply('');
      setNotice('');
      setPhase('thinking');
      abort.current = new AbortController();
      let full = '';
      try {
        for await (const ev of atlasStream(text, 'voice', abort.current.signal)) {
          if (ev.t === 'text') {
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
        const msg = err instanceof ApiError ? err.message : 'Atlas is unavailable right now.';
        setNotice(msg);
        if (err instanceof ApiError && err.data.reason === 'daily_limit') updateStatus(0);
        setPhase('idle');
        return;
      }
      qc.invalidateQueries({ queryKey: atlasKey(uid) });
      invalidate();
      if (full && voice.speak !== false && speechOutputSupported()) {
        setPhase('speaking');
        await speak(full, voice, { onBoundary: () => (boundaryPulse.current = 1) });
      }
      if (phaseRef.current !== 'booting') setPhase('idle');
    },
    [qc, uid, invalidate, updateStatus, voice],
  );

  const listen = useCallback(() => {
    if (!speechInputSupported()) {
      setShowKeyboard(true);
      setNotice("Speech input isn't supported in this browser — type instead, or try Chrome, Edge or Safari.");
      return;
    }
    stopSpeaking();
    setNotice('');
    setHeard('');
    let finalText = '';
    const wake = !!voice.wakeWord;
    recognizer.current?.abort();
    recognizer.current = createRecognizer({
      continuous: wake,
      onText: (t, isFinal) => {
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
        stopMeter();
        if (!wake && finalText) ask(finalText);
        else if (phaseRef.current === 'listening') {
          if (wake) recognizer.current?.start(); // keep listening for the wake phrase
          else setPhase('idle');
        }
      },
      onError: (msg) => {
        setNotice(msg);
        setPhase('idle');
      },
    });
    setPhase('listening');
    startMeter();
    recognizer.current?.start();
  }, [ask, startMeter, stopMeter, voice.wakeWord]);

  const stopListening = () => {
    recognizer.current?.stop();
  };

  const close = useCallback(() => {
    abort.current?.abort();
    recognizer.current?.abort();
    stopSpeaking();
    stopMeter();
    onClose();
  }, [onClose, stopMeter]);

  // Wake-phrase mode starts listening as soon as the HUD is ready.
  useEffect(() => {
    if (phase === 'idle' && voice.wakeWord && speechInputSupported() && !notice) listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'idle']);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A dialog opened on top (e.g. editing a plan) handles its own keys.
      if ([...document.querySelectorAll('[role="dialog"]')].some((d) => d !== root.current)) return;
      if (e.key === 'Escape') close();
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        if (phaseRef.current === 'listening') stopListening();
        else if (phaseRef.current === 'idle' || phaseRef.current === 'speaking') listen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, listen]);

  useEffect(() => () => {
    abort.current?.abort();
    recognizer.current?.abort();
    stopSpeaking();
    stopMeter();
  }, [stopMeter]);

  // ---- waveform ring (canvas) --------------------------------------------------
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d')!;
    const data = new Uint8Array(128);
    let raf = 0;
    let t = 0;
    const draw = () => {
      const size = el.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== size * dpr) {
        el.width = size * dpr;
        el.height = size * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const p = phaseRef.current;
      // Target loudness: mic while listening, word pulses while speaking, a slow breath otherwise.
      let target = 0.05;
      if (p === 'listening' && audio.current) {
        audio.current.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += Math.abs(v - 128);
        target = Math.min(1, (sum / data.length) / 18);
      } else if (p === 'speaking') {
        boundaryPulse.current *= 0.9;
        target = 0.25 + boundaryPulse.current * 0.75;
      } else if (p === 'thinking') target = 0.15 + 0.1 * Math.sin(t / 6);
      level.current += (target - level.current) * 0.25;
      const cx = size / 2;
      const r = size * 0.3;
      const bars = 96;
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2;
        const wobble = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(a * 6 + t / 8) * Math.cos(a * 3 - t / 11);
        const len = 4 + level.current * size * 0.09 * (0.35 + wobble);
        ctx.strokeStyle = `rgba(103, 232, 249, ${0.25 + level.current * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r + len), cx + Math.sin(a) * (r + len));
        ctx.stroke();
      }
      t++;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const remaining = ai.data?.enabled ? ai.data.remaining : 0;
  const status =
    phase === 'booting' ? 'BOOTING' : phase === 'listening' ? (voice.wakeWord ? 'SAY “HEY ATLAS”' : 'LISTENING') : phase === 'thinking' ? 'THINKING' : phase === 'speaking' ? 'SPEAKING' : 'STANDING BY';
  const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return createPortal(
    <div ref={root} className="fixed inset-0 z-[90] overflow-hidden bg-[#020409] font-mono text-cyan-100" role="dialog" aria-modal="true" aria-label="Atlas voice mode">
      <style>{HUD_CSS}</style>
      <div className="hud-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="hud-scan pointer-events-none absolute inset-0" aria-hidden />

      {/* Corner readouts — real data only */}
      <div className="absolute left-4 top-4 space-y-1 text-[11px] uppercase tracking-[0.2em] text-cyan-300/80 sm:left-8 sm:top-8">
        <div className="text-2xl font-light tracking-[0.15em] text-cyan-100 tabular-nums">{timeStr}</div>
        <div>{dateStr}</div>
      </div>
      <div className="absolute right-4 top-4 text-right text-[11px] uppercase tracking-[0.2em] text-cyan-300/80 sm:right-8 sm:top-8">
        <div className="text-cyan-500/70">Next up</div>
        <div className="mt-1 max-w-[40vw] truncate text-cyan-100 normal-case tracking-normal">
          {nextUp ? `${new Date(nextUp.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · ${nextUp.title}` : 'Nothing scheduled'}
        </div>
      </div>
      <div className="absolute bottom-24 left-4 text-[11px] uppercase tracking-[0.2em] text-cyan-300/80 sm:bottom-8 sm:left-8">
        <div className="text-cyan-500/70">Tasks left today</div>
        <div className="mt-1 text-xl text-cyan-100 tabular-nums">{tasksLeft}</div>
      </div>
      <div className="absolute bottom-24 right-4 text-right text-[11px] uppercase tracking-[0.2em] text-cyan-300/80 sm:bottom-8 sm:right-8">
        <div className="text-cyan-500/70">AI uses left</div>
        <div className="mt-1 text-xl text-cyan-100 tabular-nums">{ai.data ? remaining : '—'}</div>
      </div>

      <button onClick={close} className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-400/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-400/10" aria-label="Exit voice mode (Esc)">
        <X size={14} /> EXIT
      </button>

      {/* Central orb + rings */}
      <div className="absolute left-1/2 top-[44%] h-[min(78vw,460px)] w-[min(78vw,460px)] -translate-x-1/2 -translate-y-1/2">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
        <svg viewBox="0 0 400 400" className={cn('absolute inset-0 h-full w-full', phase === 'booting' && 'hud-boot')} aria-hidden>
          <defs>
            <radialGradient id="hud-core" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#ecfeff" />
              <stop offset="35%" stopColor="#67e8f9" />
              <stop offset="75%" stopColor="#0891b2" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#083344" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* outer ring with tick marks */}
          <g className="hud-spin-slow" style={{ transformOrigin: '200px 200px' }}>
            <circle cx="200" cy="200" r="188" fill="none" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1" className="hud-draw" />
            {Array.from({ length: 72 }, (_, i) => {
              const a = (i / 72) * Math.PI * 2;
              const long = i % 6 === 0;
              const r1 = long ? 176 : 181;
              return <line key={i} x1={200 + Math.cos(a) * r1} y1={200 + Math.sin(a) * r1} x2={200 + Math.cos(a) * 188} y2={200 + Math.sin(a) * 188} stroke="#67e8f9" strokeOpacity={long ? 0.7 : 0.3} strokeWidth={long ? 1.5 : 1} />;
            })}
          </g>
          {/* middle segmented arcs, counter-rotating */}
          <g className="hud-spin-rev" style={{ transformOrigin: '200px 200px' }}>
            <circle cx="200" cy="200" r="160" fill="none" stroke="#22d3ee" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="60 20 12 20" className="hud-draw" />
          </g>
          {/* inner thin ring, faster */}
          <g className="hud-spin-fast" style={{ transformOrigin: '200px 200px' }}>
            <circle cx="200" cy="200" r="138" fill="none" stroke="#a5f3fc" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 8" className="hud-draw" />
            <path d="M 200 62 A 138 138 0 0 1 338 200" fill="none" stroke="#67e8f9" strokeWidth="3" strokeOpacity="0.9" />
          </g>
          {/* core */}
          <circle cx="200" cy="200" r="78" fill="url(#hud-core)" className={cn(phase === 'thinking' && 'hud-pulse')} />
          <circle cx="200" cy="200" r="84" fill="none" stroke="#67e8f9" strokeOpacity="0.6" strokeWidth="1" />
        </svg>
        <button
          onClick={() => (phase === 'listening' ? stopListening() : phase === 'idle' || phase === 'speaking' ? listen() : undefined)}
          disabled={phase === 'booting' || phase === 'thinking'}
          className="absolute left-1/2 top-1/2 flex h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label={phase === 'listening' ? 'Stop listening' : 'Talk to Atlas (Space)'}
        >
          {phase === 'listening' ? <MicOff size={26} className="text-cyan-950/80" /> : <Mic size={26} className="text-cyan-950/70" />}
        </button>
      </div>

      {/* Status + transcript */}
      <div className="absolute inset-x-0 top-[calc(44%+min(39vw,230px)+12px)] mx-auto max-w-2xl px-6 text-center">
        <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-400" role="status">
          {status}
        </div>
        <div className="mt-3 min-h-[5.5rem] space-y-2 text-sm font-light leading-relaxed" aria-live="polite">
          {phase === 'booting' ? (
            <p className="text-cyan-100">
              {bootText}
              <span className="hud-caret">▍</span>
            </p>
          ) : (
            <>
              {heard && <p className="text-cyan-400/80">&gt; {heard}</p>}
              {reply && <p className="text-cyan-50">{reply}</p>}
              {!heard && !reply && !notice && (
                <p className="text-cyan-500/70">{voice.wakeWord ? 'Say “Hey Atlas”, then your request.' : 'Tap the orb or press Space, then speak.'}</p>
              )}
              {notice && <p className="text-amber-300">{notice}</p>}
            </>
          )}
        </div>
      </div>

      {planId && (
        <div className="absolute inset-x-3 bottom-20 max-h-[45vh] overflow-y-auto md:inset-x-auto md:bottom-auto md:right-6 md:top-28 md:max-h-[65vh] md:w-[380px]">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-cyan-500/80">
            <span>Plan</span>
            <button onClick={() => setPlanId(null)} className="rounded px-1 text-cyan-300 hover:bg-cyan-400/10" aria-label="Hide plan card">
              ✕
            </button>
          </div>
          <PlanCard planId={planId} variant="hud" />
        </div>
      )}

      {/* Typing fallback */}
      <div className="absolute inset-x-0 bottom-4 mx-auto flex max-w-xl items-center gap-2 px-4">
        <button onClick={() => setShowKeyboard((v) => !v)} className="rounded-full border border-cyan-400/30 p-2 text-cyan-300 hover:bg-cyan-400/10" aria-label={showKeyboard ? 'Hide keyboard input' : 'Type instead'}>
          <Keyboard size={16} />
        </button>
        {showKeyboard && (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(typed);
              setTyped('');
            }}
          >
            <label htmlFor="hud-input" className="sr-only">
              Type to Atlas
            </label>
            <input
              id="hud-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              maxLength={2000}
              placeholder="Type to Atlas…"
              className="flex-1 rounded-full border border-cyan-400/30 bg-transparent px-4 py-2 text-sm text-cyan-50 outline-none placeholder:text-cyan-700 focus:border-cyan-300"
            />
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

const HUD_CSS = `
.hud-grid {
  background-image:
    linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
}
.hud-scan {
  background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px);
}
@keyframes hud-spin { to { transform: rotate(360deg); } }
@keyframes hud-spin-r { to { transform: rotate(-360deg); } }
@keyframes hud-draw { from { stroke-dashoffset: 1200; } to { stroke-dashoffset: 0; } }
@keyframes hud-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
@keyframes hud-blink { 50% { opacity: 0; } }
.hud-spin-slow { animation: hud-spin 60s linear infinite; }
.hud-spin-rev { animation: hud-spin-r 38s linear infinite; }
.hud-spin-fast { animation: hud-spin 14s linear infinite; }
.hud-boot .hud-draw { stroke-dasharray: 1200; animation: hud-draw 1.6s ease-out both; }
.hud-pulse { animation: hud-pulse 1.2s ease-in-out infinite; }
.hud-caret { animation: hud-blink 1s steps(1) infinite; color: #67e8f9; }
@media (prefers-reduced-motion: reduce) {
  .hud-spin-slow, .hud-spin-rev, .hud-spin-fast, .hud-pulse, .hud-caret { animation: none; }
  .hud-boot .hud-draw { animation: none; stroke-dasharray: none; }
}
`;
