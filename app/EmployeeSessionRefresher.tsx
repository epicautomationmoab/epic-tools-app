"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export default function EmployeeSessionRefresher() {
  useEffect(() => {
    // Authentication upkeep only belongs on protected team pages. Running it
    // on /employee-login or /workstation-login can turn an unauthenticated
    // login page into a self-redirect loop and grow the ?next= URL forever.
    if (!window.location.pathname.startsWith("/team")) return;

    let stopped = false;
    let redirecting = false;

    function redirectToLogin() {
      if (redirecting || stopped) return;
      redirecting = true;
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/employee-login?next=${encodeURIComponent(next)}`);
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

    // Refresh immediately, periodically, and whenever a sleeping/backgrounded
    // workstation becomes active again. If authentication is truly gone, the
    // status check redirects immediately instead of leaving a stale dashboard.
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
