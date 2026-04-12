export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.3)] dark:border-white/10 dark:border-t-cyan-400" />
    </div>
  );
}
