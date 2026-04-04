"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 60_000;

export function ActivityHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function beat(seconds: number, isVisit: boolean) {
      await supabase.rpc("record_heartbeat", {
        seconds,
        is_visit: isVisit,
      });
    }

    // Record initial visit
    beat(0, true);

    function startInterval() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        beat(60, false);
      }, HEARTBEAT_INTERVAL_MS);
    }

    function stopInterval() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        stopInterval();
      } else {
        startInterval();
      }
    }

    startInterval();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
