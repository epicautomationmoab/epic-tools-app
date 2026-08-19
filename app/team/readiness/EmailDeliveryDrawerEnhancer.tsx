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
    const strong = card.querySelector("strong");
    const value = strong?.textContent?.trim();
    if (value) return value.toUpperCase();
  }
  return "";
}

function findEmailLabel(drawer: Element) {
  const editButton = drawer.querySelector('button[aria-label="Edit email"]');
  return editButton?.closest("span") || null;
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

    async function dismiss(incident: Incident, button: HTMLButtonElement) {
      button.disabled = true;
      button.textContent = "Dismissing...";
      try {
        const response = await fetch("/api/guest-communications/delivery-incidents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ incidentId: incident.id, action: "dismiss" }),
        });
        if (!response.ok) throw new Error(await response.text());
        incidents = incidents.filter((item) => item.id !== incident.id);
        enhance();
        window.dispatchEvent(new Event("email-delivery-incidents-changed"));
      } catch {
        button.disabled = false;
        button.textContent = "Dismiss Alert";
        window.alert("Unable to dismiss the email delivery alert. Please try again.");
      }
    }

    function enhance() {
      if (stopped) return;
      const drawer = document.querySelector('[role="dialog"]');
      if (!drawer) return;

      drawer.querySelectorAll("[data-email-delivery-caution], [data-email-delivery-dismiss]").forEach((node) => node.remove());

      const confirmationCode = findConfirmation(drawer);
      if (!confirmationCode) return;
      const incident = incidents.find(
        (item) => item.confirmation_code?.toUpperCase() === confirmationCode && item.status !== "resolved",
      );
      if (!incident) return;

      const emailLabel = findEmailLabel(drawer);
      if (!emailLabel) return;

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

      const dismissButton = document.createElement("button");
      dismissButton.dataset.emailDeliveryDismiss = "true";
      dismissButton.type = "button";
      dismissButton.textContent = "Dismiss Alert";
      dismissButton.title = "Use when this is the only email available and the delivery problem cannot be corrected.";
      dismissButton.style.marginLeft = "10px";
      dismissButton.style.border = "0";
      dismissButton.style.background = "transparent";
      dismissButton.style.padding = "0";
      dismissButton.style.color = "#8a6500";
      dismissButton.style.fontSize = "12px";
      dismissButton.style.fontWeight = "800";
      dismissButton.style.cursor = "pointer";
      dismissButton.style.textDecoration = "underline";
      dismissButton.onclick = () => void dismiss(incident, dismissButton);
      emailLabel.appendChild(dismissButton);
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
