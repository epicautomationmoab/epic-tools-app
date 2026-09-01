"use client";

import { useEffect } from "react";

type DraftStatus = {
  confirmation_code: string;
  last_trip_status: string | null;
  is_current_draft: boolean;
  tripworks_created_at: string | null;
  last_seen_at: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DraftStatusDrawerEnhancer() {
  useEffect(() => {
    let stopped = false;
    let scheduled = false;

    async function enhance() {
      if (stopped) return;
      const drawer = document.querySelector('[aria-label="Lead details"]');
      if (!drawer) return;

      const links = Array.from(drawer.querySelectorAll<HTMLAnchorElement>('a[href*="/trip/"][href*="/bookings"]'));
      if (!links.length) return;
      const items = links.map((link) => {
        const match = link.href.match(/\/trip\/([^/]+)\/bookings/i);
        return { link, code: match?.[1]?.toUpperCase() || "" };
      }).filter((item) => item.code);
      if (!items.length) return;

      try {
        const response = await fetch(`/api/team/leads/draft-status?confirmations=${encodeURIComponent(items.map((item) => item.code).join(","))}`, { cache: "no-store" });
        const body = await response.json() as { drafts?: DraftStatus[] };
        if (!response.ok || stopped) return;
        const byCode = new Map((body.drafts || []).map((draft) => [draft.confirmation_code.toUpperCase(), draft]));

        for (const item of items) {
          const draft = byCode.get(item.code);
          const card = item.link.closest("article") as HTMLElement | null;
          if (!card || !draft) continue;

          let shopping = card.querySelector<HTMLElement>(`[data-shopping-time="${item.code}"]`);
          if (!shopping) {
            shopping = document.createElement("div");
            shopping.dataset.shoppingTime = item.code;
            shopping.style.marginTop = "8px";
            shopping.style.fontSize = "12px";
            shopping.style.fontWeight = "800";
            shopping.style.color = "#758291";
            card.appendChild(shopping);
          }
          const shoppedAt = draft.tripworks_created_at || draft.last_seen_at;
          shopping.textContent = shoppedAt ? `Shopped ${formatDateTime(shoppedAt)}` : "";

          let badge = card.querySelector<HTMLElement>(`[data-draft-status="${item.code}"]`);
          const cancelled = (draft.last_trip_status || "").toLowerCase() === "cancelled";
          if (!cancelled) {
            badge?.remove();
            continue;
          }
          if (!badge) {
            badge = document.createElement("div");
            badge.dataset.draftStatus = item.code;
            badge.textContent = "Cancelled Draft";
            badge.style.display = "inline-block";
            badge.style.marginTop = "8px";
            badge.style.padding = "5px 9px";
            badge.style.borderRadius = "999px";
            badge.style.background = "#fff0ee";
            badge.style.border = "1px solid #efb2ac";
            badge.style.color = "#b53a31";
            badge.style.fontSize = "12px";
            badge.style.fontWeight = "900";
            card.appendChild(badge);
          }
        }
      } catch {
        // Draft status decoration must never interfere with working a lead.
      }
    }

    function schedule() {
      if (scheduled || stopped) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        void enhance();
      });
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
