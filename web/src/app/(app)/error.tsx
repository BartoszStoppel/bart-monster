"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold text-on-surface">
        Something went wrong
      </h2>
      <p className="text-sm text-on-surface-variant">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={reset}
        className="stone-button rounded-lg px-4 py-2 text-sm font-medium transition-all"
      >
        Try again
      </button>
    </div>
  );
}
