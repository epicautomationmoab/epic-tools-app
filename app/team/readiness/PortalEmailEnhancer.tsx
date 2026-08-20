"use client";

import { useEffect } from "react";

type PortalActivity = {
  readinessId: string;
  businessLine: string;
  productDisplayName: string;
};

type PortalPayload = {
  reservation?: { activities?: PortalActivity[] };
};

type GuestFormTask = {
  task_status: string;
  templateKey: string | null;
  pdfReady: boolean;
  documentUrl: string | null;
};

function findBookingConfirmation(drawer: Element) {
  const cards = Array.from(drawer.querySelectorAll("div"));
  for (const card of cards) {
    const label = card.querySelector("span")?.textContent?.trim();
    if (label !== "Booking Confirmation") continue;
    const value = card.querySelector("strong")?.textContent?.trim();
    if (value) return value;
  }
  return "";
}

function findBusinessLine(drawer: Element) {
  const cards = Array.from(drawer.querySelectorAll<HTMLElement>("div"));
  const assure = cards.find((card) => card.querySelector(":scope > span")?.textContent?.trim() === "Adventure Assure");
  const value = assure?.querySelector(":scope > strong")?.textContent?.trim();
  return value === "Tour" ? "tour" : value ? "rental" : null;
}

function portalTokenFromLink(link: HTMLAnchorElement) {
  return link.getAttribute("href")?.match(/^\/guest\/([^/?#]+)/)?.[1] ?? null;
}

function styleSecondaryButton(button: HTMLButtonElement) {
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.marginLeft = "10px";
  button.style.padding = "10px 14px";
  button.style.border = "1px solid #c8d0d7";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.color = "#26313b";
  button.style.fontWeight = "850";
  button.style.cursor = "pointer";
}

function bestActivityMatch(activities: PortalActivity[], businessLine: string, drawer: Element) {
  const candidates = activities.filter((activity) => activity.businessLine?.toLowerCase() === businessLine);
  if (candidates.length <= 1) return candidates[0] ?? null;
  const drawerText = drawer.textContent?.toLowerCase() ?? "";
  return candidates.find((activity) => drawerText.includes(activity.productDisplayName.toLowerCase())) ?? candidates[0] ?? null;
}

export default function PortalEmailEnhancer() {
  useEffect(() => {
    async function enhance() {
      const portalLink = document.querySelector<HTMLAnchorElement>('a[href^="/guest/"]');
      if (!portalLink || portalLink.dataset.emailEnhanced === "true") return;

      const drawer = portalLink.closest('[role="dialog"]');
      if (!drawer) return;

      const guestName = drawer.querySelector("h2")?.textContent?.trim() ?? "Guest";
      const confirmationCode = findBookingConfirmation(drawer);
      const businessLine = findBusinessLine(drawer);
      const portalToken = portalTokenFromLink(portalLink);
      if (!confirmationCode) return;

      const resendButton = document.createElement("button");
      resendButton.type = "button";
      resendButton.textContent = "Resend Confirmation Email";
      resendButton.setAttribute("aria-label", `Resend confirmation email to ${guestName}`);
      styleSecondaryButton(resendButton);

      resendButton.addEventListener("click", async () => {
        const confirmed = window.confirm(`Resend the full confirmation email to ${guestName}?`);
        if (!confirmed) return;
        const originalText = resendButton.textContent;
        resendButton.disabled = true;
        resendButton.textContent = "Sending...";
        resendButton.style.opacity = "0.65";
        try {
          const response = await fetch("/api/guest-communications/resend-confirmation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmationCode }),
          });
          const result = (await response.json()) as { ok?: boolean; error?: string };
          if (!response.ok || result.ok !== true) throw new Error(result.error || "Unable to resend confirmation email.");
          resendButton.textContent = "Confirmation Sent";
          resendButton.style.opacity = "1";
          window.setTimeout(() => {
            resendButton.textContent = originalText;
            resendButton.disabled = false;
          }, 2500);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "Unable to resend confirmation email.");
          resendButton.textContent = originalText;
          resendButton.disabled = false;
          resendButton.style.opacity = "1";
        }
      });

      portalLink.dataset.emailEnhanced = "true";
      portalLink.insertAdjacentElement("afterend", resendButton);

      if (!businessLine || !portalToken) return;

      try {
        const portalResponse = await fetch(`/api/guest/${encodeURIComponent(portalToken)}`, { cache: "no-store" });
        if (!portalResponse.ok) return;
        const portal = (await portalResponse.json()) as PortalPayload;
        const activity = bestActivityMatch(portal.reservation?.activities ?? [], businessLine, drawer);
        if (!activity) return;

        const tasksResponse = await fetch(`/api/team/guest-forms/list?readinessId=${encodeURIComponent(activity.readinessId)}`, { cache: "no-store" });
        if (!tasksResponse.ok) return;
        const tasksData = (await tasksResponse.json()) as { tasks?: GuestFormTask[] };

        const templateKey = businessLine === "rental" ? "pet_acknowledgment" : "minor_driver_authorization";
        const label = businessLine === "rental" ? "🦮 Pet" : "🧍 Teen Driver";
        const existing = (tasksData.tasks ?? []).find((task) => task.templateKey === templateKey && task.task_status !== "cancelled");

        const formButton = document.createElement("button");
        formButton.type = "button";
        formButton.id = "guest-form-quick-add";
        styleSecondaryButton(formButton);

        if (existing?.task_status === "completed") {
          formButton.textContent = `✓ ${label}`;
          formButton.title = "Completed";
          if (existing.pdfReady && existing.documentUrl) {
            formButton.onclick = () => window.open(existing.documentUrl!, "_blank", "noopener,noreferrer");
          } else {
            formButton.disabled = true;
            formButton.style.opacity = "0.65";
            formButton.style.cursor = "default";
          }
        } else if (existing) {
          formButton.textContent = `${label} ✓`;
          formButton.title = "Already in My Epic Reservation";
          formButton.disabled = true;
          formButton.style.opacity = "0.65";
          formButton.style.cursor = "default";
        } else {
          formButton.textContent = label;
          formButton.title = businessLine === "rental"
            ? "Add Pet Acknowledgment to My Epic Reservation"
            : "Add Teen Driver Authorization to My Epic Reservation";
          formButton.onclick = async () => {
            const original = formButton.textContent;
            formButton.disabled = true;
            formButton.textContent = "Adding...";
            formButton.style.opacity = "0.65";
            try {
              const response = await fetch("/api/team/guest-forms/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ readinessId: activity.readinessId, templateKey }),
              });
              const result = (await response.json()) as { error?: string };
              if (!response.ok) throw new Error(result.error || "Unable to add form to portal.");
              formButton.textContent = `${label} ✓`;
              formButton.title = "Added to My Epic Reservation";
              formButton.style.opacity = "1";
            } catch (error) {
              window.alert(error instanceof Error ? error.message : "Unable to add form to portal.");
              formButton.textContent = original;
              formButton.disabled = false;
              formButton.style.opacity = "1";
            }
          };
        }

        resendButton.insertAdjacentElement("afterend", formButton);
      } catch (error) {
        console.error("Guest form quick action unavailable", error);
      }
    }

    void enhance();
    const observer = new MutationObserver(() => void enhance());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
