"use client";

import { useEffect, useState } from "react";
import sourceStyles from "./WaiverSourceLinks.module.css";

type SignedWaiver = {
  id: string;
  signerName: string;
  signerEmail: string | null;
  signedAt: string;
  copyEmailStatus: string | null;
  copyEmailSentAt: string | null;
  isMinor?: boolean;
  businessLine?: string | null;
  responsibilityScope?: string | null;
  vehicleCoverageCount?: number | null;
  vehicleCountAtSigning?: number | null;
};

function portalTokenFromDrawer() {
  const link = document.querySelector<HTMLAnchorElement>('a[href^="/guest/"]');
  if (!link) return null;
  const match = link.getAttribute("href")?.match(/^\/guest\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function epicDocumentsSection() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>("section"));
  return (
    sections.find((section) => {
      const heading = section.querySelector("h3");
      return heading?.textContent?.trim().startsWith("Epic Documents");
    }) ?? null
  );
}

function normalizeName(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function styleSourceLinks(section: HTMLElement) {
  const links = Array.from(section.querySelectorAll<HTMLAnchorElement>("a"));

  for (const link of links) {
    const href = link.getAttribute("href") || "";
    link.classList.remove(
      sourceStyles.tripWorksWaiverLink,
      sourceStyles.epicWaiverLink,
    );

    if (href.startsWith("/api/team/waivers/")) {
      link.classList.add(sourceStyles.epicWaiverLink);
    } else if (
      href.includes("tripworks.com") ||
      href.includes("cdn-images.tripworks.com")
    ) {
      link.classList.add(sourceStyles.tripWorksWaiverLink);
    }
  }
}

function replaceNoLink(row: HTMLElement, href: string) {
  const existingEpicLink = row.querySelector<HTMLAnchorElement>(
    'a[data-epic-waiver-link="true"]',
  );
  if (existingEpicLink) {
    existingEpicLink.href = href;
    existingEpicLink.classList.add(sourceStyles.epicWaiverLink);
    return;
  }

  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim() === "No link") {
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open Waiver";
      link.dataset.epicWaiverLink = "true";
      link.classList.add(sourceStyles.epicWaiverLink);
      node.parentNode?.replaceChild(link, node);
      return;
    }
    node = walker.nextNode();
  }
}

function rentalBadgeLabel(waiver: SignedWaiver) {
  if (waiver.businessLine !== "rental" || waiver.isMinor) return null;
  if (waiver.responsibilityScope === "all_reservation_vehicles") {
    const count = Math.max(
      1,
      waiver.vehicleCountAtSigning ?? waiver.vehicleCoverageCount ?? 1,
    );
    return `All ${count} Vehicle${count === 1 ? "" : "s"}`;
  }
  if (waiver.responsibilityScope === "assigned_vehicle_only") return "1 Vehicle";
  return null;
}

function applyRentalBadge(row: HTMLElement, waiver: SignedWaiver) {
  const label = rentalBadgeLabel(waiver);
  const existing = row.querySelector<HTMLElement>(
    '[data-rental-responsibility-badge="true"]',
  );

  if (!label) {
    existing?.remove();
    return;
  }

  if (existing) {
    existing.textContent = label;
    return;
  }

  const badge = document.createElement("span");
  badge.textContent = label;
  badge.dataset.rentalResponsibilityBadge = "true";
  badge.classList.add(sourceStyles.rentalResponsibilityBadge);

  const role = row.querySelector("small");
  if (role) role.insertAdjacentElement("afterend", badge);
  else row.appendChild(badge);
}

export default function SignedWaiverDrawerEnhancer() {
  const [token, setToken] = useState<string | null>(null);
  const [waivers, setWaivers] = useState<SignedWaiver[]>([]);

  useEffect(() => {
    const syncToken = () => setToken(portalTokenFromDrawer());
    syncToken();

    const observer = new MutationObserver(syncToken);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!token) {
      setWaivers([]);
      return;
    }

    let cancelled = false;
    fetch(`/api/team/waivers?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          waivers?: SignedWaiver[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Unable to load signed waivers.");
        }
        return data.waivers ?? [];
      })
      .then((rows) => {
        if (!cancelled) setWaivers(rows);
      })
      .catch((error) => {
        console.error("Unable to load Epic signed waivers", error);
        if (!cancelled) setWaivers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const applyLinks = () => {
      const section = epicDocumentsSection();
      if (!section) return;

      for (const waiver of waivers) {
        const targetName = normalizeName(waiver.signerName);
        const rows = Array.from(section.querySelectorAll<HTMLElement>("div"));
        const row = rows.find((candidate) => {
          const strong = candidate.querySelector(":scope > strong");
          return normalizeName(strong?.textContent) === targetName;
        });

        if (!row) continue;
        replaceNoLink(row, `/api/team/waivers/${waiver.id}/pdf`);
        applyRentalBadge(row, waiver);
      }

      styleSourceLinks(section);
    };

    applyLinks();
    const observer = new MutationObserver(applyLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [token, waivers]);

  return null;
}
