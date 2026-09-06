"use client";

import { useEffect } from "react";

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
  button.style.position = "relative";
  button.style.marginLeft = "0";
  button.style.width = "42px";
  button.style.height = "42px";
  button.style.padding = "0";
  button.style.border = "1px solid #c8d0d7";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.lineHeight = "1";
  button.style.cursor = "pointer";
  button.style.flex = "0 0 42px";
  button.style.fontSize = "20px";
  button.style.fontWeight = "900";
}

function applyState(button: HTMLButtonElement, hidden: boolean) {
  button.dataset.hidden = hidden ? "true" : "false";
  button.textContent = "$";
  button.style.background = hidden ? "#b42318" : "#fff";
  button.style.color = hidden ? "#fff" : "#17202a";
  button.style.borderColor = hidden ? "#b42318" : "#c8d0d7";
  button.title = hidden
    ? "Balance hidden in Guest Portal. Click to show it."
    : "Balance visible in Guest Portal. Click to hide it.";
  button.setAttribute("aria-label", button.title);
}

type VisibilityPayload = { hidden?: boolean; error?: string };

export default function GuestPaymentVisibilityEnhancer() {
  useEffect(() => {
    let scheduled = false;
    let stopped = false;

    async function enhanceDrawer(drawer: Element) {
      if (drawer.querySelector("#guest-payment-visibility-toggle")) return;
      if ((drawer as HTMLElement).dataset.paymentVisibilityEnhancing === "true") return;

      const confirmationCode = findConfirmation(drawer);
      const rail = drawer.querySelector<HTMLElement>("#reservation-action-rail");
      if (!confirmationCode || !rail) return;

      (drawer as HTMLElement).dataset.paymentVisibilityEnhancing = "true";
      try {
        const response = await fetch(
          `/api/team/guest-payment-visibility?confirmationCode=${encodeURIComponent(confirmationCode)}`,
          { cache: "no-store" },
        );
        if (!response.ok || stopped || !document.body.contains(drawer)) return;

        const data = (await response.json()) as VisibilityPayload;
        const button = document.createElement("button");
        button.type = "button";
        button.id = "guest-payment-visibility-toggle";
        styleButton(button);
        applyState(button, data.hidden === true);
        rail.appendChild(button);

        button.addEventListener("click", async () => {
          const currentHidden = button.dataset.hidden === "true";
          const nextHidden = !currentHidden;
          button.disabled = true;
          button.style.opacity = "0.6";

          try {
            const update = await fetch("/api/team/guest-payment-visibility", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confirmationCode, hidden: nextHidden }),
            });
            const updated = (await update.json()) as VisibilityPayload;
            if (!update.ok) throw new Error(updated.error || "Unable to update payment visibility.");
            applyState(button, updated.hidden === true);
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "Unable to update payment visibility.");
          } finally {
            button.disabled = false;
            button.style.opacity = "1";
          }
        });
      } finally {
        delete (drawer as HTMLElement).dataset.paymentVisibilityEnhancing;
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
