"use client";

import { useEffect } from "react";

function styleQrRailButton(button: HTMLButtonElement) {
  button.textContent = "";
  button.title = "Portal QR Generator";
  button.setAttribute("aria-label", "Portal QR Generator");
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.position = "relative";
  button.style.margin = "0";
  button.style.width = "42px";
  button.style.height = "42px";
  button.style.minHeight = "42px";
  button.style.padding = "0";
  button.style.border = "1px solid #c8d0d7";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.color = "#202733";
  button.style.cursor = "pointer";
  button.style.flex = "0 0 42px";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("aria-hidden", "true");
  svg.style.display = "block";

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M3 3h7v7H3V3zm2 2v3h3V5H5zm9-2h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5zm9-2h2v2h-2v-2zm3 0h4v2h-4v-2zm-3 3h2v4h-2v-4zm3 0h2v2h-2v-2zm3 0h1v4h-4v-2h2v-2z",
  );
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  button.appendChild(svg);
}

export default function PortalQrRailEnhancer() {
  useEffect(() => {
    let scheduled = false;

    const enhance = () => {
      scheduled = false;

      for (const drawer of Array.from(document.querySelectorAll('[role="dialog"]'))) {
        if ((drawer as HTMLElement).dataset.portalQrModal === "true") continue;

        const button = drawer.querySelector<HTMLButtonElement>("#portal-qr-generator-button");
        const rail = drawer.querySelector<HTMLElement>("#reservation-action-rail");
        if (!button || !rail) continue;

        if (button.parentElement !== rail) {
          rail.appendChild(button);
        }

        if (button.dataset.qrRailStyled !== "true") {
          styleQrRailButton(button);
          button.dataset.qrRailStyled = "true";
        }
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

    return () => observer.disconnect();
  }, []);

  return null;
}
