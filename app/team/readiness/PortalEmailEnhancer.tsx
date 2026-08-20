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
  button.style.marginLeft = "8px";
  button.style.padding = "10px 12px";
  button.style.border = "1px solid #c8d0d7";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.color = "#26313b";
  button.style.fontWeight = "850";
  button.style.cursor = "pointer";
}

function styleIconButton(button: HTMLButtonElement) {
  styleSecondaryButton(button);
  button.style.width = "42px";
  button.style.height = "42px";
  button.style.padding = "0";
  button.style.fontSize = "20px";
  button.style.lineHeight = "1";
  button.style.flex = "0 0 42px";
}

function bestActivityMatch(activities: PortalActivity[], businessLine: string, drawer: Element) {
  const candidates = activities.filter((activity) => activity.businessLine?.toLowerCase() === businessLine);
  if (candidates.length <= 1) return candidates[0] ?? null;
  const drawerText = drawer.textContent?.toLowerCase() ?? "";
  return candidates.find((activity) => drawerText.includes(activity.productDisplayName.toLowerCase())) ?? candidates[0] ?? null;
}

function findCancellationCard(drawer: Element) {
  const nodes = Array.from(drawer.querySelectorAll<HTMLElement>("h1,h2,h3,h4,strong,p,div"));
  const heading = nodes.find((node) => {
    const text = node.textContent?.trim();
    return text === "Cancellation Policy Acknowledgement" || text === "Cancellation Policy Acknowledgment";
  });
  return heading?.closest("section") as HTMLElement | null;
}

function makeSignedFormRow(actionName: string, documentUrl: string) {
  const row = document.createElement("div");
  row.id = "guest-form-signed-row";
  row.style.margin = "10px 0 12px";
  row.style.padding = "10px 12px";
  row.style.border = "1px solid #cfe7d6";
  row.style.borderRadius = "10px";
  row.style.background = "#f2fbf5";
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "12px";
  row.style.fontSize = "12px";
  row.style.width = "100%";
  row.style.boxSizing = "border-box";

  const status = document.createElement("span");
  status.textContent = `✓ ${actionName} complete`;
  status.style.fontWeight = "800";
  status.style.color = "#18713b";

  const link = document.createElement("a");
  link.href = documentUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View Signed Form";
  link.style.fontWeight = "850";
  link.style.color = "#1f67b1";
  link.style.textDecoration = "none";
  link.style.whiteSpace = "nowrap";

  row.append(status, link);
  return row;
}

export default function PortalEmailEnhancer() {
  useEffect(() => {
    const timers = new Map<Element, number>();

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

        const templateKey = businessLine === "rental" ? "pet_acknowledgment" : "minor_driver_authorization";
        const icon = businessLine === "rental" ? "🦮" : "🧍";
        const actionName = businessLine === "rental" ? "Pet Acknowledgment" : "Teen Driver Authorization";

        const formButton = document.createElement("button");
        formButton.type = "button";
        formButton.id = "guest-form-quick-add";
        styleIconButton(formButton);
        resendButton.insertAdjacentElement("afterend", formButton);

        const applyTaskState = async () => {
          if (!document.body.contains(drawer) || !document.body.contains(formButton)) return;
          const tasksResponse = await fetch(`/api/team/guest-forms/list?readinessId=${encodeURIComponent(activity.readinessId)}`, { cache: "no-store" });
          if (!tasksResponse.ok) return;
          const tasksData = (await tasksResponse.json()) as { tasks?: GuestFormTask[] };
          const existing = (tasksData.tasks ?? []).find((task) => task.templateKey === templateKey && task.task_status !== "cancelled");

          drawer.querySelector("#guest-form-signed-row")?.remove();
          formButton.onclick = null;
          formButton.disabled = false;
          formButton.style.opacity = "1";
          formButton.style.cursor = "pointer";
          formButton.style.background = "#fff";
          formButton.style.borderColor = "#c8d0d7";
          formButton.textContent = icon;

          if (existing?.task_status === "completed") {
            formButton.title = existing.pdfReady ? `View signed ${actionName}` : `${actionName} completed`;
            formButton.setAttribute("aria-label", existing.pdfReady ? `View signed ${actionName}` : `${actionName} completed`);
            formButton.style.background = "#f2fbf5";
            formButton.style.borderColor = "#a9d8b8";
            if (existing.pdfReady && existing.documentUrl) {
              formButton.onclick = () => window.open(existing.documentUrl!, "_blank", "noopener,noreferrer");
              const signedRow = makeSignedFormRow(actionName, existing.documentUrl);
              const cancellationCard = findCancellationCard(drawer);
              if (cancellationCard?.parentElement) cancellationCard.parentElement.insertBefore(signedRow, cancellationCard);
            } else {
              formButton.disabled = true;
              formButton.style.opacity = "0.72";
              formButton.style.cursor = "default";
            }
            return;
          }

          if (existing) {
            formButton.title = `${actionName} is in My Epic Reservation`;
            formButton.setAttribute("aria-label", `${actionName} already added to guest portal`);
            formButton.style.background = "#f7faf8";
            formButton.style.borderColor = "#cfe7d6";
            formButton.disabled = true;
            formButton.style.opacity = "0.78";
            formButton.style.cursor = "default";
            return;
          }

          formButton.title = `Add ${actionName} to My Epic Reservation`;
          formButton.setAttribute("aria-label", `Add ${actionName} to guest portal`);
          formButton.onclick = async () => {
            formButton.disabled = true;
            formButton.textContent = "…";
            formButton.style.opacity = "0.65";
            try {
              const response = await fetch("/api/team/guest-forms/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ readinessId: activity.readinessId, templateKey }),
              });
              const result = (await response.json()) as { error?: string };
              if (!response.ok) throw new Error(result.error || "Unable to add form to portal.");
              await applyTaskState();
            } catch (error) {
              window.alert(error instanceof Error ? error.message : "Unable to add form to portal.");
              formButton.disabled = false;
              formButton.textContent = icon;
              formButton.style.opacity = "1";
            }
          };
        };

        await applyTaskState();
        const timer = window.setInterval(() => void applyTaskState(), 8000);
        timers.set(drawer, timer);
      } catch (error) {
        console.error("Guest form quick action unavailable", error);
      }
    }

    void enhance();
    const observer = new MutationObserver(() => {
      for (const [drawer, timer] of timers) {
        if (!document.body.contains(drawer)) {
          window.clearInterval(timer);
          timers.delete(drawer);
        }
      }
      void enhance();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const timer of timers.values()) window.clearInterval(timer);
      timers.clear();
    };
  }, []);

  return null;
}
