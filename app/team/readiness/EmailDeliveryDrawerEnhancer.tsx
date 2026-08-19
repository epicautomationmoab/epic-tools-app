"use client";

import { useEffect } from "react";

type Incident = {
  id: string;
  confirmation_code: string;
  recipient_email: string | null;
  failure_type: string;
  failure_detail: string | null;
  status: string;
  claimed_by: string | null;
};

type IncidentResponse = { incidents?: Incident[] };

function findConfirmation(drawer: Element) {
  for (const card of Array.from(drawer.querySelectorAll("div"))) {
    if (card.querySelector("span")?.textContent?.trim() !== "Booking Confirmation") continue;
    return card.querySelector("strong")?.textContent?.trim() || "";
  }
  return "";
}

function label(type: string) {
  return type.replace(/^email\./, "").replace(/_/g, " ");
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
      const confirmationCode = findConfirmation(drawer);
      if (!confirmationCode) return;

      const existing = drawer.querySelector<HTMLElement>("[data-email-delivery-warning]");
      const incident = incidents.find((item) => item.confirmation_code === confirmationCode && item.status !== "resolved");
      if (!incident) {
        existing?.remove();
        return;
      }
      if (existing?.dataset.incidentId === incident.id) return;
      existing?.remove();

      const warning = document.createElement("div");
      warning.dataset.emailDeliveryWarning = "true";
      warning.dataset.incidentId = incident.id;
      warning.style.margin = "0 20px 16px";
      warning.style.padding = "13px 15px";
      warning.style.border = "1px solid #efb7ae";
      warning.style.borderRadius = "9px";
      warning.style.background = "#fff1ef";
      warning.style.color = "#7f2e25";

      const title = document.createElement("div");
      title.textContent = "Confirmation Email — Delivery Failed";
      title.style.fontWeight = "900";
      title.style.marginBottom = "4px";

      const detail = document.createElement("div");
      detail.textContent = incident.failure_detail || `${label(incident.failure_type)}: ${incident.recipient_email || "recipient unavailable"}`;
      detail.style.fontSize = "12px";
      detail.style.lineHeight = "1.45";

      const hint = document.createElement("div");
      hint.textContent = incident.status === "claimed" && incident.claimed_by
        ? `Claimed by ${incident.claimed_by}. Correct the email below if needed, then resend the confirmation.`
        : "Correct the email below if needed, then resend the confirmation.";
      hint.style.fontSize = "12px";
      hint.style.fontWeight = "750";
      hint.style.marginTop = "6px";

      warning.append(title, detail, hint);

      const facts = Array.from(drawer.querySelectorAll("section")).find((section) =>
        section.textContent?.includes("Booking Confirmation") && section.textContent?.includes("Email"),
      );
      if (facts) facts.insertAdjacentElement("afterend", warning);
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
