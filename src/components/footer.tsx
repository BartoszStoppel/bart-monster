import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-outline-variant bg-surface-container-lowest">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-4 py-stack-loose md:flex-row md:px-margin">
        <div className="font-display text-headline-lg text-outline">TABLE MONSTERS</div>
        <div className="font-caption text-caption text-on-surface-variant">
          © {new Date().getFullYear()} TABLE MONSTERS — FORGED IN THE DUNGEON
        </div>
        <div className="flex gap-6 font-caption text-caption">
          <Link href="/feedback" className="text-on-surface-variant opacity-80 transition-colors hover:text-secondary-container hover:opacity-100">
            Tome of Rules
          </Link>
          <Link href="/profile" className="text-on-surface-variant opacity-80 transition-colors hover:text-secondary-container hover:opacity-100">
            Your Vault
          </Link>
          <Link href="/community" className="text-on-surface-variant opacity-80 transition-colors hover:text-secondary-container hover:opacity-100">
            The Guild
          </Link>
        </div>
      </div>
    </footer>
  );
}
