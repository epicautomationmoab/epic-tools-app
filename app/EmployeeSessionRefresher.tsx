"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

export default function EmployeeSessionRefresher() {
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        await fetch("/api/auth/refresh-session", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
      } catch {
        // A failed refresh simply leaves the current session unchanged.
      }
    }

    void refresh();

    const interval = window.setInterval(() => {
      if (!cancelled) void refresh();
    }, REFRESH_INTERVAL_MS);

    function onVisibilityChange() {
      if (!cancelled && document.visibilityState === "visible") void refresh();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
