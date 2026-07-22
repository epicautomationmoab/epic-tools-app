"use client";

import { useEffect } from "react";

function findGuestEmail(drawer: Element) {
  const values = Array.from(drawer.querySelectorAll("strong"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);
  return values.find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) ?? "";
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
      const firstName = guestName.split(/\s+/).filter(Boolean)[0] ?? "there";
      const email = findGuestEmail(drawer);
      const portalUrl = new URL(portalLink.getAttribute("href") ?? "", window.location.origin).toString();

      const subject = "Your Epic 4X4 Adventures Guest Portal";
      const body = [
        `Hi ${firstName},`,
        "",
        "Your Epic 4X4 Adventures guest portal is ready. Use the link below to review your reservation and complete any outstanding items before arrival:",
        "",
        portalUrl,
        "",
        "We look forward to your adventure!",
        "",
        "Epic 4X4 Adventures",
      ].join("\n");

      const emailLink = document.createElement("a");
      emailLink.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      emailLink.textContent = "Email Guest Portal";
      emailLink.setAttribute("aria-label", `Email guest portal to ${guestName}`);
      emailLink.style.display = "inline-flex";
      emailLink.style.alignItems = "center";
      emailLink.style.justifyContent = "center";
      emailLink.style.marginLeft = "10px";
      emailLink.style.padding = "10px 14px";
      emailLink.style.border = "1px solid #c8d0d7";
      emailLink.style.borderRadius = "8px";
      emailLink.style.background = "#fff";
      emailLink.style.color = "#26313b";
      emailLink.style.fontWeight = "850";
      emailLink.style.textDecoration = "none";
      emailLink.style.cursor = "pointer";

      portalLink.dataset.emailEnhanced = "true";
      portalLink.insertAdjacentElement("afterend", emailLink);
    }

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
