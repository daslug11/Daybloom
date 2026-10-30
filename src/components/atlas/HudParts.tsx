import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNow } from '../../hooks/useNow';
import { cn } from '../../lib/utils';
import type { HudPhase } from './useWaveform';

/** Inline custom property for staggered entrances (`--d` is read by .hud-in / .hud-rise). */
export const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

/** The clock re-renders itself once a second; nothing else in the HUD does. */
export const HudClock = memo(function HudClock({ tz }: { tz?: string }) {
  const now = useNow(1000);
  const fmt = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: tz }),
      date: new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }),
      zone: new Intl.DateTimeFormat(undefined, { timeZoneName: 'short', timeZone: tz }),
    }),
    [tz],
  );
  const parts = fmt.time.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = fmt.date.format(now);
  const zone = fmt.zone.formatToParts(now).find((p) => p.type === 'timeZoneName')?.value;
  return (
    <div className="hud-rise min-w-0" style={delay(250)}>
      <div className="flex items-baseline font-light tabular-nums text-cyan-50">
        <span className="text-2xl tracking-[0.12em] sm:text-3xl">
          {get('hour')}:{get('minute')}
        </span>
        <span className="ml-1 text-sm tracking-[0.12em] text-cyan-300/80 sm:text-base">:{get('second')}</span>
      </div>
      <div className="mt-1 truncate text-[11px] uppercase tracking-[0.2em] text-cyan-400/80">
        {date}
        {zone && <span className="hidden sm:inline"> · {zone}</span>}
      </div>
    </div>
  );
});

/** A labelled instrument readout with a hairline rule on its outer edge. */
export function Readout({ label, children, align = 'left', className, enter = 0 }: { label: ReactNode; children: ReactNode; align?: 'left' | 'right'; className?: string; enter?: number }) {
  return (
    <div className={cn('hud-rise min-w-0', align === 'right' ? 'border-r pr-3 text-right' : 'border-l pl-3', 'border-cyan-400/30', className)} style={delay(enter)}>
      <div className="truncate text-[11px] uppercase tracking-[0.14em] text-cyan-400/80 sm:tracking-[0.2em]">{label}</div>
      <div className="mt-1 text-cyan-50">{children}</div>
    </div>
  );
}

/** A number that counts up from zero the first time it is known, then just shows changes. */
export function CountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shown.current || reduced || value <= 0) {
      shown.current = true;
      el.textContent = String(value);
      return;
    }
    shown.current = true;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      el.textContent = String(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    el.textContent = '0';
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = String(value);
    };
  }, [value, reduced]);
  return <span ref={ref} className="tabular-nums" />;
}

/** Segmented allowance meter: one cell per AI action (or a proportional bar past 20). */
export function AllowanceMeter({ remaining, limit }: { remaining: number; limit: number }) {
  const cells = Math.max(1, Math.min(limit, 20));
  const lit = limit > 0 ? Math.round((Math.max(0, remaining) / limit) * cells) : 0;
  return (
    <span className="mt-1.5 flex justify-end gap-[3px]" aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={cn('h-2.5 w-[3px] rounded-[1px]', i < lit ? 'bg-cyan-300' : 'bg-cyan-400/20')} />
      ))}
    </span>
  );
}

/** The typed boot line. Owns its own state so typing re-renders only this line. Hidden from screen readers (the status line announces readiness). */
export function BootLine({ line, msPerChar, onDone }: { line: string; msPerChar: number; onDone: () => void }) {
  const [n, setN] = useState(msPerChar ? 0 : line.length);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!msPerChar) {
      done.current();
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setN(i);
      if (i >= line.length) {
        window.clearInterval(id);
        done.current();
      }
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [line, msPerChar]);
  return (
    <p className="text-cyan-50" aria-hidden>
      {line.slice(0, n)}
      <span className="hud-caret">▍</span>
    </p>
  );
}

/** Elapsed time while Atlas thinks, written straight to the DOM ten times a second. */
export function Elapsed() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      if (ref.current) ref.current.textContent = `${((performance.now() - start) / 1000).toFixed(1)} s`;
    }, 100);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span ref={ref} className="tabular-nums" aria-hidden>
      0.0 s
    </span>
  );
}

// ---- rings ------------------------------------------------------------------

/** Rotation speed per phase, as a multiple of each ring's base period. */
const RATES: Record<HudPhase, number> = { booting: 3, idle: 1, listening: 1.8, thinking: 3.5, speaking: 1.4 };

