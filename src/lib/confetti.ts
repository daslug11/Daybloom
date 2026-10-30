import confetti from 'canvas-confetti';

export function celebrate(origin?: { x: number; y: number }) {
  // A rare celebration (a goal reached): success green, gold and ink — no brand gradient.
  const colors = ['#4ade80', '#22c55e', '#fbbf24', '#f4f4f5', '#a1a1aa'];
  confetti({ particleCount: 90, spread: 75, startVelocity: 42, origin: origin ?? { y: 0.7 }, colors, disableForReducedMotion: true });
}

export function originFromEvent(e: { clientX: number; clientY: number }) {
  return { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
}
