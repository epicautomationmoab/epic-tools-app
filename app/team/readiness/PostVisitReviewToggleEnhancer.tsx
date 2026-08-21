"use client";

import { useEffect } from "react";

type PortalActivity = { readinessId: string; businessLine: string; productDisplayName: string };
type PortalPayload = { reservation?: { activities?: PortalActivity[] } };

type PreferencePayload = {
  sendMode?: "review_request" | "thank_you_only";
  error?: string;
};

function portalTokenFromLink(link: HTMLAnchorElement) {
  return link.getAttribute("href")?.match(/^\/guest\/([^/?#]+)/)?.[1] ?? null;
}

function findConfirmation(drawer: Element) {
  for (const card of Array.from(drawer.querySelectorAll<HTMLElement>("div"))) {
    if (card.querySelector(":scope > span")?.textContent?.trim() !== "Booking Confirmation") continue;
    const value = card.querySelector(":scope > strong")?.textContent?.trim();
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

function bestActivityMatch(activities: PortalActivity[], businessLine: string, drawer: Element) {
  const candidates = activities.filter((activity) => activity.businessLine?.toLowerCase() === businessLine);
  if (candidates.length <= 1) return candidates[0] ?? null;
  const drawerText = drawer.textContent?.toLowerCase() ?? "";
  return candidates.find((activity) => drawerText.includes(activity.productDisplayName.toLowerCase())) ?? candidates[0] ?? null;
}

function styleButton(button: HTMLButtonElement) {
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.position = "relative";
  button.style.marginLeft = "0";
  button.style.width = "42px";
  button.style.height = "42px";
  button.style.padding = "0";
  button.style.border = "1px solid #c8d0d7";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.color = "#26313b";
  button.style.lineHeight = "1";
  button.style.cursor = "pointer";
  button.style.flex = "0 0 42px";
}

function renderNoReviewIcon(button: HTMLButtonElement) {
  button.replaceChildren();

  const star = document.createElement("span");
  star.textContent = "★";
  star.setAttribute("aria-hidden", "true");
  star.style.fontSize = "22px";
  star.style.lineHeight = "1";

  const ban = document.createElement("span");
  ban.textContent = "🚫";
  ban.setAttribute("aria-hidden", "true");
  ban.style.position = "absolute";
  ban.style.right = "2px";
  ban.style.bottom = "2px";
  ban.style.fontSize = "15px";
  ban.style.lineHeight = "1";
  ban.style.pointerEvents = "none";

  button.append(star, ban);
}

function applyMode(button: HTMLButtonElement, mode: "review_request" | "thank_you_only") {
  const suppressed = mode === "thank_you_only";
  button.dataset.sendMode = mode;
  renderNoReviewIcon(button);
  button.style.background = suppressed ? "#b42318" : "#fff";
  button.style.borderColor = suppressed ? "#b42318" : "#c8d0d7";
  button.style.color = suppressed ? "#fff" : "#26313b";
  button.title = suppressed
    ? "Thank You Only — review request suppressed. Click to restore review ask."
    : "Send Thank You + Review Request. Click to suppress the review ask.";
  button.setAttribute("aria-label", button.title);
}

export default function PostVisitReviewToggleEnhancer() {
  useEffect(() => {
    let scheduled = false;
    let stopped = false;

    async function enhanceDrawer(drawer: Element) {
      const existingButtons = Array.from(drawer.querySelectorAll<HTMLButtonElement>("#post-visit-review-toggle"));
      if (existingButtons.length) {
        for (const duplicate of existingButtons.slice(1)) duplicate.remove();
        return;
      }
      if ((drawer as HTMLElement).dataset.postVisitToggleEnhancing === "true") return;

      const portalLink = drawer.querySelector<HTMLAnchorElement>('a[href^="/guest/"]');
      if (!portalLink) return;
      const portalToken = portalTokenFromLink(portalLink);
      const confirmationCode = findConfirmation(drawer);
      const businessLine = findBusinessLine(drawer);
      if (!portalToken || !confirmationCode || !businessLine) return;

      const rail = drawer.querySelector<HTMLElement>("#reservation-action-rail");
      if (!rail) return;

      (drawer as HTMLElement).dataset.postVisitToggleEnhancing = "true";
      try {
        const portalResponse = await fetch(`/api/guest/${encodeURIComponent(portalToken)}`, { cache: "no-store" });
        if (!portalResponse.ok || stopped || !document.body.contains(drawer)) return;
        const portal = (await portalResponse.json()) as PortalPayload;
        const activity = bestActivityMatch(portal.reservation?.activities ?? [], businessLine, drawer);
        if (!activity) return;

        if (drawer.querySelector("#post-visit-review-toggle")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.id = "post-visit-review-toggle";
        styleButton(button);
        applyMode(button, "review_request");
        rail.appendChild(button);

        try {
          const response = await fetch(`/api/team/post-visit-email/preference?readinessId=${encodeURIComponent(activity.readinessId)}`, { cache: "no-store" });
          const data = (await response.json()) as PreferencePayload;
          if (response.ok && data.sendMode) applyMode(button, data.sendMode);
        } catch {
          // Default remains review_request if the preference cannot be read.
        }

        button.addEventListener("click", async () => {
          const current = button.dataset.sendMode === "thank_you_only" ? "thank_you_only" : "review_request";
          const next = current === "thank_you_only" ? "review_request" : "thank_you_only";
          button.disabled = true;
          button.style.opacity = "0.6";
          try {
            const response = await fetch("/api/team/post-visit-email/preference", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ readinessId: activity.readinessId, confirmationCode, sendMode: next }),
            });
            const data = (await response.json()) as PreferencePayload;
            if (!response.ok) throw new Error(data.error || "Unable to update post-visit email preference.");
            applyMode(button, next);
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "Unable to update post-visit email preference.");
          } finally {
            button.disabled = false;
            button.style.opacity = "1";
          }
        });
      } finally {
        delete (drawer as HTMLElement).dataset.postVisitToggleEnhancing;
      }
    }

    const enhance = () => {
      scheduled = false;
      for (const drawer of Array.from(document.querySelectorAll('[role="dialog"]'))) {
        void enhanceDrawer(drawer);
      }
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
