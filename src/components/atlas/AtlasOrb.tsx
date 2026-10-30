/** Atlas's visual signature: a small cyan sphere with a crisp ring. Static unless `active`, when the ring pulses. */
export function OrbGlyph({ size = 22, active }: { size?: number; active?: boolean }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      {active && <span className="absolute inset-0 animate-pulse rounded-full bg-atlas/30" />}
      <span className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#e0fbff,#22d3ee_45%,#0e7490_80%)]" />
      <span className="absolute inset-0 rounded-full border border-atlas/60" />
    </span>
  );
}

export function AtlasOrb({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex h-12 w-12 items-center justify-center rounded-full border border-atlas/40 bg-overlay shadow-pop transition-colors duration-fast hover:border-atlas"
      aria-label="Ask Atlas (Ctrl/⌘ + J)"
      title="Ask Atlas (⌘J)"
      data-tour="atlas"
    >
      <OrbGlyph size={26} />
    </button>
  );
}
