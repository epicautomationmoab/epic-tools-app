"use client";

import { useEffect, useRef, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import CancellationAgreementPanel from "./CancellationAgreementPanel";

const POLL_INTERVAL_MS = 1500;
const NOTIFICATION_PROMPT_DISMISSED_KEY = "epic-booking-notification-prompt-dismissed";

type CandidateResponse = {
  candidates?: ReadinessRow[];
  error?: string;
};

type NotificationPermissionState = NotificationPermission | "unsupported";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export default function AutoCancellationPopupWatcher() {
  const startedAt = useRef(new Date().toISOString());
  const seen = useRef(new Set<string>());
  const queued = useRef<ReadinessRow[]>([]);
  const [active, setActive] = useState<ReadinessRow | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>("unsupported");
  const [notificationOptIn, setNotificationOptIn] = useState(true);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  async function ensurePushSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || Notification.permission !== "granted") return false;

    const configResponse = await fetch("/api/team/push-subscriptions", { cache: "no-store" });
    if (!configResponse.ok) return false;
    const config = await configResponse.json() as { configured?: boolean; publicKey?: string | null };
    if (!config.configured || !config.publicKey) return false;

    const registration = await navigator.serviceWorker.register("/epic-push-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
    }

    const response = await fetch("/api/team/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint, subscription: subscription.toJSON() }),
    });
    return response.ok;
  }

  useEffect(() => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = Notification.permission;
    setNotificationPermission(permission);
    if (permission === "granted") {
      void ensurePushSubscription();
    } else if (permission === "default") {
      const dismissed = window.localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY) === "1";
      setShowNotificationPrompt(!dismissed);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const readinessId = params.get("cancellationReadinessId")?.trim();
    if (!readinessId) return;

    void (async () => {
      try {
        const response = await fetch(`/api/team/cancellation-popup-candidates?readinessId=${encodeURIComponent(readinessId)}`, { cache: "no-store" });
        const data = await response.json() as CandidateResponse;
        const row = data.candidates?.[0];
        if (response.ok && row?.readiness_id) {
          seen.current.add(row.readiness_id);
          setActive(row);
        }
      } finally {
        params.delete("cancellationReadinessId");
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", next);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let requestInFlight = false;

    function showNext() {
      if (cancelled) return;
      setActive((current) => current ?? queued.current.shift() ?? null);
    }

    async function checkForNewBookings() {
      if (cancelled || requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(
          `/api/team/cancellation-popup-candidates?since=${encodeURIComponent(startedAt.current)}`,
          { cache: "no-store" },
        );
        if (response.status === 401) return;
        const data = await response.json() as CandidateResponse;
        if (!response.ok) return;

        for (const row of data.candidates ?? []) {
          if (!row.readiness_id || seen.current.has(row.readiness_id)) continue;
          seen.current.add(row.readiness_id);
          queued.current.push(row);
        }
        showNext();
      } catch {
        // Front-screen popup polling retries on the next interval. Background alerts use web push instead.
      } finally {
        requestInFlight = false;
      }
    }

    void checkForNewBookings();
    timer = window.setInterval(() => void checkForNewBookings(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    if (!notificationOptIn) {
      window.localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, "1");
      setShowNotificationPrompt(false);
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setShowNotificationPrompt(false);

    if (permission === "granted") {
      window.localStorage.removeItem(NOTIFICATION_PROMPT_DISMISSED_KEY);
      const subscribed = await ensurePushSubscription().catch(() => false);
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (subscribed && registration) {
        await registration.showNotification("EpicTools notifications are on", {
          body: "New salesperson bookings can now alert you while you work in TripWorks.",
          icon: "/epic-logo.png",
          tag: "epic-notifications-enabled",
        });
      }
    }
  }

  function closeActive() {
    setActive(null);
    window.setTimeout(() => setActive(queued.current.shift() ?? null), 0);
  }

  return (
    <>
      {showNotificationPrompt && notificationPermission === "default" ? (
        <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 2100, width: "min(390px, calc(100vw - 40px))", borderRadius: 14, background: "#fff", boxShadow: "0 16px 50px rgba(0, 0, 0, 0.2)", padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Enable booking notifications</div>
          <p style={{ margin: "8px 0 14px", lineHeight: 1.45, opacity: 0.75 }}>
            Get an alert when Patti has a new cancellation acknowledgement ready, even while you are working in TripWorks.
          </p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={notificationOptIn} onChange={(event) => setNotificationOptIn(event.target.checked)} style={{ marginTop: 3 }} />
            <span>Enable booking notifications on this computer</span>
          </label>
          <button type="button" onClick={() => void enableNotifications()} style={{ width: "100%", border: 0, borderRadius: 10, padding: "11px 14px", font: "inherit", fontWeight: 800, cursor: "pointer" }}>
            Continue
          </button>
        </div>
      ) : null}

      {active ? (
        <CancellationAgreementPanel key={active.readiness_id} row={active} autoOpen showLauncher={false} onPopupClose={closeActive} />
      ) : null}
    </>
  );
}
