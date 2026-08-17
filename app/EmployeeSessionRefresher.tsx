"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export default function EmployeeSessionRefresher() {
  useEffect(() => {
    let stopped = false;

    async function refresh() {
      try {
        await fetch("/api/auth/refresh-session", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        // A transient network error should not log an employee out.
      }
    }

    function refreshWhenActive() {
      if (!stopped && document.visibilityState === "visible") void refresh();
    }

    // Refresh immediately, periodically, and whenever a sleeping/backgrounded
    // workstation becomes active again. The visibility/focus hooks cover
    // browser timer throttling that can otherwise let an hourly token expire.
    void refresh();
    const timer = window.setInterval(refreshWhenActive, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
    };
  }, []);

  return null;
}