const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i / 72) * Math.PI * 2;
  const long = i % 6 === 0;
  const r1 = long ? 176 : 181;
  return <line key={i} x1={200 + Math.cos(a) * r1} y1={200 + Math.sin(a) * r1} x2={200 + Math.cos(a) * 188} y2={200 + Math.sin(a) * 188} stroke="#67e8f9" strokeOpacity={long ? 0.7 : 0.3} strokeWidth={long ? 1.5 : 1} />;
});

/** A comet: six segments of a 54° arc, fading towards the tail. */
const SWEEP = Array.from({ length: 6 }, (_, i) => {
  const r = 172;
  const a0 = ((-90 - (i + 1) * 9) * Math.PI) / 180;
  const a1 = ((-90 - i * 9) * Math.PI) / 180;
  return (
    <path
      key={i}
      d={`M ${200 + Math.cos(a0) * r} ${200 + Math.sin(a0) * r} A ${r} ${r} 0 0 1 ${200 + Math.cos(a1) * r} ${200 + Math.sin(a1) * r}`}
      fill="none"
      stroke="#cffafe"
      strokeWidth="3"
      strokeOpacity={1 - i * 0.16}
    />
  );
});

const RETICLE = [0, 90, 180, 270].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return <line key={deg} x1={200 + Math.cos(a) * 193} y1={200 + Math.sin(a) * 193} x2={200 + Math.cos(a) * 199} y2={200 + Math.sin(a) * 199} stroke="#a5f3fc" strokeOpacity="0.8" strokeWidth="1.5" />;
});

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full overflow-visible">
    {children}
  </svg>
);

/**
 * Counter-rotating rings. Each ring is its own SVG inside an HTML wrapper rotated by the
 * Web Animations API, so rotation runs on the compositor. Phase changes ease the playback
 * rate rather than restarting the animation; reduced motion never starts them.
 */
