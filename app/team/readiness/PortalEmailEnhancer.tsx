"use client";

import { useEffect } from "react";

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

export default function PortalEmailEnhancer() {
  useEffect(() => {
    function enhance() {
      const portalLink = document.querySelector<HTMLAnchorElement>(
        'a[href^="/guest/"]',
      );
      if (!portalLink || portalLink.dataset.emailEnhanced === "true") return;

      const drawer = portalLink.closest('[role="dialog"]');
      if (!drawer) return;

      const guestName = drawer.querySelector("h2")?.textContent?.trim() ?? "Guest";
      const confirmationCode = findBookingConfirmation(drawer);
      if (!confirmationCode) return;

      const resendButton = document.createElement("button");
      resendButton.type = "button";
      resendButton.textContent = "Resend Confirmation Email";
      resendButton.setAttribute(
        "aria-label",
        `Resend confirmation email to ${guestName}`,
      );
      resendButton.style.display = "inline-flex";
      resendButton.style.alignItems = "center";
      resendButton.style.justifyContent = "center";
      resendButton.style.marginLeft = "10px";
      resendButton.style.padding = "10px 14px";
      resendButton.style.border = "1px solid #c8d0d7";
      resendButton.style.borderRadius = "8px";
      resendButton.style.background = "#fff";
      resendButton.style.color = "#26313b";
      resendButton.style.fontWeight = "850";
      resendButton.style.cursor = "pointer";

      resendButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Resend the full confirmation email to ${guestName}?`,
        );
        if (!confirmed) return;

        const originalText = resendButton.textContent;
        resendButton.disabled = true;
        resendButton.textContent = "Sending...";
        resendButton.style.opacity = "0.65";

        try {
          const response = await fetch(
            "/api/guest-communications/resend-confirmation",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confirmationCode }),
            },
          );
          const result = (await response.json()) as {
            ok?: boolean;
            error?: string;
          };

          if (!response.ok || result.ok !== true) {
            throw new Error(result.error || "Unable to resend confirmation email.");
          }

          resendButton.textContent = "Confirmation Sent";
          resendButton.style.opacity = "1";
          window.setTimeout(() => {
            resendButton.textContent = originalText;
            resendButton.disabled = false;
          }, 2500);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to resend confirmation email.";
          window.alert(message);
          resendButton.textContent = originalText;
          resendButton.disabled = false;
          resendButton.style.opacity = "1";
        }
      });

      portalLink.dataset.emailEnhanced = "true";
      portalLink.insertAdjacentElement("afterend", resendButton);
    }

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
