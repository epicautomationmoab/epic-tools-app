"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

type PortalResponse = {
  reservation?: {
    activities?: Array<{
      businessLine?: string | null;
      beltTireProtection?: boolean | null;
    }>;
  };
};

function findProtectionSection() {
  for (const section of Array.from(document.querySelectorAll<HTMLElement>("section"))) {
    const eyebrow = Array.from(section.querySelectorAll<HTMLElement>("p")).find(
      (element) => element.textContent?.trim().toLowerCase() === "protection",
    );
    if (eyebrow) return section;
  }
  return null;
}

function protectionRow() {
  const row = document.createElement("div");
  row.dataset.beltTirePortal = "true";
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.flexWrap = "wrap";
  row.style.gap = "10px";
  row.style.marginTop = "18px";
  row.style.padding = "0 4px";
  row.style.color = "#17202a";

  const tire = document.createElement("span");
  tire.textContent = "🛞";
  tire.setAttribute("aria-hidden", "true");
  tire.style.fontSize = "24px";
  tire.style.lineHeight = "1";

  const label = document.createElement("span");
  label.textContent = "Tire & Belt Protection";
  label.style.fontSize = "16px";
  label.style.fontWeight = "800";

  const badge = document.createElement("span");
  badge.textContent = "✓  Added";
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.style.borderRadius = "999px";
  badge.style.background = "#e4f4e8";
  badge.style.color = "#34734a";
  badge.style.padding = "7px 11px";
  badge.style.fontSize = "10px";
  badge.style.fontWeight = "900";
  badge.style.letterSpacing = "0.08em";
  badge.style.textTransform = "uppercase";

  row.append(tire, label, badge);
  return row;
}

export default function ProtectionEnhancer() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function enhance() {
      try {
        const response = await fetch(`/api/guest/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as PortalResponse;
        const activities = data.reservation?.activities ?? [];
        const hasRentalActivity = activities.some(
          (activity) => activity.businessLine?.toLowerCase() === "rental",
        );
        const hasBeltTireProtection = activities.some(
          (activity) => activity.beltTireProtection === true,
        );

        if (cancelled || !hasRentalActivity) return;

        const applyEnhancement = () => {
          const section = findProtectionSection();
          if (!section) return false;

          const heading = Array.from(section.querySelectorAll<HTMLHeadingElement>("h2")).find(
            (element) => element.textContent?.trim() === "Adventure Assure",
          );
          heading?.remove();

          const existing = section.querySelector<HTMLElement>(
            "[data-belt-tire-portal='true']",
          );

          if (!hasBeltTireProtection) {
            existing?.remove();
            return true;
          }

          if (existing) return true;

          const logo = section.querySelector<HTMLImageElement>(
            "img[alt='Adventure Assure']",
          );
          const card = logo?.parentElement;
          if (!card) return false;

          card.insertAdjacentElement("afterend", protectionRow());
          return true;
        };

        if (applyEnhancement()) return;

        const observer = new MutationObserver(() => {
          if (applyEnhancement()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.setTimeout(() => observer.disconnect(), 10000);
      } catch {
        // The portal remains fully usable if this optional display enhancement fails.
      }
    }

    void enhance();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return null;
}
