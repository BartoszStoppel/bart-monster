import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ActivityHeartbeat } from "@/components/activity-heartbeat";
import { TorchGlow } from "@/components/torch-glow";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <TorchGlow />
      <Nav />
      <ActivityHeartbeat />
      <main className="mx-auto w-full max-w-[1280px] flex-grow px-4 py-stack-loose md:px-margin">
        {children}
      </main>
      <Footer />
    </div>
  );
}
