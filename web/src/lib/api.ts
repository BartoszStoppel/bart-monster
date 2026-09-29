import type { User } from "@/compat/database-types";
export type Row = Record<string, any>;
export interface Bootstrap {
  user: User | null;
  tables: Record<string, Row[]>;
}
let sessionPromise:
  Promise<{ user: User | null; csrf_token: string }> | undefined;
let bootstrapPromise: Promise<Bootstrap> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
export async function request<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("X-CSRF-Token", (await session()).csrf_token);
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.error || data.message || `Request failed (${response.status})`,
    );
    Object.assign(error, { status: response.status, data });
    throw error;
  }
  return data;
}
export function session() {
  return (sessionPromise ??= request("/api/session")
    .then((result) => {
      if (result.user)
        result.user = {
          ...result.user,
          user_metadata: {
            full_name: result.user.display_name,
            avatar_url: result.user.avatar_url,
            ...result.user.user_metadata,
          },
        };
      return result;
    })
    .catch((error) => {
      sessionPromise = undefined;
      throw error;
    }));
}
export function bootstrap() {
  return (bootstrapPromise ??= request<Bootstrap>("/api/bootstrap").catch(
    (error) => {
      bootstrapPromise = undefined;
      throw error;
    },
  ));
}
export function invalidateData(refresh = false) {
  bootstrapPromise = undefined;
  if (refresh) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(
      () => window.dispatchEvent(new Event("bart:refresh")),
      20,
    );
  }
}
export async function action(
  action: string,
  args: Record<string, unknown>,
  refresh = true,
) {
  const result = await request("/api/actions", {
    method: "POST",
    body: JSON.stringify({ action, args }),
  });
  invalidateData(refresh);
  if (action === "updateProfile") {
    sessionPromise = undefined;
    window.dispatchEvent(new Event("bart:identity"));
  }
  return result;
}
export async function signOut() {
  await request("/api/auth/logout", { method: "POST", body: "{}" });
  sessionPromise = undefined;
  invalidateData();
  location.assign("/login");
}
export async function signIn() {
  const result = await request("/api/auth/google", {
    method: "POST",
    body: "{}",
  });
  location.assign(result.redirect_url);
}
export function metric() {
  return new URLSearchParams(location.search).get("metric") === "difficulty"
    ? "difficulty"
    : "enjoyment";
}
