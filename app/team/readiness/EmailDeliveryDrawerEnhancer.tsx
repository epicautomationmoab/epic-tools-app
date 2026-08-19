"use client";

import { useEffect } from "react";

type Incident = {
  id: string;
  confirmation_code: string;
  status: string;
};

type IncidentResponse = { incidents?: Incident[] };

function normalizedText(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
}

function findConfirmation(drawer: Element) {
  for (const element of Array.from(drawer.querySelectorAll("*"))) {
    if (normalizedText(element) !== "booking confirmation") continue;
    const card = element.parentElement;
    if (!card) continue;
    const text = normalizedText(card);
    const match = text.match(/booking confirmation\s+([a-z0-9-]+)/i);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return "";
}

function findEmailLabel(drawer: Element) {
  for (const element of Array.from(drawer.querySelectorAll("*"))) {
    const text = normalizedText(element);
    if (text === "email" || text === "email ✎" || text === "email ✏") return element;
  }
  return null;
}

export default function EmailDeliveryDrawerEnhancer() {
  useEffect(() => {
    let incidents: Incident[] = [];
    let stopped = false;

    async function load() {
      try {
        const response = await fetch("/api/guest-communications/delivery-incidents", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as IncidentResponse;
        incidents = body.incidents || [];
        enhance();
      } catch {
        // Never interfere with the reservation drawer if delivery status is unavailable.
      }
    }

    function enhance() {
      if (stopped) return;
      const drawer = document.querySelector('[role="dialog"]');
      if (!drawer) return;

      drawer.querySelectorAll("[data-email-delivery-warning]").forEach((node) => node.remove());

      const confirmationCode = findConfirmation(drawer);
      if (!confirmationCode) return;
      const incident = incidents.find((item) => item.confirmation_code?.toUpperCase() === confirmationCode && item.status !== "resolved");
      if (!incident) return;

      const emailLabel = findEmailLabel(drawer);
      if (!emailLabel || emailLabel.querySelector("[data-email-delivery-caution]")) return;

      const caution = document.createElement("span");
      caution.dataset.emailDeliveryCaution = "true";
      caution.textContent = " ⚠";
      caution.title = "Confirmation email delivery failed";
      caution.setAttribute("aria-label", "Confirmation email delivery failed");
      caution.style.color = "#d9a300";
      caution.style.fontSize = "18px";
      caution.style.fontWeight = "700";
      caution.style.lineHeight = "1";
      caution.style.verticalAlign = "middle";

      emailLabel.appendChild(caution);
    }

    void load();
    const timer = window.setInterval(load, 60_000);
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
