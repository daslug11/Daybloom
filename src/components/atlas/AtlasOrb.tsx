import { cn } from '../../lib/utils';

/** Atlas's visual signature: a small glowing orb. Static unless `active`. */
export function OrbGlyph({ size = 22, active }: { size?: number; active?: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <span className={cn('absolute inset-0 rounded-full bg-cyan-400/40 blur-[6px]', active && 'animate-pulse')} />
      <span className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#e0fbff,#22d3ee_45%,#0e7490_80%)]" />
      <span className="absolute inset-0 rounded-full border border-cyan-300/60" />
    </span>
  );
}

export function AtlasOrb({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/40 bg-[#0b1220] shadow-lg shadow-cyan-900/30 transition hover:border-cyan-300"
      aria-label="Ask Atlas (Ctrl/⌘ + J)"
      title="Ask Atlas (⌘J)"
      data-tour="atlas"
    >
      <OrbGlyph size={26} />
    </button>
  );
}
