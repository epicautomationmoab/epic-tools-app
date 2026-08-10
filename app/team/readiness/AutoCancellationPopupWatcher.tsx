"use client";

import { useEffect, useRef, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import CancellationAgreementPanel from "./CancellationAgreementPanel";

const POLL_INTERVAL_MS = 1500;

type CandidateResponse = {
  candidates?: ReadinessRow[];
  error?: string;
};

export default function AutoCancellationPopupWatcher() {
  const startedAt = useRef(new Date().toISOString());
  const seen = useRef(new Set<string>());
  const queued = useRef<ReadinessRow[]>([]);
  const [active, setActive] = useState<ReadinessRow | null>(null);

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

        const data = (await response.json()) as CandidateResponse;
        if (!response.ok) return;

        for (const row of data.candidates ?? []) {
          if (!row.readiness_id || seen.current.has(row.readiness_id)) continue;
          seen.current.add(row.readiness_id);
          queued.current.push(row);
        }

        showNext();
      } catch {
        // Keep the sales screen quiet on transient network failures; the next poll retries.
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

  function closeActive() {
    setActive(null);
    window.setTimeout(() => {
      const next = queued.current.shift() ?? null;
      setActive(next);
    }, 0);
  }

  if (!active) return null;

  return (
    <CancellationAgreementPanel
      key={active.readiness_id}
      row={active}
      autoOpen
      showLauncher={false}
      onPopupClose={closeActive}
    />
  );
}
