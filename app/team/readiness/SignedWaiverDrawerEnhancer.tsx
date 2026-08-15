"use client";

import { useEffect, useState } from "react";

type SignedWaiver = {
  id: string;
  signerName: string;
  signerEmail: string | null;
  signedAt: string;
  copyEmailStatus: string | null;
  copyEmailSentAt: string | null;
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
    document.getElementById("epic-owned-waivers")?.remove();

    if (!token || !waivers.length) return;

    const section = epicDocumentsSection();
    if (!section) return;

    const block = document.createElement("div");
    block.id = "epic-owned-waivers";
    block.style.marginTop = "14px";
    block.style.paddingTop = "14px";
    block.style.borderTop = "1px solid #e3e7eb";

    const label = document.createElement("div");
    label.textContent = "EPIC SIGNED WAIVERS";
    label.style.fontSize = "11px";
    label.style.fontWeight = "900";
    label.style.letterSpacing = ".08em";
    label.style.color = "#6b7280";
    label.style.marginBottom = "9px";
    block.appendChild(label);

    for (const waiver of waivers) {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "12px";
      row.style.padding = "10px 0";

      const identity = document.createElement("div");
      identity.style.minWidth = "0";

      const name = document.createElement("strong");
      name.textContent = waiver.signerName;
      name.style.display = "block";
      name.style.color = "#202733";

      const detail = document.createElement("small");
      const signedAt = new Date(waiver.signedAt).toLocaleString("en-US");
      detail.textContent = `Epic waiver · Signed ${signedAt}${waiver.copyEmailStatus === "sent" ? " · Copy emailed" : ""}`;
      detail.style.display = "block";
      detail.style.marginTop = "3px";
      detail.style.color = "#6b7280";

      identity.append(name, detail);

      const link = document.createElement("a");
      link.href = `/api/team/waivers/${waiver.id}/pdf`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View Signed Waiver";
      link.style.flex = "0 0 auto";
      link.style.textDecoration = "none";
      link.style.background = "#202733";
      link.style.color = "#fff";
      link.style.borderRadius = "8px";
      link.style.padding = "8px 11px";
      link.style.fontSize = "12px";
      link.style.fontWeight = "900";

      row.append(identity, link);
      block.appendChild(row);
    }

    section.appendChild(block);
    return () => block.remove();
  }, [token, waivers]);

  return null;
}
