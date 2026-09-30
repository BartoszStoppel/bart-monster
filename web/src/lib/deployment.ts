// A tab can retain the previous release's entry script after deployment. Its
// not-yet-loaded page chunks may no longer exist on the canonical hostname.
export function isAssetLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    message,
  );
}

export function reloadSite(): boolean {
  if (
    !window.dispatchEvent(
      new CustomEvent("bart:navigate", { cancelable: true }),
    )
  )
    return false;
  location.reload();
  return true;
}

export async function recoverPageLoad(
  error: unknown,
  isCurrent: () => boolean,
): Promise<boolean> {
  if (!isAssetLoadError(error)) return false;
  try {
    const selector = 'script[type="module"][src]';
    const current = document.querySelector<HTMLScriptElement>(selector)?.src;
    const response = await fetch(location.href, {
      cache: "no-store",
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(5000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/html")
    )
      return false;
    const html = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    const src = html.querySelector(selector)?.getAttribute("src");
    if (!src || !current || !isCurrent()) return false;
    const next = new URL(src, location.href);
    if (next.origin !== location.origin || next.href === current) return false;

    // At most one automatic reload per destination release, even if the new
    // release also has a broken asset. Explicit retry remains available.
    const key = "bart:reloaded-deployment";
    if (sessionStorage.getItem(key) === next.href) return false;
    if (
      !window.dispatchEvent(
        new CustomEvent("bart:navigate", { cancelable: true }),
      )
    )
      return false;
    sessionStorage.setItem(key, next.href);
    location.reload();
    return true;
  } catch {
    // Offline, unavailable storage, or a failed update check: show the reload
    // control rather than repeatedly navigating or hiding the original error.
    return false;
  }
}
