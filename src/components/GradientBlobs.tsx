/** The three big drifting blobs every 2024 landing page legally requires. */
export function GradientBlobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] animate-drift rounded-full bg-violet-600/30 blur-[120px] dark:bg-violet-600/25" />
      <div className="absolute -right-40 top-1/4 h-[30rem] w-[30rem] animate-drift-slow rounded-full bg-blue-500/25 blur-[120px] dark:bg-blue-600/20" />
      <div className="absolute -bottom-48 left-1/3 h-[32rem] w-[32rem] animate-drift rounded-full bg-pink-500/20 blur-[130px] [animation-delay:-12s] dark:bg-fuchsia-600/15" />
    </div>
  );
}
