"use client";

import { useEffect } from "react";
import type { ReadinessRow } from "@/lib/supabase";

type Classification = {
  id: string;
  kind: string;
  at: string | null;
  status: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function JourneyCallClassificationEnhancer({ row }: { row: ReadinessRow }) {
  useEffect(() => {
    let stopped = false;
    let classifications: Classification[] = [];

    function apply() {
      if (stopped) return;
      const abandonedTimes = new Set(
        classifications
          .filter((item) => item.kind === "abandoned_call" && item.at)
          .map((item) => formatDateTime(item.at as string)),
      );
      if (!abandonedTimes.size) return;

      const pane = document.querySelector<HTMLElement>(".journey-preview-pane");
      if (!pane) return;
      const titles = Array.from(pane.querySelectorAll<HTMLElement>("div"))
        .filter((node) => node.textContent?.trim() === "Missed Call");

      for (const title of titles) {
        const card = title.closest("article");
        const text = card?.textContent || "";
        const matchesAbandoned = [...abandonedTimes].some((time) => text.includes(time));
        if (matchesAbandoned) title.textContent = "Abandoned Call";
      }
    }

    async function load() {
      try {
        const response = await fetch(`/api/team/readiness/call-classifications?confirmation=${encodeURIComponent(row.confirmation_code)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || stopped) return;
        classifications = payload.classifications || [];
        apply();
      } catch {
        // The communications pane still shows CallRail's fallback classification if this lookup fails.
      }
    }

    const observer = new MutationObserver(() => apply());
    const pane = document.querySelector<HTMLElement>(".journey-preview-pane");
    if (pane) observer.observe(pane, { childList: true, subtree: true, characterData: true });
    void load();

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, [row.confirmation_code]);

  return null;
}
