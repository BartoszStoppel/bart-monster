import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Nav />
      <main className="mx-auto max-w-7xl px-2 py-6">{children}</main>
    </div>
  );
}
