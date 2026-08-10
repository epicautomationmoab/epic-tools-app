"use client";

import { useEffect, useRef, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import CancellationAgreementPanel from "./CancellationAgreementPanel";

const FALLBACK_POLL_INTERVAL_MS = 1500;
const NOTIFICATION_PROMPT_DISMISSED_KEY = "epic-booking-notification-prompt-dismissed";

type CandidateResponse = {
  candidates?: ReadinessRow[];
  error?: string;
};

type NotificationPermissionState = NotificationPermission | "unsupported";

function notificationBody(row: ReadinessRow) {
  return `${row.customer_name} · ${row.product_display_name}`;
}

export default function AutoCancellationPopupWatcher() {
  const startedAt = useRef(new Date().toISOString());
  const seen = useRef(new Set<string>());
  const queued = useRef<ReadinessRow[]>([]);
  const [active, setActive] = useState<ReadinessRow | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>("unsupported");
  const [notificationOptIn, setNotificationOptIn] = useState(true);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = Notification.permission;
    setNotificationPermission(permission);

    if (permission === "default") {
      const dismissed = window.localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY) === "1";
      setShowNotificationPrompt(!dismissed);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: number | null = null;
    let requestInFlight = false;
    let eventSource: EventSource | null = null;

    function showNext() {
      if (cancelled) return;
      setActive((current) => current ?? queued.current.shift() ?? null);
    }

    function sendDesktopNotification(row: ReadinessRow) {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      if (document.visibilityState === "visible" && document.hasFocus()) return;

      const notification = new Notification("Cancellation acknowledgement ready", {
        body: notificationBody(row),
        icon: "/epic-logo.png",
        tag: `epic-cancellation-${row.readiness_id}`,
      });

      notification.onclick = () => {
        window.focus();
        setActive(row);
        notification.close();
      };
    }

    function handleCandidate(row: ReadinessRow) {
      if (!row.readiness_id || seen.current.has(row.readiness_id)) return;
      seen.current.add(row.readiness_id);
      queued.current.push(row);
      sendDesktopNotification(row);
      showNext();
    }

    async function fallbackPoll() {
      if (cancelled || requestInFlight) return;
      requestInFlight = true;

      try {
        const response = await fetch(
          `/api/team/cancellation-popup-candidates?since=${encodeURIComponent(startedAt.current)}`,
          { cache: "no-store" },
        );

        if (response.status === 401) return;
        const data = (await response.json()) as CandidateResponse;
        if (!response.ok) return;
        for (const row of data.candidates ?? []) handleCandidate(row);
      } catch {
        // A later poll retries transient failures.
      } finally {
        requestInFlight = false;
      }
    }

    if ("EventSource" in window) {
      eventSource = new EventSource(
        `/api/team/cancellation-popup-stream?since=${encodeURIComponent(startedAt.current)}`,
      );

      eventSource.addEventListener("booking", (event) => {
        try {
          handleCandidate(JSON.parse((event as MessageEvent<string>).data) as ReadinessRow);
        } catch {
          // Ignore malformed stream events; the stream continues.
        }
      });
    } else {
      void fallbackPoll();
      fallbackTimer = window.setInterval(() => void fallbackPoll(), FALLBACK_POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      eventSource?.close();
      if (fallbackTimer !== null) window.clearInterval(fallbackTimer);
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
      const notification = new Notification("EpicTools notifications are on", {
        body: "New salesperson bookings can now alert you while EpicTools is in the background.",
        icon: "/epic-logo.png",
        tag: "epic-notifications-enabled",
      });
      window.setTimeout(() => notification.close(), 5000);
    }
  }

  function closeActive() {
    setActive(null);
    window.setTimeout(() => {
      const next = queued.current.shift() ?? null;
      setActive(next);
    }, 0);
  }

  return (
    <>
      {showNotificationPrompt && notificationPermission === "default" ? (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 2100,
            width: "min(390px, calc(100vw - 40px))",
            borderRadius: 14,
            background: "#fff",
            boxShadow: "0 16px 50px rgba(0, 0, 0, 0.2)",
            padding: 18,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 17 }}>Enable booking notifications</div>
          <p style={{ margin: "8px 0 14px", lineHeight: 1.45, opacity: 0.75 }}>
            Get an alert when Patti has a new cancellation acknowledgement ready, even while you are working in TripWorks.
          </p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={notificationOptIn}
              onChange={(event) => setNotificationOptIn(event.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>Enable booking notifications on this computer</span>
          </label>
          <button
            type="button"
            onClick={() => void enableNotifications()}
            style={{
              width: "100%",
              border: 0,
              borderRadius: 10,
              padding: "11px 14px",
              font: "inherit",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Continue
          </button>
        </div>
      ) : null}

      {active ? (
        <CancellationAgreementPanel
          key={active.readiness_id}
          row={active}
          autoOpen
          showLauncher={false}
          onPopupClose={closeActive}
        />
      ) : null}
    </>
  );
}
