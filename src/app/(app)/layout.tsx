import { Nav } from "@/components/nav";
import { ActivityHeartbeat } from "@/components/activity-heartbeat";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Nav />
      <ActivityHeartbeat />
      <main className="mx-auto max-w-7xl px-2 py-6">{children}</main>
    </div>
  );
}
