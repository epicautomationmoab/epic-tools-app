"use client";

import { useEffect, useMemo } from "react";
import type { ReadinessRow } from "@/lib/supabase";

type PriorEveningRow = ReadinessRow & {
  pickup_prior_evening?: boolean | null;
  original_visit_start_time?: string | null;
};

function formatDate(value: string) {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(`${match[2]}/${match[3]}/${match[1]}`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function confirmationFromRow(row: HTMLTableRowElement) {
  for (const anchor of Array.from(row.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const match = anchor.href.match(/\/trip\/([^/]+)\/bookings/i);
    if (match?.[1]) return decodeURIComponent(match[1]).trim().toUpperCase();
  }
  return null;
}

export default function PriorEveningPickupEnhancer({ rows }: { rows: ReadinessRow[] }) {
  const priorEveningByConfirmation = useMemo(() => {
    const map = new Map<string, PriorEveningRow>();
    for (const row of rows as PriorEveningRow[]) {
      if (row.pickup_prior_evening !== true || !row.confirmation_code) continue;
      map.set(row.confirmation_code.trim().toUpperCase(), row);
    }
    return map;
  }, [rows]);

  useEffect(() => {
    function enhance() {
      for (const table of Array.from(document.querySelectorAll<HTMLTableElement>("table"))) {
        const headings = Array.from(table.querySelectorAll("thead th"))
          .map((heading) => heading.textContent?.trim())
          .filter(Boolean);
        if (!headings.includes("Visit") || !headings.includes("Guest") || !headings.includes("Activity")) {
          continue;
        }

        for (const tableRow of Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"))) {
          const confirmation = confirmationFromRow(tableRow);
          if (!confirmation) continue;
          const readinessRow = priorEveningByConfirmation.get(confirmation);
          if (!readinessRow) continue;

          const visitCell = tableRow.cells[0];
          if (!visitCell) continue;

          // Keep the operational date/time rendered by Readiness itself (5:00 PM
          // on the prior day) so the row both displays and sorts correctly.
          const original = readinessRow.original_visit_start_time;
          if (original) {
            visitCell.title = `Prior Evening Pickup · TripWorks start: ${formatDate(original)} · ${formatWallTime(original)}`;
            visitCell.setAttribute(
              "aria-label",
              `Prior evening pickup at 5:00 PM. TripWorks start ${formatDate(original)} at ${formatWallTime(original)}`,
            );
          }
        }
      }
    }

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [priorEveningByConfirmation]);

  return null;
}
