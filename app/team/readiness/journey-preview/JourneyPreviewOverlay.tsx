"use client";

import { useEffect, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import CustomerJourneyPane from "../CustomerJourneyPane";
import JourneyEmailComposerEnhancer from "./JourneyEmailComposerEnhancer";
import JourneyCallClassificationEnhancer from "./JourneyCallClassificationEnhancer";
import JourneyReachOutLabelEnhancer from "./JourneyReachOutLabelEnhancer";
import JourneyBookingTimelineEnhancer from "./JourneyBookingTimelineEnhancer";

function normalizedText(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
}

function findConfirmation(drawer: Element) {
  for (const element of Array.from(drawer.querySelectorAll("*"))) {
    if (normalizedText(element) !== "booking confirmation") continue;
    const card = element.parentElement;
    const strong = card?.querySelector("strong");
    const value = strong?.textContent?.trim();
    if (value) return value.toUpperCase();
  }
  return "";
}

function closeReservationDrawer() {
  const drawer = document.querySelector<HTMLElement>('[role="dialog"][aria-label$="reservation details"]');
  const closeButton = drawer?.querySelector<HTMLButtonElement>('button[aria-label="Close drawer"]');
  closeButton?.click();
}

export default function JourneyPreviewOverlay({ rows }: { rows: ReadinessRow[] }) {
  const [selected, setSelected] = useState<ReadinessRow | null>(null);

  useEffect(() => {
    let scheduled = false;

    function syncFromDrawer() {
      const drawer = document.querySelector<HTMLElement>('[role="dialog"][aria-label$="reservation details"]');
      if (!drawer) {
        document.body.classList.remove("journey-preview-open");
        setSelected(null);
        return;
      }

      document.body.classList.add("journey-preview-open");
      drawer.dataset.journeyPreviewDrawer = "true";

      const confirmation = findConfirmation(drawer);
      if (!confirmation) return;

      const row = rows.find((candidate) => candidate.confirmation_code?.toUpperCase() === confirmation);
      if (row) setSelected((current) => current?.confirmation_code === row.confirmation_code ? current : row);
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        syncFromDrawer();
      });
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();

    return () => {
      document.body.classList.remove("journey-preview-open");
      observer.disconnect();
    };
  }, [rows]);

  return selected ? (
    <>
      <button
        type="button"
        aria-label="Close reservation details"
        onClick={closeReservationDrawer}
        style={{
          position: "fixed",
          top: 36,
          right: 40,
          zIndex: 120,
          width: 40,
          height: 40,
          border: 0,
          borderRadius: 999,
          background: "#f0f2f4",
          color: "#111827",
          fontSize: 28,
          lineHeight: "40px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(8,16,28,.12)",
        }}
      >×</button>
      <div className="journey-preview-pane" aria-label="Customer journey preview pane">
        <CustomerJourneyPane row={selected} />
      </div>
      <JourneyEmailComposerEnhancer row={selected} />
      <JourneyCallClassificationEnhancer row={selected} />
      <JourneyReachOutLabelEnhancer />
      <JourneyBookingTimelineEnhancer row={selected} />
    </>
  ) : null;
}
