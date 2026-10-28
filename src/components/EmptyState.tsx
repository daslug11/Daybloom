export function EmptyState({ emoji, hint }: { emoji: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="text-5xl drop-shadow-[0_0_24px_rgba(167,139,250,0.6)]">{emoji}</div>
      <p className="font-semibold">Nothing here yet — let's change that! 🚀</p>
      {hint && <p className="muted text-sm">{hint}</p>}
    </div>
  );
}
