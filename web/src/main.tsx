import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { useLocation, Redirect, navigate } from "@/compat/navigation";
import { session, invalidateData } from "@/lib/api";
import AppLayout from "@/app/(app)/layout";
import Login from "@/app/(auth)/login/page";
import Search from "@/app/(app)/search/page";
import Chat from "@/app/(app)/chat/page";
import NotFound from "@/app/(app)/not-found";
import Loading from "@/app/(app)/loading";
import "@/app/globals.css";
const modules = import.meta.glob<{
  default: (args: any) => Promise<ReactNode> | ReactNode;
}>([
  "./app/**/page.tsx",
  "!./app/**/login/page.tsx",
  "!./app/**/search/page.tsx",
  "!./app/**/chat/page.tsx",
]);
function App() {
  const route = useLocation();
  const [content, setContent] = useState<ReactNode>(null);
  const [loadedPath, setLoadedPath] = useState("");
  const [loadedRoute, setLoadedRoute] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const focusAfterLoad = useRef<HTMLElement | null>(null);
  const path = location.pathname.replace(/\/$/, "") || "/";
  useEffect(() => {
    const rememberFocus = () => {
      const active = document.activeElement;
      focusAfterLoad.current =
        active instanceof HTMLElement && pageRef.current?.contains(active)
          ? active
          : null;
    };
    window.addEventListener("bart:navigate", rememberFocus);
    return () => window.removeEventListener("bart:navigate", rememberFocus);
  }, []);
  useEffect(() => {
    let current = true;
    const search = location.search;
    setLoading(true);
    setError("");
    (async () => {
      if (path === "/login") return <Login />;
      invalidateData();
      const auth = await session();
      if (!current) return null;
      if (!auth.user) throw new Redirect("/login");
      if (path === "/search") return <Search />;
      if (path === "/chat") return <Chat />;
      let key = path === "/" ? "" : "/" + path.slice(1);
      const params: Record<string, string> = {};
      if (/^\/games\/\d+$/.test(path)) {
        params.bggId = path.split("/")[2];
        key = "/games/[bggId]";
      }
      if (/^\/users\/[^/]+$/.test(path)) {
        params.userId = path.split("/")[2];
        key = "/users/[userId]";
      }
      const load = modules[`./app/(app)${key}/page.tsx`];
      if (!load) return <NotFound />;
      const mod = await load();
      if (!current) return null;
      return await mod.default({
        params: Promise.resolve(params),
        searchParams: Promise.resolve(
          Object.fromEntries(new URLSearchParams(search)),
        ),
      });
    })()
      .then((node) => {
        if (current) {
          setContent(node);
          setLoadedPath(path);
          setLoadedRoute(route);
        }
      })
      .catch((e) => {
        if (!current) return;
        if (e instanceof Redirect) {
          navigate(e.href, true);
          return;
        }
        setError(e.message || "Could not load this page");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [route, path]);
  const hasContent = content !== null && loadedPath === path;
  const pending = !error && (loading || loadedRoute !== route);
  useLayoutEffect(() => {
    if (pending) return;
    const target = focusAfterLoad.current;
    focusAfterLoad.current = null;
    if (target?.isConnected && document.activeElement === document.body)
      target.focus({ preventScroll: true });
  }, [pending]);
  const body = error ? (
    <div role="alert" className="rounded-lg border border-red-400 p-6">
      <p>{error}</p>
      <button
        onClick={() => window.dispatchEvent(new Event("bart:refresh"))}
        className="mt-4 underline"
      >
        Try again
      </button>
    </div>
  ) : hasContent ? (
    content
  ) : (
    <Loading />
  );
  // Keep same-page controls mounted so query changes animate and refreshes
  // reconcile existing state. Block stale controls until new scope data arrives.
  const page = (
    <div ref={pageRef} aria-busy={pending} inert={pending && hasContent}>
      {body}
    </div>
  );
  return path === "/login" ? page : <AppLayout>{page}</AppLayout>;
}
createRoot(document.getElementById("root")!).render(<App />);
