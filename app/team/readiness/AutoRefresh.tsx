"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 10_000;
const MIN_REFRESH_GAP_MS = 1_500;
const SYNC_EVENT = "epic-readiness-synced";

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefreshAt = 0;

    function refreshWhenVisible() {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastRefreshAt < MIN_REFRESH_GAP_MS) return;

      lastRefreshAt = now;
      router.refresh();
      window.dispatchEvent(new Event(SYNC_EVENT));
    }

    const intervalId = window.setInterval(
      refreshWhenVisible,
      REFRESH_INTERVAL_MS,
    );

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [router]);

  return null;
}
