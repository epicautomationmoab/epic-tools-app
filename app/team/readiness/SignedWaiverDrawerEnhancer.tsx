"use client";

import { useEffect } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import sourceStyles from "./WaiverSourceLinks.module.css";

function normalizeName(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function epicDocumentsSection() {
  return Array.from(document.querySelectorAll<HTMLElement>("section")).find((section) =>
    section.querySelector("h3")?.textContent?.trim().startsWith("Epic Documents"),
  ) ?? null;
}

function styleSourceLinks(section: HTMLElement) {
  for (const link of Array.from(section.querySelectorAll<HTMLAnchorElement>("a"))) {
    const href = link.getAttribute("href") || "";
    link.classList.remove(sourceStyles.tripWorksWaiverLink, sourceStyles.epicWaiverLink);
    if (href.startsWith("/api/team/waivers/")) link.classList.add(sourceStyles.epicWaiverLink);
    else if (href.includes("tripworks.com") || href.includes("cdn-images.tripworks.com")) {
      link.classList.add(sourceStyles.tripWorksWaiverLink);
    }
  }
}

export default function SignedWaiverDrawerEnhancer({ rows }: { rows: ReadinessRow[] }) {
  useEffect(() => {
    const failedNames = new Set(
      rows
        .flatMap((row) => row.epic_document_delivery_failures ?? [])
        .map((failure) => normalizeName(failure.name))
        .filter(Boolean),
    );

    const apply = () => {
      const section = epicDocumentsSection();
      if (!section) return;

      for (const strong of Array.from(section.querySelectorAll<HTMLElement>("strong"))) {
        const name = normalizeName(strong.textContent);
        if (!name) continue;
        const failed = failedNames.has(name);
        strong.classList.add(sourceStyles.epicDocumentDeliveryWarningTarget);
        strong.dataset.epicCopyEmailFailed = failed ? "true" : "false";
        strong.title = failed ? "Signed Epic document email was not delivered" : "";
      }

      styleSourceLinks(section);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [rows]);

  return null;
}
