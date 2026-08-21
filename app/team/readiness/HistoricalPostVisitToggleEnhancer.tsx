"use client";

import { useEffect } from "react";

type PreferencePayload = {
  sendMode?: "review_request" | "thank_you_only";
  readinessId?: string | null;
  hasPostVisitJob?: boolean;
  jobStatus?: "pending" | "processing" | "sent" | "failed" | "cancelled" | null;
  scheduledFor?: string | null;
  error?: string;
};

function findConfirmation(drawer: Element) {
  for (const card of Array.from(drawer.querySelectorAll<HTMLElement>("div"))) {
    if (card.querySelector(":scope > span")?.textContent?.trim() !== "Booking Confirmation") continue;
    const value = card.querySelector(":scope > strong")?.textContent?.trim();
    if (value) return value;
  }
  return "";
}

function styleButton(button: HTMLButtonElement) {
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.width = "42px";
  button.style.height = "42px";
  button.style.padding = "0";
  button.style.border = "1px solid #c8d0d7";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.color = "#26313b";
  button.style.fontSize = "18px";
  button.style.lineHeight = "1";
  button.style.cursor = "pointer";
  button.style.flex = "0 0 42px";
}

function applyMode(button: HTMLButtonElement, mode: "review_request" | "thank_you_only") {
  const suppressed = mode === "thank_you_only";
  button.dataset.sendMode = mode;
  button.textContent = "★";
  button.style.background = suppressed ? "#b42318" : "#fff";
  button.style.borderColor = suppressed ? "#b42318" : "#c8d0d7";
  button.style.color = suppressed ? "#fff" : "#26313b";
  button.title = suppressed
    ? "Thank You Only — review request suppressed. Click to restore review ask."
    : "Send Thank You + Review Request. Click to suppress the review ask.";
  button.setAttribute("aria-label", button.title);
}

function makeRail() {
  const rail = document.createElement("div");
  rail.id = "historical-reservation-action-rail";
  rail.setAttribute("aria-label", "Reservation actions");
  rail.style.display = "flex";
  rail.style.alignItems = "center";
  rail.style.gap = "8px";
  rail.style.padding = "10px 0 2px";
  rail.style.borderTop = "1px solid #e1e6eb";
  rail.style.marginTop = "10px";
  return rail;
}

export default function HistoricalPostVisitToggleEnhancer() {
  useEffect(() => {
    let scheduled = false;
    let stopped = false;

    async function enhanceDrawer(drawer: HTMLElement) {
      if (drawer.dataset.postVisitHistoryChecked === "true") return;
      drawer.dataset.postVisitHistoryChecked = "true";

      const confirmationCode = findConfirmation(drawer);
      if (!confirmationCode) return;

      let data: PreferencePayload;
      try {
        const response = await fetch(`/api/team/post-visit-email/preference?confirmationCode=${encodeURIComponent(confirmationCode)}`, { cache: "no-store" });
        data = (await response.json()) as PreferencePayload;
        if (!response.ok) throw new Error(data.error || "Unable to load post-visit email status.");
      } catch (error) {
        console.error("Historical post-visit email status unavailable", error);
        return;
      }

      if (stopped || !document.body.contains(drawer)) return;
      if (!data.hasPostVisitJob || !data.readinessId) return;
      if (data.jobStatus === "sent" || data.jobStatus === "cancelled") return;

      const header = drawer.querySelector<HTMLElement>("header");
      if (!header?.parentElement) return;

      const rail = makeRail();
      const button = document.createElement("button");
      button.type = "button";
      button.id = "historical-post-visit-review-toggle";
      styleButton(button);
      applyMode(button, data.sendMode === "thank_you_only" ? "thank_you_only" : "review_request");
      rail.appendChild(button);
      header.insertAdjacentElement("afterend", rail);

      button.addEventListener("click", async () => {
        const current = button.dataset.sendMode === "thank_you_only" ? "thank_you_only" : "review_request";
        const next = current === "thank_you_only" ? "review_request" : "thank_you_only";
        button.disabled = true;
        button.style.opacity = "0.6";
        try {
          const response = await fetch("/api/team/post-visit-email/preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ readinessId: data.readinessId, confirmationCode, sendMode: next }),
          });
          const result = (await response.json()) as PreferencePayload;
          if (!response.ok) throw new Error(result.error || "Unable to update post-visit email preference.");
          applyMode(button, next);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "Unable to update post-visit email preference.");
        } finally {
          button.disabled = false;
          button.style.opacity = "1";
        }
      });
    }

    const enhance = () => {
      scheduled = false;
      const drawers = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-label$="historical reservation details"]'));
      for (const drawer of drawers) void enhanceDrawer(drawer);
    };

    const scheduleEnhance = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(enhance);
    };

    scheduleEnhance();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
