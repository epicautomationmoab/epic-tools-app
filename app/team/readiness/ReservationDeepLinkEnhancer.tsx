"use client";

import { useEffect } from "react";

export default function ReservationDeepLinkEnhancer() {
  useEffect(() => {
    const confirmation = new URLSearchParams(window.location.search)
      .get("confirmation")
      ?.trim()
      .toUpperCase();

    if (!confirmation) return;

    let attempts = 0;
    const openMatchingReservation = () => {
      attempts += 1;

      for (const row of Array.from(document.querySelectorAll("tbody tr"))) {
        const text = row.textContent?.toUpperCase() || "";
        if (!text.includes(confirmation)) continue;
        (row as HTMLElement).click();
        window.history.replaceState({}, "", window.location.pathname);
        return true;
      }

      return false;
    };

    if (openMatchingReservation()) return;

    const timer = window.setInterval(() => {
      if (openMatchingReservation() || attempts >= 20) {
        window.clearInterval(timer);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  return null;
}
