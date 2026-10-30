import type { ReactNode } from 'react';

interface Props {
  progress: number; // 0–1
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

export function ProgressRing({ progress, size = 260, stroke = 12, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    // Scales down on narrow screens (320px phones) instead of overflowing its card.
    <div className="relative aspect-square" style={{ width: `min(${size}px, 100%)` }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-ink"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(Math.max(progress, 0), 1))}
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
