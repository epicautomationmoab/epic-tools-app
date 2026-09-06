"use client";

import { useEffect, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import CustomerJourneyModal from "../CustomerJourneyModal";

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
      const drawer = document.querySelector('[role="dialog"][aria-label$="reservation details"]');
      if (!drawer) {
        setSelected(null);
        return;
      }

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

    return () => observer.disconnect();
  }, [rows]);

  function closeBoth() {
    setSelected(null);
    const drawer = document.querySelector('[role="dialog"][aria-label$="reservation details"]');
    const closeButton = drawer?.querySelector<HTMLButtonElement>('button[aria-label="Close drawer"]');
    closeButton?.click();
  }

  return selected ? <CustomerJourneyModal row={selected} onClose={closeBoth} /> : null;
}
