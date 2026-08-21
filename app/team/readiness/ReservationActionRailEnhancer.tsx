"use client";

import { useEffect } from "react";

const ICON_SELECTORS = ["#guest-form-quick-add", "#damage-acknowledgment-quick-add"];

function ensureRail(drawer: Element) {
  const portalLink = drawer.querySelector<HTMLAnchorElement>('a[href^="/guest/"]');
  if (!portalLink) return;

  const resendButton = Array.from(drawer.querySelectorAll<HTMLButtonElement>("button"))
    .find((button) => button.textContent?.trim() === "Resend Confirmation Email" || button.textContent?.trim() === "Confirmation Sent" || button.textContent?.trim() === "Sending...");
  if (!resendButton) return;

  const actionContainer = portalLink.parentElement;
  if (!actionContainer || resendButton.parentElement !== actionContainer) return;

  let divider = actionContainer.querySelector<HTMLElement>(":scope > #reservation-action-divider");
  let rail = actionContainer.querySelector<HTMLElement>(":scope > #reservation-action-rail");

  if (!divider) {
    divider = document.createElement("div");
    divider.id = "reservation-action-divider";
    divider.setAttribute("aria-hidden", "true");
    divider.style.flex = "0 0 100%";
    divider.style.width = "100%";
    divider.style.height = "1px";
    divider.style.background = "#e1e6eb";
    divider.style.margin = "8px 0 0";
    actionContainer.appendChild(divider);
  }

  if (!rail) {
    rail = document.createElement("div");
    rail.id = "reservation-action-rail";
    rail.setAttribute("aria-label", "Reservation actions");
    rail.style.flex = "0 0 100%";
    rail.style.width = "100%";
    rail.style.display = "flex";
    rail.style.alignItems = "center";
    rail.style.flexWrap = "wrap";
    rail.style.gap = "8px";
    rail.style.paddingTop = "8px";
    rail.style.minHeight = "42px";
    actionContainer.appendChild(rail);
  }

  for (const selector of ICON_SELECTORS) {
    const icon = drawer.querySelector<HTMLElement>(selector);
    if (!icon || icon.parentElement === rail) continue;
    rail.appendChild(icon);
    icon.style.marginLeft = "0";
  }

  for (const child of Array.from(rail.children) as HTMLElement[]) {
    child.style.marginLeft = "0";
  }
}

export default function ReservationActionRailEnhancer() {
  useEffect(() => {
    const enhance = () => {
      for (const drawer of Array.from(document.querySelectorAll('[role="dialog"]'))) {
        ensureRail(drawer);
      }
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
