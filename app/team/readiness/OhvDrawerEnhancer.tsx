"use client";

import { useEffect, useState } from "react";
import styles from "./OhvDrawerEnhancer.module.css";

type Upload = {
  id: string;
  readinessId: string;
  driverName: string;
  filename: string;
  uploadedAt: string;
  viewUrl: string | null;
};

function portalTokenFromDrawer() {
  const link = document.querySelector<HTMLAnchorElement>('a[href^="/guest/"]');
  if (!link) return null;
  const match = link.getAttribute("href")?.match(/^\/guest\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function detailedMpwrWaiverSection() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>("section"));

  return (
    sections.find((section) => {
      const heading = section.querySelector("h3");
      return heading?.childNodes[0]?.textContent?.trim() === "MPWR Waivers";
    }) ?? null
  );
}

function rentalDrawerIsOpen() {
  const factCards = Array.from(document.querySelectorAll<HTMLElement>("div"));

  return factCards.some((card) => {
    const label = card.querySelector(":scope > span");
    const value = card.querySelector(":scope > strong");

    return (
      label?.textContent?.trim() === "Adventure Assure" &&
      value?.textContent?.trim() !== "Tour"
    );
  });
}

export default function OhvDrawerEnhancer() {
  const [token, setToken] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncToken = () => setToken(portalTokenFromDrawer());
    syncToken();

    const observer = new MutationObserver(syncToken);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!token) {
      setUploads([]);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/team/ohv?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { uploads?: Upload[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load certificates.");
        return data.uploads ?? [];
      })
      .then((rows) => {
        if (!cancelled) setUploads(rows);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load certificates.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const existing = document.getElementById("ohv-drawer-certificates");
    if (existing) existing.remove();

    if (
      !token ||
      !rentalDrawerIsOpen() ||
      loading ||
      error ||
      uploads.length === 0
    ) {
      return;
    }

    const mpwrSection = detailedMpwrWaiverSection();
    if (!mpwrSection?.parentElement) return;

    const section = document.createElement("section");
    section.id = "ohv-drawer-certificates";
    section.className = styles.section;

    const heading = document.createElement("div");
    heading.className = styles.heading;
    heading.innerHTML = `<div><span>Utah Requirement</span><h3>OHV Certificates</h3></div><strong>${uploads.length} uploaded</strong>`;
    section.appendChild(heading);

    const list = document.createElement("div");
    list.className = styles.list;

    for (const upload of uploads) {
      const row = document.createElement("div");
      row.className = styles.row;

      const identity = document.createElement("div");
      identity.className = styles.identity;
      const check = document.createElement("span");
      check.className = styles.check;
      check.textContent = "✓";
      const text = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = upload.driverName;
      const filename = document.createElement("small");
      filename.textContent = upload.filename;
      text.append(name, filename);
      identity.append(check, text);
      row.appendChild(identity);

      if (upload.viewUrl) {
        const link = document.createElement("a");
        link.className = styles.viewButton;
        link.href = upload.viewUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "View Certificate";
        row.appendChild(link);
      }

      list.appendChild(row);
    }

    section.appendChild(list);
    mpwrSection.insertAdjacentElement("afterend", section);

    return () => section.remove();
  }, [token, uploads, loading, error]);

  return null;
}
