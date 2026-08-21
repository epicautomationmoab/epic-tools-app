"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ReadinessRow } from "@/lib/supabase";

type NoShowRow = ReadinessRow & {
  no_show_marked_at?: string | null;
  no_show_marked_by?: string | null;
};

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function formatDate(value: string) {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(`${match[2]}/${match[3]}/${match[1]}`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function confirmationFromRow(row: HTMLTableRowElement) {
  for (const anchor of Array.from(row.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const match = anchor.href.match(/\/trip\/([^/]+)\/bookings/i);
    if (match?.[1]) return decodeURIComponent(match[1]).toUpperCase();
  }
  return null;
}

function resolveReadinessRow(tableRow: HTMLTableRowElement, rows: NoShowRow[]) {
  const confirmation = confirmationFromRow(tableRow);
  if (!confirmation) return null;

  const candidates = rows.filter(
    (row) =>
      row.readiness_id &&
      row.confirmation_code?.trim().toUpperCase() === confirmation,
  );

  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) return null;

  const visitText = tableRow.cells[0]?.textContent ?? "";
  const guestText = tableRow.cells[1]?.textContent ?? "";
  const activityText = tableRow.cells[2]?.textContent ?? "";

  return (
    candidates.find(
      (row) =>
        visitText.includes(formatDate(row.visit_start_time)) &&
        visitText.includes(formatWallTime(row.visit_start_time)) &&
        guestText.includes(row.customer_name) &&
        activityText.includes(row.product_display_name ?? ""),
    ) ?? null
  );
}

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing.");
  return { url, key };
}

async function setNoShow(readinessId: string, isNoShow: boolean) {
  const { url, key } = getSupabaseBrowserConfig();
  const functionName = isNoShow
    ? "set_readiness_no_show"
    : "clear_readiness_no_show";
  const body = isNoShow
    ? { p_readiness_id: readinessId, p_marked_by: "EpicTools" }
    : { p_readiness_id: readinessId };

  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Unable to update no-show status.");
  }
}

function styleBadge(badge: HTMLElement) {
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.style.padding = "2px 7px";
  badge.style.borderRadius = "999px";
  badge.style.background = "#f9ded9";
  badge.style.color = "#9e2f23";
  badge.style.border = "1px solid #efb9b0";
  badge.style.fontSize = "10px";
  badge.style.fontWeight = "900";
  badge.style.letterSpacing = ".04em";
  badge.style.lineHeight = "1.4";
  badge.style.whiteSpace = "nowrap";
}

