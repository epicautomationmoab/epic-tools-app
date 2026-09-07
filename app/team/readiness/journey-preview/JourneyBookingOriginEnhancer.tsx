"use client";

import { useEffect } from "react";
import type { ReadinessRow } from "@/lib/supabase";

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
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

function normalizedText(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
}

function findFactsContainer(drawer: HTMLElement) {
  for (const element of Array.from(drawer.querySelectorAll("span"))) {
    if (normalizedText(element) !== "booking confirmation") continue;
    return element.parentElement?.parentElement as HTMLElement | null;
  }
  return null;
}

function addFact(container: HTMLElement, label: string, value: string, key: string) {
  const card = document.createElement("div");
  card.dataset.journeyBookingOrigin = key;
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  valueNode.textContent = value;
  card.append(labelNode, valueNode);
  container.appendChild(card);
}

export default function JourneyBookingOriginEnhancer({ row }: { row: ReadinessRow }) {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function apply() {
      const drawer = document.querySelector<HTMLElement>('[role="dialog"][aria-label$="reservation details"]');
      if (!drawer) return;
      const facts = findFactsContainer(drawer);
      if (!facts) return;

      facts.querySelectorAll("[data-journey-booking-origin]").forEach((node) => node.remove());

      try {
        const response = await fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(row.confirmation_code)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || cancelled) return;

        addFact(facts, "Booking Method", payload.booking_method || "Not available", "method");
        addFact(facts, "Booked At", formatDateTime(payload.booked_at || null), "booked-at");
        addFact(facts, "Sold By", payload.booking_sold_by || "Not available", "sold-by");
      } catch {
        if (cancelled) return;
        addFact(facts, "Booking Method", "Not available", "method");
        addFact(facts, "Booked At", "Not available", "booked-at");
        addFact(facts, "Sold By", "Not available", "sold-by");
      }
    }

    const schedule = () => window.requestAnimationFrame(() => void apply());
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    void apply();

    return () => {
      cancelled = true;
      observer?.disconnect();
      document.querySelectorAll("[data-journey-booking-origin]").forEach((node) => node.remove());
    };
  }, [row.confirmation_code]);

  return null;
}
