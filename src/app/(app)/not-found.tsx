import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold text-on-surface">
        Page Not Found
      </h2>
      <p className="text-sm text-on-surface-variant">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="stone-button rounded-lg px-4 py-2 text-sm font-medium transition-all"
      >
        Back to Collection
      </Link>
    </div>
  );
}
