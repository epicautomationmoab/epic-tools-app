"use client";

import { useEffect } from "react";
import { recordEmployeeActivity } from "@/lib/employee-activity";
import { usePathname } from "next/navigation";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export default function EmployeeSessionRefresher() {
  const pathname = usePathname();
  useEffect(() => {
    // Authentication upkeep belongs on protected employee workspaces. Running it
    // on /employee-login or /workstation-login can turn an unauthenticated
    // login page into a self-redirect loop and grow the ?next= URL forever.
    if (!pathname || !["/team", "/sales", "/uui-home", "/admin", "/management"].some(root => pathname === root || pathname.startsWith(root + "/"))) return;

    let stopped = false;
    let redirecting = false;

    function redirectToLogin() {
      if (redirecting || stopped) return;
      redirecting = true;
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/uui-login?next=${encodeURIComponent(next)}`);
    }

    async function checkSession() {
      try {
        const status = await fetch("/api/auth/session-status", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (status.ok) return true;
        if (status.status === 401) {
          redirectToLogin();
          return false;
        }
      } catch {
        // A transient network error should not log an employee out.
      }
      return true;
    }

    async function refresh() {
      try {
        const response = await fetch("/api/auth/refresh-session", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });

        if (response.ok) return;

        // A shared workstation does not need an employee refresh token. If an
        // employee session cannot be refreshed, verify whether either valid
        // EpicTools authentication mode is still active before redirecting.
        if (response.status === 401) await checkSession();
      } catch {
        // A transient network error should not log an employee out.
      }
    }

    function refreshWhenActive() {
      if (!stopped && document.visibilityState === "visible") void refresh();
    }

    // Activity in Sales, Home and Admin counts just as activity in Readiness.
    // An expired clock stays expired until PIN unlock or explicit sign-in.
    let lastActivityWrite = 0;
    function recordActivity() {
      const now = Date.now();
      if (now - lastActivityWrite < 15000) return;
      lastActivityWrite = now;
      try { recordEmployeeActivity(window.localStorage, now); } catch { /* Storage may be unavailable. */ }
    }
    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    activityEvents.forEach(event => window.addEventListener(event, recordActivity, { passive: true }));

    // Refresh immediately, periodically, and whenever a sleeping/backgrounded
    // workstation becomes active again. If authentication is truly gone, the
    // status check redirects immediately instead of leaving a stale dashboard.
    void refresh();
    const timer = window.setInterval(refreshWhenActive, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);

    return () => {
      stopped = true;
      activityEvents.forEach(event => window.removeEventListener(event, recordActivity));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
    };
  }, [pathname]);

  return null;
}
