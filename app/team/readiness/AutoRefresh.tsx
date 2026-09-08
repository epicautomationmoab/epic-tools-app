"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30_000;
const MIN_REFRESH_GAP_MS = 5_000;
const SYNC_EVENT = "epic-readiness-synced";

export default function AutoRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pendingRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState !== "visible") return;
      if (pendingRef.current) return;

      const now = Date.now();
      if (now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) return;

      lastRefreshAtRef.current = now;
      pendingRef.current = true;

      startTransition(() => {
        router.refresh();
      });

      window.dispatchEvent(new Event(SYNC_EVENT));
    }

    const intervalId = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [router, startTransition]);

  return null;
}
