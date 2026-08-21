"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReadinessRow } from "@/lib/supabase";

type Level = "Standard" | "Premier";

type MenuState = {
  readinessId: string;
  currentLevel: Level;
  customerName: string;
  left: number;
  top: number;
  width: number;
} | null;

type ReadinessRowWithBeltTire = ReadinessRow & {
  belt_tire_protection?: boolean | null;
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

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase configuration is missing.");
  }

  return { url, key };
}

async function saveAdventureAssure(readinessId: string, level: Level) {
  const { url, key } = getSupabaseBrowserConfig();
  const response = await fetch(
    `${url}/rest/v1/rpc/set_readiness_adventure_assure_override`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_readiness_id: readinessId,
        p_level: level,
        p_reason: "Updated from Guest Readiness dashboard",
        p_updated_by: "EpicTools",
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Unable to update Adventure Assure.");
  }
}

function confirmationFromRow(row: HTMLTableRowElement) {
  for (const anchor of Array.from(row.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const match = anchor.href.match(/\/trip\/([^/]+)\/bookings/i);
    if (match?.[1]) return decodeURIComponent(match[1]).toUpperCase();
  }
  return null;
}

function resolveReadinessRow(
  tableRow: HTMLTableRowElement,
  rows: ReadinessRow[],
): ReadinessRow | null {
  const confirmation = confirmationFromRow(tableRow);
  if (!confirmation) return null;

  const candidates = rows.filter(
    (row) =>
      row.business_line === "rental" &&
      row.readiness_id &&
      row.confirmation_code?.trim().toUpperCase() === confirmation,
  );

  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) return null;

  const cells = tableRow.cells;
  const visitText = cells[0]?.textContent ?? "";
  const guestText = cells[1]?.textContent ?? "";
  const activityText = cells[2]?.textContent ?? "";

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

export default function AdventureAssureEnhancer({ rows }: { rows: ReadinessRow[] }) {
  const router = useRouter();
  const [menu, setMenu] = useState<MenuState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const liveRows = useMemo(() => rows, [rows]);

  useEffect(() => {
    function enhanceBeltTireColumn() {
      for (const table of Array.from(document.querySelectorAll<HTMLTableElement>("table"))) {
        const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
        const assureIndex = headers.findIndex(
          (header) => header.textContent?.trim() === "Adventure Assure",
        );

        if (assureIndex < 0) continue;

        const assureHeader = headers[assureIndex];
        let tireHeader = table.querySelector<HTMLTableCellElement>(
          "thead th[data-belt-tire-column='true']",
        );

        if (!tireHeader) {
          tireHeader = document.createElement("th");
          tireHeader.dataset.beltTireColumn = "true";
          tireHeader.setAttribute("aria-label", "Tire and Belt Damage Protection");
          tireHeader.style.width = "34px";
          tireHeader.style.minWidth = "34px";
          tireHeader.style.paddingLeft = "2px";
          tireHeader.style.paddingRight = "2px";
          assureHeader.insertAdjacentElement("afterend", tireHeader);
        }

        for (const tableRow of Array.from(
          table.querySelectorAll<HTMLTableRowElement>("tbody tr"),
        )) {
          let tireCell = tableRow.querySelector<HTMLTableCellElement>(
            "td[data-belt-tire-column='true']",
          );

          if (!tireCell) {
            const assureCell = tableRow.cells[assureIndex];
            if (!assureCell) continue;

            tireCell = document.createElement("td");
            tireCell.dataset.beltTireColumn = "true";
            tireCell.style.width = "34px";
            tireCell.style.minWidth = "34px";
            tireCell.style.paddingLeft = "2px";
            tireCell.style.paddingRight = "2px";
            tireCell.style.textAlign = "center";
            tireCell.style.fontSize = "20px";
            tireCell.style.lineHeight = "1";
            tireCell.style.whiteSpace = "nowrap";
            assureCell.insertAdjacentElement("afterend", tireCell);
          }

          const readinessRow = resolveReadinessRow(tableRow, liveRows) as
            | ReadinessRowWithBeltTire
            | null;
          const desiredText = readinessRow?.belt_tire_protection === true ? "🛞" : "";

          if (tireCell.textContent !== desiredText) {
            tireCell.textContent = desiredText;
          }

          if (desiredText) {
            tireCell.title = "Tire and Belt Damage Protection";
            tireCell.setAttribute("aria-label", "Tire and Belt Damage Protection purchased");
          } else {
            tireCell.removeAttribute("title");
            tireCell.removeAttribute("aria-label");
          }
        }
      }
    }

    enhanceBeltTireColumn();

    const observer = new MutationObserver(enhanceBeltTireColumn);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [liveRows]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest("[data-aa-menu='true']")) return;

      const tableRow = target.closest("tbody tr") as HTMLTableRowElement | null;
      const cell = target.closest("td") as HTMLTableCellElement | null;
      const table = target.closest("table");

      if (!tableRow || !cell || !table) {
        setMenu(null);
        return;
      }

      const headers = Array.from(table.querySelectorAll("thead th"));
      const assureIndex = headers.findIndex(
        (header) => header.textContent?.trim() === "Adventure Assure",
      );

      if (assureIndex < 0 || cell.cellIndex !== assureIndex) {
        setMenu(null);
        return;
      }

      const badge = cell.querySelector("span");
      const currentText = badge?.textContent?.trim();
      if (currentText !== "Standard" && currentText !== "Premier") {
        setMenu(null);
        return;
      }

      const readinessRow = resolveReadinessRow(tableRow, liveRows);
      if (!readinessRow?.readiness_id) {
        setMenu(null);
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = (badge ?? cell).getBoundingClientRect();
      setError("");
      setMenu({
        readinessId: readinessRow.readiness_id,
        currentLevel: currentText,
        customerName: readinessRow.customer_name,
        left: rect.left,
        top: rect.bottom + 6,
        width: Math.max(rect.width, 132),
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(null);
      }
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [liveRows]);

  async function chooseLevel(level: Level) {
    if (!menu || saving) return;
    if (level === menu.currentLevel) {
      setMenu(null);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await saveAdventureAssure(menu.readinessId, level);
      setMenu(null);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update Adventure Assure.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!menu) return null;

  return (
    <div
      data-aa-menu="true"
      role="menu"
      aria-label={`Adventure Assure for ${menu.customerName}`}
      style={{
        position: "fixed",
        left: menu.left,
        top: menu.top,
        minWidth: menu.width,
        zIndex: 10000,
        border: "1px solid #dfe4e9",
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 10px 28px rgba(24, 31, 42, 0.18)",
        padding: 6,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {(["Standard", "Premier"] as const).map((level) => (
        <button
          key={level}
          type="button"
          role="menuitem"
          disabled={saving}
          onClick={() => chooseLevel(level)}
          style={{
            display: "block",
            width: "100%",
            border: 0,
            borderRadius: 7,
            background: level === menu.currentLevel ? "#f3f5f7" : "transparent",
            color: level === "Premier" ? "#8a5a00" : "#156e99",
            font: "inherit",
            fontWeight: 800,
            textAlign: "left",
            padding: "9px 10px",
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving && level !== menu.currentLevel ? "Saving…" : level}
        </button>
      ))}

      {error ? (
        <div
          style={{
            maxWidth: 260,
            padding: "7px 10px 5px",
            color: "#b42318",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
