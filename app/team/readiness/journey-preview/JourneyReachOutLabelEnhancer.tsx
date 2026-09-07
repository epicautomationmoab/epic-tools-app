"use client";

import { useEffect } from "react";

export default function JourneyReachOutLabelEnhancer() {
  useEffect(() => {
    let scheduled = false;

    function applyLabel() {
      scheduled = false;
      const pane = document.querySelector<HTMLElement>(".journey-preview-pane");
      if (!pane) return;
      const buttons = Array.from(pane.querySelectorAll<HTMLButtonElement>("button"));
      const outbound = buttons.find((button) => button.textContent?.trim() === "Outbound");
      if (outbound) outbound.textContent = "Reach Out";
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(applyLabel);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();

    return () => observer.disconnect();
  }, []);

  return null;
}
