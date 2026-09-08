"use client";

import { useEffect } from "react";
import type { ReadinessRow } from "@/lib/supabase";

function formatDateTime(value: string | null) {
  if (!value) return "Booking time unavailable";
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

export default function JourneyBookingTimelineEnhancer({ row }: { row: ReadinessRow }) {
  useEffect(() => {
    let cancelled = false;
    let bookingMethod: string | null = null;
    let bookedAt: string | null = null;
    let soldBy: string | null = null;
    let timer: number | null = null;

    function removeCard() {
      document.querySelectorAll("[data-journey-booking-event]").forEach((node) => node.remove());
    }

    function renderCard() {
      if (cancelled) return;
      const pane = document.querySelector<HTMLElement>(".journey-preview-pane");
      if (!pane) return;

      const communicationTimeline = pane.querySelector<HTMLElement>('[aria-label="Communication timeline"]');
      if (!communicationTimeline) {
        removeCard();
        return;
      }

      if (pane.querySelector("[data-journey-booking-event]")) return;

      const card = document.createElement("article");
      card.dataset.journeyBookingEvent = "true";
      card.style.cssText = "position:relative;margin:0 0 10px;padding:10px 14px 10px 22px;border:1px solid #e1e6eb;border-radius:12px;background:#fffaf7;color:#202733;";

      const dot = document.createElement("span");
      dot.style.cssText = "position:absolute;left:-7px;top:50%;width:13px;height:13px;border-radius:999px;background:#e45b22;border:3px solid #fff;box-shadow:0 0 0 1px #e45b22;transform:translateY(-50%);";

      const top = document.createElement("div");
      top.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;";
      const title = document.createElement("strong");
      title.textContent = "Reservation booked";
      title.style.cssText = "font-size:14px;font-weight:900;";
      const badge = document.createElement("span");
      badge.textContent = "R";
      badge.style.cssText = "display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#fff0e8;color:#c84816;font-size:10px;font-weight:900;";
      top.append(title, badge);

      const meta = document.createElement("div");
      meta.style.cssText = "margin-top:5px;color:#6f7885;font-size:12px;line-height:1.35;";
      const details = [bookingMethod, soldBy ? `Sold by ${soldBy}` : null].filter(Boolean).join(" · ");
      meta.textContent = `${formatDateTime(bookedAt)}${details ? ` · ${details}` : ""}`;

      card.append(dot, top, meta);

      const eventList = communicationTimeline.nextElementSibling;
      if (eventList) eventList.insertBefore(card, eventList.firstChild);
    }

    async function load() {
      try {
        const response = await fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(row.confirmation_code)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || cancelled) return;
        bookingMethod = payload.booking_method || null;
        bookedAt = payload.booked_at || null;
        soldBy = payload.booking_sold_by || null;
        renderCard();
      } catch {
        if (!cancelled) renderCard();
      }
    }

    void load();
    timer = window.setInterval(renderCard, 150);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      removeCard();
    };
  }, [row.confirmation_code]);

  return null;
}
