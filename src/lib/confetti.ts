import confetti from 'canvas-confetti';

export function celebrate(origin?: { x: number; y: number }) {
  const colors = ['#a855f7', '#6366f1', '#3b82f6', '#ec4899', '#f0abfc'];
  confetti({ particleCount: 90, spread: 75, startVelocity: 42, origin: origin ?? { y: 0.7 }, colors, disableForReducedMotion: true });
}

export function originFromEvent(e: { clientX: number; clientY: number }) {
  return { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
}
