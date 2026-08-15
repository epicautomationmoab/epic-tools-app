"use client";

import { useEffect, useState } from "react";

type SignedWaiver = {
  id: string;
  signerName: string;
  signerEmail: string | null;
  signedAt: string;
  copyEmailStatus: string | null;
  copyEmailSentAt: string | null;
  isMinor?: boolean;
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

function replaceNoLink(row: HTMLElement, href: string) {
  const existingEpicLink = row.querySelector<HTMLAnchorElement>(
    'a[data-epic-waiver-link="true"]',
  );
  if (existingEpicLink) {
    existingEpicLink.href = href;
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
      node.parentNode?.replaceChild(link, node);
      return;
    }
    node = walker.nextNode();
  }
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
    if (!token || !waivers.length) return;

    const applyLinks = () => {
      const section = epicDocumentsSection();
      if (!section) return;

      const rows = Array.from(section.querySelectorAll<HTMLElement>("div"));
      for (const waiver of waivers) {
        const targetName = normalizeName(waiver.signerName);
        const row = rows.find((candidate) => {
          const strong = candidate.querySelector(":scope > strong");
          return normalizeName(strong?.textContent) === targetName;
        });

        if (!row) continue;
        replaceNoLink(row, `/api/team/waivers/${waiver.id}/pdf`);
      }
    };

    applyLinks();
    const observer = new MutationObserver(applyLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [token, waivers]);

  return null;
}
