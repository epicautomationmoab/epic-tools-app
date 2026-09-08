"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

const CHANNEL_TOPIC = "realtime:epic-readiness-signal";
const HEARTBEAT_MS = 25_000;
const RECONNECT_MS = 2_000;
const MIN_REFRESH_GAP_MS = 2_000;
const SYNC_EVENT = "epic-readiness-synced";

function realtimeUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) return null;

  const url = new URL(rawUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/realtime/v1/websocket";
  url.searchParams.set("apikey", key);
  url.searchParams.set("vsn", "1.0.0");
  return { url: url.toString(), key };
}

export default function ReadinessRealtimeRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pendingRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    const config = realtimeUrl();
    if (!config) return;

    let socket: WebSocket | null = null;
    let heartbeatId: number | null = null;
    let reconnectId: number | null = null;
    let stopped = false;
    let ref = 0;

    function nextRef() {
      ref += 1;
      return String(ref);
    }

    function send(event: string, topic: string, payload: Record<string, unknown>) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ topic, event, payload, ref: nextRef() }));
    }

    function refreshFromSignal() {
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

    function connect() {
      if (stopped) return;
      socket = new WebSocket(config.url);

      socket.addEventListener("open", () => {
        send("phx_join", CHANNEL_TOPIC, {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: "" },
            postgres_changes: [
              {
                event: "*",
                schema: "public",
                table: "readiness_realtime_signal",
              },
            ],
            private: false,
          },
          access_token: config.key,
        });

        heartbeatId = window.setInterval(() => {
          send("heartbeat", "phoenix", {});
        }, HEARTBEAT_MS);
      });

      socket.addEventListener("message", (message) => {
        try {
          const parsed = JSON.parse(String(message.data)) as {
            event?: string;
            payload?: { data?: { table?: string } };
          };
          if (
            parsed.event === "postgres_changes" &&
            parsed.payload?.data?.table === "readiness_realtime_signal"
          ) {
            refreshFromSignal();
          }
        } catch {
          // Ignore non-JSON or unrelated Realtime frames.
        }
      });

      socket.addEventListener("close", () => {
        if (heartbeatId !== null) {
          window.clearInterval(heartbeatId);
          heartbeatId = null;
        }
        if (!stopped) reconnectId = window.setTimeout(connect, RECONNECT_MS);
      });
    }

    connect();

    return () => {
      stopped = true;
      if (heartbeatId !== null) window.clearInterval(heartbeatId);
      if (reconnectId !== null) window.clearTimeout(reconnectId);
      socket?.close();
    };
  }, [router, startTransition]);

  return null;
}
