import { useCallback, useEffect, useRef, useState } from "react";
import { invalidateData, request } from "./api";
export type RankingEntry = { id: number | string; tier: string };
export function useRankingSave(endpoint: string, initialRevision: string) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<RankingEntry[][]>([]);
  const running = useRef(false);
  const revision = useRef<string | undefined>(initialRevision);
  const last = useRef<string | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const block = (event: Event) => {
      if (queue.current.length) {
        event.preventDefault();
        if (event.type === "beforeunload")
          (event as BeforeUnloadEvent).returnValue = "";
      }
    };
    window.addEventListener("beforeunload", block);
    window.addEventListener("bart:navigate", block);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", block);
      window.removeEventListener("bart:navigate", block);
    };
  }, []);
  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSaving(true);
    try {
      let attempt = 0;
      while (queue.current.length) {
        try {
          if (revision.current === undefined)
            revision.current = (await request(endpoint)).revision;
          const response = await request(endpoint, {
            method: "POST",
            body: JSON.stringify({
              revision: revision.current,
              entries: queue.current[0],
            }),
          });
          revision.current = response.revision;
          queue.current.shift();
          attempt = 0;
          invalidateData();
          if (mounted.current) setError(null);
        } catch (e) {
          const status = (e as Error & { status?: number }).status;
          if (status && status < 500 && status !== 429) {
            if (mounted.current)
              setError(
                status === 409
                  ? "These rankings changed in another tab. Your moves are retained here; reload to use the latest saved rankings."
                  : (e as Error).message,
              );
            return;
          }
          if (mounted.current)
            setError(
              "Connection interrupted. Your moves are retained and will retry automatically.",
            );
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(1000 * 2 ** attempt++, 15000)),
          );
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setSaving(queue.current.length > 0);
    }
  }, [endpoint]);
  const save = useCallback(
    (entries: RankingEntry[]) => {
      const key = JSON.stringify(entries);
      if (key === last.current) return;
      last.current = key;
      queue.current.push(entries.map((e) => ({ ...e })));
      void drain();
    },
    [drain],
  );
  return { save, saving, error };
}
