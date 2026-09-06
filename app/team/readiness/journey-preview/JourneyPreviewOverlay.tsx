"use client";

import { useEffect, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import CustomerJourneyPane from "../CustomerJourneyPane";

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
    <div className="journey-preview-pane" aria-label="Customer journey preview pane">
      <CustomerJourneyPane row={selected} />
    </div>
  ) : null;
}
