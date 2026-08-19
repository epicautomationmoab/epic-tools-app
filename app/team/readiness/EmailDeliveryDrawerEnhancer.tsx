"use client";

import { useEffect } from "react";

type Incident = {
  id: string;
  confirmation_code: string;
  status: string;
};

type IncidentResponse = { incidents?: Incident[] };

function findConfirmation(drawer: Element) {
  const bookingLabel = Array.from(drawer.querySelectorAll("span")).find(
    (span) => span.textContent?.trim() === "Booking Confirmation",
  );
  const card = bookingLabel?.parentElement;
  if (!card) return "";

  const strong = card.querySelector("strong");
  return strong?.textContent?.replace(/\s+/g, "").trim().toUpperCase() || "";
}

function findEmailLabel(drawer: Element) {
  const editButton = drawer.querySelector<HTMLButtonElement>(
    'button[aria-label="Edit email"]',
  );
  return editButton?.parentElement || null;
}

export default function EmailDeliveryDrawerEnhancer() {
  useEffect(() => {
    let incidents: Incident[] = [];
    let stopped = false;
    let enhancing = false;

    async function load() {
      try {
        const response = await fetch("/api/guest-communications/delivery-incidents", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as IncidentResponse;
        incidents = body.incidents || [];
        enhance();
      } catch {
        // Delivery status must never interfere with the reservation drawer.
      }
    }

    function enhance() {
      if (stopped || enhancing) return;
      const drawer = document.querySelector('[role="dialog"]');
      if (!drawer) return;

      const confirmationCode = findConfirmation(drawer);
      if (!confirmationCode) return;

      const incident = incidents.find(
        (item) =>
          item.confirmation_code?.replace(/\s+/g, "").toUpperCase() ===
            confirmationCode && item.status !== "resolved",
      );

      const existing = drawer.querySelector<HTMLElement>(
        "[data-email-delivery-caution]",
      );
      if (!incident) {
        existing?.remove();
        return;
      }
      if (existing) return;

      const emailLabel = findEmailLabel(drawer);
      if (!emailLabel) return;

      enhancing = true;
      const caution = document.createElement("span");
      caution.dataset.emailDeliveryCaution = "true";
      caution.textContent = "⚠";
      caution.title = "Confirmation email delivery failed";
      caution.setAttribute("aria-label", "Confirmation email delivery failed");
      caution.style.marginLeft = "7px";
      caution.style.color = "#d9a300";
      caution.style.fontSize = "18px";
      caution.style.fontWeight = "700";
      caution.style.lineHeight = "1";
      caution.style.verticalAlign = "middle";
      emailLabel.appendChild(caution);
      enhancing = false;
    }

    void load();
    const timer = window.setInterval(load, 30_000);
    const observer = new MutationObserver(() => enhance());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