export const HudRings = memo(function HudRings({ phase, reduced }: { phase: HudPhase; reduced: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const sweep = useRef<HTMLDivElement>(null);
  const spins = useRef<Animation[]>([]);
  const sweepSpin = useRef<Animation | null>(null);
  const rate = useRef(RATES.booting);

  useEffect(() => {
    if (reduced) return;
    const spin = (el: HTMLElement | null, ms: number, dir: 1 | -1) =>
      el && typeof el.animate === 'function' ? el.animate([{ transform: 'rotate(0turn)' }, { transform: `rotate(${dir}turn)` }], { duration: ms, iterations: Infinity }) : null;
    spins.current = [spin(outer.current, 90_000, 1), spin(mid.current, 52_000, -1), spin(inner.current, 18_000, 1)].filter((a): a is Animation => !!a);
    for (const a of spins.current) a.playbackRate = rate.current;
    sweepSpin.current = spin(sweep.current, 1400, 1);
    sweepSpin.current?.pause();
    return () => {
      for (const a of spins.current) a.cancel();
      sweepSpin.current?.cancel();
      spins.current = [];
      sweepSpin.current = null;
    };
  }, [reduced]);

  useEffect(() => {
    if (phase === 'thinking') sweepSpin.current?.play();
    else sweepSpin.current?.pause();
    // Ease the spin speed to the new phase over ~400ms instead of jumping.
    const from = rate.current;
    const to = RATES[phase];
    if (from === to || !spins.current.length) {
      rate.current = to;
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 400);
      rate.current = from + (to - from) * (1 - Math.pow(1 - t, 2));
      for (const a of spins.current) a.updatePlaybackRate(rate.current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* fixed reticle */}
      <div className="hud-in absolute inset-0" style={delay(0)}>
        <Svg>{RETICLE}</Svg>
      </div>
      {/* outer ring with tick marks */}
      <div className="hud-in absolute inset-0" style={delay(0)}>
        <div ref={outer} className="absolute inset-0">
          <Svg>
            <circle cx="200" cy="200" r="188" fill="none" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1" />
            {TICKS}
          </Svg>
        </div>
      </div>
      {/* thinking comet */}
      <div className="hud-sweep absolute inset-0">
        <div ref={sweep} className="absolute inset-0">
          <Svg>{SWEEP}</Svg>
        </div>
      </div>
      {/* segmented arcs, counter-rotating */}
      <div className="hud-in absolute inset-0" style={delay(110)}>
        <div ref={mid} className="absolute inset-0">
          <Svg>
            <circle cx="200" cy="200" r="160" fill="none" stroke="#22d3ee" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="60 20 12 20" />
          </Svg>
        </div>
      </div>
      {/* inner dashed ring with a bright quadrant */}
      <div className="hud-in absolute inset-0" style={delay(220)}>
        <div ref={inner} className="absolute inset-0">
          <Svg>
            <circle cx="200" cy="200" r="138" fill="none" stroke="#a5f3fc" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 8" />
            <path d="M 200 62 A 138 138 0 0 1 338 200" fill="none" stroke="#67e8f9" strokeWidth="3" strokeOpacity="0.9" />
          </Svg>
        </div>
      </div>
      {/* core */}
      <div className="hud-in absolute inset-0" style={delay(320)}>
        <div className="hud-glow absolute inset-[22%] rounded-full" />
        <div className="hud-core absolute inset-[30.5%] rounded-full" />
      </div>
    </div>
  );
});

export const HUD_CSS = `
.hud-root { padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); }
@media (min-width: 640px) { .hud-root { padding: max(2rem, env(safe-area-inset-top)) max(2rem, env(safe-area-inset-right)) max(1.5rem, env(safe-area-inset-bottom)) max(2rem, env(safe-area-inset-left)); } }
.hud-root :focus-visible { --tw-ring-color: rgb(103 232 249 / 0.85); --tw-ring-offset-color: #020409; }
.hud-root ::selection { background: rgb(34 211 238 / 0.3); }
.hud-grid {
  background-image:
    linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px);
  background-size: 40px 40px;
  background-position: center;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  animation: hud-fade 600ms ease-out both;
}
.hud-scan { background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px); }
.hud-boot-sweep {
  height: 140px; top: -140px;
  background: linear-gradient(to bottom, transparent, rgba(103,232,249,0.07) 85%, rgba(165,243,252,0.35) 99%, transparent);
  animation: hud-sweep-down 1100ms cubic-bezier(0.65,0,0.35,1) both;
}
.hud-orb-box { width: min(76vw, 440px, 44vh); aspect-ratio: 1 / 1; }
@supports (height: 1dvh) { .hud-orb-box { width: min(76vw, 440px, 44dvh); } }
.hud-core { background: radial-gradient(circle at 50% 42%, #ecfeff 0%, #67e8f9 38%, rgba(8,145,178,0.6) 76%, rgba(8,51,68,0) 100%); }
.hud-glow { background: radial-gradient(circle, rgba(34,211,238,0.28) 0%, rgba(34,211,238,0.08) 45%, rgba(34,211,238,0) 70%); opacity: 0.4; transition: opacity 400ms ease-out; }
.hud-sweep { opacity: 0; transition: opacity 250ms ease-out; }
.hud-led { background: #22d3ee; opacity: 0.45; transition: opacity 200ms ease-out, background-color 200ms ease-out; }
[data-phase="listening"] .hud-glow, [data-phase="speaking"] .hud-glow { opacity: 1; }
[data-phase="thinking"] .hud-sweep { opacity: 1; }
[data-phase="thinking"] .hud-core { animation: hud-pulse 1.2s ease-in-out infinite; }
[data-phase="listening"] .hud-led { background: #fb7185; opacity: 1; animation: hud-blink-soft 1.4s ease-in-out infinite; }
[data-phase="thinking"] .hud-led { opacity: 1; animation: hud-blink-soft 0.6s ease-in-out infinite; }
[data-phase="speaking"] .hud-led { background: #a5f3fc; opacity: 1; }
[data-ai-off="true"] .hud-led { background: #fbbf24; opacity: 0.9; }
.hud-core { transition: opacity 300ms ease-out; }
[data-ai-off="true"] .hud-core { opacity: 0.4; }
[data-ai-off="true"] .hud-glow { opacity: 0.15; }
.hud-in { animation: hud-in 800ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: var(--d, 0ms); }
.hud-rise { animation: hud-rise 500ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: var(--d, 0ms); }
.hud-progress { transform-origin: left; animation: hud-progress var(--boot, 1000ms) linear both; }
.hud-caret { animation: hud-blink 0.9s steps(1) infinite; color: #67e8f9; }
@keyframes hud-fade { from { opacity: 0; } }
@keyframes hud-in { from { opacity: 0; transform: scale(0.9); } }
@keyframes hud-rise { from { opacity: 0; transform: translateY(6px); } }
@keyframes hud-progress { from { transform: scaleX(0); } }
@keyframes hud-sweep-down { from { transform: translateY(0); } to { transform: translateY(calc(100vh + 280px)); } }
@keyframes hud-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.72; } }
@keyframes hud-blink-soft { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes hud-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .hud-in, .hud-rise { animation-name: hud-fade; }
  .hud-boot-sweep, [data-phase] .hud-core, [data-phase] .hud-led, .hud-caret, .hud-progress { animation: none; }
}
`;