export default function NoShowEnhancer({ rows }: { rows: NoShowRow[] }) {
  const router = useRouter();
  const liveRows = useRef(rows);
  const selectedReadinessId = useRef<string | null>(null);
  const noShowIds = useRef(
    new Set(
      rows
        .filter((row) => row.readiness_id && row.no_show_marked_at)
        .map((row) => row.readiness_id as string),
    ),
  );

  useEffect(() => {
    liveRows.current = rows;
    noShowIds.current = new Set(
      rows
        .filter((row) => row.readiness_id && row.no_show_marked_at)
        .map((row) => row.readiness_id as string),
    );
  }, [rows]);

  useEffect(() => {
    function enhanceRows() {
      for (const tableRow of Array.from(
        document.querySelectorAll<HTMLTableRowElement>("table tbody tr"),
      )) {
        const row = resolveReadinessRow(tableRow, liveRows.current);
        if (!row?.readiness_id) continue;

        const guestCell = tableRow.cells[1];
        if (!guestCell) continue;

        let badgeWrap = guestCell.querySelector<HTMLElement>("[data-no-show-badge-wrap='true']");
        const shouldShow = noShowIds.current.has(row.readiness_id);

        if (shouldShow && !badgeWrap) {
          badgeWrap = document.createElement("div");
          badgeWrap.dataset.noShowBadgeWrap = "true";
          badgeWrap.style.marginTop = "3px";
          badgeWrap.style.lineHeight = "1";

          const badge = document.createElement("span");
          badge.dataset.noShowBadge = "true";
          badge.textContent = "NO SHOW";
          badge.title = "Guest marked as a no-show";
          styleBadge(badge);
          badgeWrap.appendChild(badge);
          guestCell.appendChild(badgeWrap);
        } else if (!shouldShow && badgeWrap) {
          badgeWrap.remove();
        }
      }
    }

    function enhanceDrawer() {
      const drawer = document.querySelector<HTMLElement>("[role='dialog']");
      if (!drawer || !selectedReadinessId.current) return;

      const readinessId = selectedReadinessId.current;
      const row = liveRows.current.find((item) => item.readiness_id === readinessId);
      if (!row) return;

      let section = drawer.querySelector<HTMLElement>("[data-no-show-control='true']");
      if (!section) {
        section = document.createElement("section");
        section.dataset.noShowControl = "true";
        section.style.margin = "0 0 16px";
        section.style.padding = "14px 18px";
        section.style.border = "1px solid #e3e6ea";
        section.style.borderRadius = "12px";
        section.style.background = "#fff";

        const manualMpwr = drawer.querySelector<HTMLElement>("details");
        const manualMpwrSection = manualMpwr?.closest("section");
        if (manualMpwrSection) {
          manualMpwrSection.insertAdjacentElement("afterend", section);
        } else {
          drawer.appendChild(section);
        }
      }

      const isNoShow = noShowIds.current.has(readinessId);
      const desiredState = isNoShow ? "no-show" : "not-no-show";
      if (section.dataset.noShowState === desiredState && section.childElementCount > 0) {
        return;
      }
      section.dataset.noShowState = desiredState;
      section.replaceChildren();

      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.justifyContent = "space-between";
      wrap.style.gap = "14px";

      const textWrap = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = "No-show status";
      title.style.display = "block";
      title.style.fontSize = "14px";

      const detail = document.createElement("span");
      detail.textContent = isNoShow
        ? "This guest is marked NO SHOW."
        : "Guest has not been marked as a no-show.";
      detail.style.display = "block";
      detail.style.marginTop = "3px";
      detail.style.fontSize = "12px";
      detail.style.color = "#6f7885";
      textWrap.append(title, detail);

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = isNoShow ? "Clear No Show" : "Mark No Show";
      button.style.border = isNoShow ? "1px solid #d46a5d" : "1px solid #b83f32";
      button.style.borderRadius = "9px";
      button.style.background = isNoShow ? "#fff" : "#b83f32";
      button.style.color = isNoShow ? "#9e2f23" : "#fff";
      button.style.fontWeight = "800";
      button.style.padding = "9px 13px";
      button.style.cursor = "pointer";
      button.style.whiteSpace = "nowrap";

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        button.textContent = "Saving...";

        try {
          await setNoShow(readinessId, !isNoShow);
          if (isNoShow) noShowIds.current.delete(readinessId);
          else noShowIds.current.add(readinessId);
          section!.dataset.noShowState = "";
          enhanceRows();
          enhanceDrawer();
          router.refresh();
        } catch (error) {
          button.disabled = false;
          button.textContent = isNoShow ? "Clear No Show" : "Mark No Show";
          detail.textContent =
            error instanceof Error ? error.message : "Unable to update no-show status.";
          detail.style.color = "#b42318";
        }
      });

      wrap.append(textWrap, button);
      section.appendChild(wrap);
    }

    function enhance() {
      enhanceRows();
      enhanceDrawer();
    }

    function trackSelectedRow(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const tableRow = target?.closest("table tbody tr") as HTMLTableRowElement | null;
      if (!tableRow) return;
      const row = resolveReadinessRow(tableRow, liveRows.current);
      selectedReadinessId.current = row?.readiness_id ?? null;
      setTimeout(enhanceDrawer, 0);
    }

    document.addEventListener("click", trackSelectedRow, true);
    enhance();

    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", trackSelectedRow, true);
      observer.disconnect();
    };
  }, [router]);

  return null;
}
