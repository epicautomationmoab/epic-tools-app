"use client";

import { useEffect } from "react";

function clickAllTimeFilter() {
  const group = document.querySelector('[aria-label="Time filters"]');
  const all = Array.from(group?.querySelectorAll("button") || []).find(
    (button) => button.textContent?.trim() === "All",
  ) as HTMLButtonElement | undefined;
  all?.click();
}

function setSearch(value: string) {
  const input = document.querySelector(
    'input[aria-label="Search guests or activities"]',
  ) as HTMLInputElement | null;
  if (!input) return false;

  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export default function ReservationDeepLinkEnhancer() {
  useEffect(() => {
    const confirmation = new URLSearchParams(window.location.search)
      .get("confirmation")
      ?.trim()
      .toUpperCase();
    if (!confirmation) return;

    let stopped = false;
    let attempts = 0;

    // Readiness defaults to Today. A delivery problem can belong to any future
    // reservation, so reveal all dates and filter directly to the confirmation.
    clickAllTimeFilter();
    setSearch(confirmation);

    const tryOpen = () => {
      if (stopped) return true;
      attempts += 1;

      const rows = Array.from(document.querySelectorAll("tbody tr"));
      const match = rows.find((row) =>
        (row.textContent || "").toUpperCase().includes(confirmation),
      ) as HTMLTableRowElement | undefined;

      if (!match) return false;
      match.click();
      window.history.replaceState({}, "", window.location.pathname);
      return true;
    };

    const timer = window.setInterval(() => {
      if (tryOpen() || attempts >= 40) window.clearInterval(timer);
    }, 150);

    tryOpen();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
