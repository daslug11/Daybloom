import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react';

export type HudPhase = 'booting' | 'idle' | 'listening' | 'thinking' | 'speaking';

/** Resting loudness per phase; also the static level shown under reduced motion. */
const REST: Record<HudPhase, number> = { booting: 0.06, idle: 0.06, listening: 0.3, thinking: 0.2, speaking: 0.45 };
const BARS = 120;
const ANGLES = Array.from({ length: BARS }, (_, i) => -Math.PI / 2 + (i / BARS) * Math.PI * 2);
const COS = ANGLES.map(Math.cos);
const SIN = ANGLES.map(Math.sin);

interface Options {
  canvas: RefObject<HTMLCanvasElement>;
  phase: MutableRefObject<HudPhase>;
  meter: MutableRefObject<{ analyser: AnalyserNode } | null>;
  /** Set to 1 on each spoken word boundary; decays inside the loop. */
  pulse: MutableRefObject<number>;
  reduced: boolean;
  /** How long the boot draw-on sweep takes. */
  bootMs: number;
}

/**
 * Everything in the HUD that moves with the voice: the waveform bars, the listening ring and
 * the corona around the core. One canvas, one requestAnimationFrame loop, no DOM or style writes
 * per frame. The loop runs only while something is moving (boot, listening, thinking, speaking,
 * or settling back to rest), stops when the HUD is idle or the tab is hidden, and draws a single
 * frame per phase under reduced motion. Returns `kick` to restart the loop.
 */
export function useWaveform({ canvas, phase, meter, pulse, reduced, bootMs }: Options) {
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const data = new Uint8Array(128);
    const born = performance.now();
    let size = 0;
    let raf = 0;
    let level = REST.booting;
    let last = born;
    let wobbleT = 0;
    /** Listening ring brightness, eased between phases. */
    let ring = 0;

    const resize = () => {
      const css = el.clientWidth;
      if (!css) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.round(css * dpr);
      if (el.width !== px) {
        el.width = px;
        el.height = px;
      }
      size = css;
      ctx.setTransform(px / css, 0, 0, px / css, 0, 0);
    };

    const draw = (progress: number) => {
      ctx.clearRect(0, 0, size, size);
      const c = size / 2;
      const r = size * 0.3;
      const reach = size * 0.09;
      const count = Math.round(BARS * progress);
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a = ANGLES[i];
        const wobble = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(a * 6 + wobbleT / 8) * Math.cos(a * 3 - wobbleT / 11);
        const len = 3 + level * reach * (0.35 + wobble);
        ctx.moveTo(c + COS[i] * r, c + SIN[i] * r);
        ctx.lineTo(c + COS[i] * (r + len), c + SIN[i] * (r + len));
      }
      ctx.strokeStyle = `rgba(103, 232, 249, ${0.3 + level * 0.6})`;
      ctx.lineWidth = Math.max(1.5, size / 220);
      ctx.lineCap = 'round';
      ctx.stroke();
      // Listening ring: lit only while the mic is live, breathing with its level.
      if (ring > 0.01) {
        ctx.beginPath();
        ctx.arc(c, c, size * 0.25 * (1 + level * 0.07), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(207, 250, 254, ${ring})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Corona just outside the core: grows and brightens with the voice.
      ctx.beginPath();
      ctx.arc(c, c, size * 0.205 * (1 + level * 0.06), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(103, 232, 249, ${0.15 + level * 0.7})`;
      ctx.lineWidth = 1 + level * 3;
      ctx.stroke();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!size) resize();
      const dt = Math.min(64, now - last);
      last = now;
      const p = phase.current;
      let target = REST[p];
      if (!reduced) {
        if (p === 'listening' && meter.current) {
          meter.current.analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
          target = Math.min(1, 0.08 + sum / data.length / 16);
        } else if (p === 'speaking') {
          pulse.current *= Math.pow(0.9, dt / 16.7);
          target = 0.3 + pulse.current * 0.7;
        } else if (p === 'thinking') target = 0.18 + 0.08 * Math.sin(now / 160);
        wobbleT += dt / 16.7;
        level += (target - level) * (1 - Math.pow(0.75, dt / 16.7));
      } else level = target;
      const ringTarget = p === 'listening' ? 0.95 : 0;
      ring = reduced ? ringTarget : ring + (ringTarget - ring) * (1 - Math.pow(0.8, dt / 16.7));

      const progress = p === 'booting' && !reduced ? Math.min(1, (now - born) / bootMs) : 1;
      draw(progress);

      const settled = Math.abs(target - level) < 0.003 && Math.abs(ringTarget - ring) < 0.01;
      const moving = p === 'listening' || p === 'thinking' || p === 'speaking' || (p === 'booting' && progress < 1) || !settled;
      if (!reduced && moving && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (!raf && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    kickRef.current = kick;

    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(el);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else kick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      kickRef.current = () => {};
    };
  }, [canvas, phase, meter, pulse, reduced, bootMs]);

  return useCallback(() => kickRef.current(), []);
}
