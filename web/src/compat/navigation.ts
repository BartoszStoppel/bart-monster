import { useSyncExternalStore } from "react";
const listeners = new Set<() => void>();
let refreshVersion = 0;
export function notifyNavigation() {
  for (const fn of listeners) fn();
}
let previousHref = location.pathname + location.search;
window.addEventListener("popstate", () => {
  const event = new CustomEvent("bart:navigate", { cancelable: true });
  if (!window.dispatchEvent(event)) {
    history.pushState({}, "", previousHref);
    return;
  }
  previousHref = location.pathname + location.search;
  notifyNavigation();
});
window.addEventListener("bart:refresh", () => {
  if (
    !window.dispatchEvent(
      new CustomEvent("bart:navigate", { cancelable: true }),
    )
  )
    return;
  refreshVersion++;
  notifyNavigation();
});
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function useLocation() {
  return useSyncExternalStore(
    subscribe,
    () => `${location.pathname}${location.search}#${refreshVersion}`,
  );
}
export function navigate(href: string, replace = false) {
  const event = new CustomEvent("bart:navigate", { cancelable: true });
  if (!window.dispatchEvent(event)) return;
  const target = new URL(href, location.href);
  if (target.origin !== location.origin) {
    location.assign(target.href);
    return;
  }
  history[replace ? "replaceState" : "pushState"]({}, "", href);
  previousHref = location.pathname + location.search;
  notifyNavigation();
  window.scrollTo(0, 0);
}
export function usePathname() {
  useLocation();
  return location.pathname;
}
export function useSearchParams() {
  useLocation();
  return new URLSearchParams(location.search);
}
export function useRouter() {
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, true),
    refresh: () => window.dispatchEvent(new Event("bart:refresh")),
    back: () => history.back(),
  };
}
export class Redirect extends Error {
  constructor(public href: string) {
    super("Redirect");
  }
}
export function redirect(href: string): never {
  throw new Redirect(href);
}
export function notFound(): never {
  throw new Error("Page not found");
}
