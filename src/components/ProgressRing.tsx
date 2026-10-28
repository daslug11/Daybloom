import { motion } from 'framer-motion';
import { useId } from 'react';

interface Props {
  progress: number; // 0–1
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}

export function ProgressRing({ progress, size = 280, stroke = 14, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gradientId = `ring${useId().replace(/:/g, '')}`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 drop-shadow-[0_0_24px_rgba(139,92,246,0.55)]">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-900/10 dark:stroke-white/10" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - progress) }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
