"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReadinessRow } from "@/lib/supabase";

type Escalation = "maintenance" | "urgent" | "critical";

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
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function confirmationFromRow(row: HTMLTableRowElement) {
  for (const anchor of Array.from(row.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const match = anchor.href.match(/\/trip\/([^/]+)\/bookings/i);
    if (match?.[1]) return decodeURIComponent(match[1]).toUpperCase();
  }
  return null;
}

function resolveReadinessRow(tableRow: HTMLTableRowElement, rows: ReadinessRow[]) {
  const confirmation = confirmationFromRow(tableRow);
  if (!confirmation) return null;

  const candidates = rows.filter(
    (row) => row.readiness_id && row.confirmation_code?.trim().toUpperCase() === confirmation,
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

export default function RentalVehicleIssueEnhancer({ rows }: { rows: ReadinessRow[] }) {
  const liveRows = useRef(rows);
  const selectedReadinessId = useRef<string | null>(null);
  const [reportRow, setReportRow] = useState<ReadinessRow | null>(null);
  const [carNumber, setCarNumber] = useState("");
  const [report, setReport] = useState("");
  const [escalation, setEscalation] = useState<Escalation>("maintenance");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    liveRows.current = rows;
  }, [rows]);

  useEffect(() => {
    function enhanceDrawer() {
      const drawer = document.querySelector<HTMLElement>(
        "[role='dialog'][aria-label$=' reservation details']:not([aria-label$=' historical reservation details'])",
      );
      if (!drawer || !selectedReadinessId.current) return;

      const row = liveRows.current.find((item) => item.readiness_id === selectedReadinessId.current);
      if (!row || row.business_line !== "rental" || !row.readiness_id) return;

      const rentalButton = Array.from(drawer.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
        const text = button.textContent?.trim();
        return text === "Rental Returned" || text === "Rental Out" || text === "Clear Rental Status" || text === "Saving...";
      });
      if (!rentalButton) return;

      const section = rentalButton.closest("section") as HTMLElement | null;
      if (!section) return;

      section.style.display = "flex";
      section.style.flexWrap = "wrap";
      section.style.alignItems = "center";
      section.style.justifyContent = "flex-start";
      section.style.gap = "10px";
      rentalButton.style.width = "auto";
      rentalButton.style.flex = "0 1 auto";
      rentalButton.style.minWidth = "180px";
      rentalButton.style.paddingLeft = "28px";
      rentalButton.style.paddingRight = "28px";

      for (const paragraph of Array.from(section.querySelectorAll<HTMLElement>(":scope > p"))) {
        paragraph.style.flexBasis = "100%";
        paragraph.style.marginBottom = "0";
      }

      let warning = section.querySelector<HTMLButtonElement>("[data-rental-vehicle-issue='true']");
      if (!warning) {
        warning = document.createElement("button");
        warning.type = "button";
        warning.dataset.rentalVehicleIssue = "true";
        warning.textContent = "⚠";
        warning.title = "Report vehicle trouble";
        warning.setAttribute("aria-label", "Report rental vehicle trouble");
        warning.style.border = "0";
        warning.style.background = "transparent";
        warning.style.color = "#ffbf00";
        warning.style.fontSize = "25px";
        warning.style.fontWeight = "900";
        warning.style.lineHeight = "1";
        warning.style.padding = "2px";
        warning.style.margin = "0";
        warning.style.cursor = "pointer";
        warning.style.width = "30px";
        warning.style.height = "34px";
        warning.style.display = "inline-grid";
        warning.style.placeItems = "center";
        warning.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const current = liveRows.current.find((item) => item.readiness_id === selectedReadinessId.current);
          if (!current || current.business_line !== "rental") return;
          setCarNumber("");
          setReport("");
          setEscalation("maintenance");
          setMessage("");
          setReportRow(current);
        });
        rentalButton.insertAdjacentElement("afterend", warning);
      }
    }

    function trackSelectedRow(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const tableRow = target?.closest("table tbody tr") as HTMLTableRowElement | null;
      if (!tableRow) return;
      const row = resolveReadinessRow(tableRow, liveRows.current);
      selectedReadinessId.current = row?.readiness_id ?? null;
      window.setTimeout(enhanceDrawer, 0);
    }

    document.addEventListener("click", trackSelectedRow, true);
    enhanceDrawer();
    const observer = new MutationObserver(enhanceDrawer);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", trackSelectedRow, true);
      observer.disconnect();
    };
  }, []);

  async function submit() {
    if (!reportRow?.readiness_id) return;
    const car = carNumber.replace(/\D/g, "").replace(/^0+/, "");
    if (!car) {
      setMessage("Enter the car number.");
      return;
    }
    const text = report.trim();
    if (!text) {
      setMessage("Describe what you or the guest experienced.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/team/readiness/rental-issue-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readiness_id: reportRow.readiness_id,
          vehicle_number: car,
          experience_report: text,
          escalation_level: escalation,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to submit vehicle report.");
      if (payload?.notification_warning) {
        setMessage(`Report saved. ${payload.notification_warning}`);
        return;
      }
      setReportRow(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit vehicle report.");
    } finally {
      setBusy(false);
    }
  }

  if (!reportRow || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) setReportRow(null);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(24,31,38,.28)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report rental vehicle trouble for ${reportRow.customer_name}`}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: 430,
          maxWidth: "94vw",
          padding: 18,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 18px 55px rgba(20,27,34,.22)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 12 }}>
          <div>
            <div style={{ color: "#8a670d", fontSize: 10, fontWeight: 900, letterSpacing: ".07em", textTransform: "uppercase" }}>Rental Vehicle Issue</div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>{reportRow.customer_name}</div>
            <div style={{ marginTop: 2, color: "#707a84", fontSize: 11 }}>{reportRow.confirmation_code}</div>
          </div>
          <button type="button" onClick={() => !busy && setReportRow(null)} disabled={busy} aria-label="Close" style={{ border: 0, background: "transparent", color: "#68727c", fontSize: 22, lineHeight: 1, cursor: busy ? "wait" : "pointer" }}>×</button>
        </div>

        <label style={{ display: "block", marginBottom: 6, color: "#2f3943", fontSize: 12, fontWeight: 800 }}>Car #</label>
        <input
          autoFocus
          value={carNumber}
          onChange={(event) => { setCarNumber(event.target.value.replace(/\D/g, "")); setMessage(""); }}
          inputMode="numeric"
          placeholder="Example: 42"
          maxLength={4}
          style={{ width: 110, boxSizing: "border-box", padding: "8px 9px", border: "1px solid #cbd1d8", borderRadius: 7, font: "inherit", fontSize: 13, fontWeight: 800 }}
        />

        <label style={{ display: "block", marginTop: 12, marginBottom: 6, color: "#2f3943", fontSize: 12, fontWeight: 800 }}>What did you experience with this vehicle?</label>
        <div style={{ marginBottom: 8, color: "#66717b", fontSize: 11, lineHeight: 1.35 }}>
          Describe what you or the guest experienced, heard, saw, smelled, or felt. Please do not diagnose the mechanical cause.
        </div>
        <textarea
          value={report}
          onChange={(event) => { setReport(event.target.value); setMessage(""); }}
          rows={3}
          maxLength={2000}
          placeholder="Example: Steering wheel shook above 25 mph."
          style={{ width: "100%", resize: "vertical", boxSizing: "border-box", padding: 9, border: "1px solid #cbd1d8", borderRadius: 7, font: "inherit", fontSize: 12 }}
        />

        <div style={{ marginTop: 12, marginBottom: 6, color: "#2f3943", fontSize: 12, fontWeight: 800 }}>Escalation</div>
        <div style={{ display: "grid", gap: 6 }}>
          {([
            ["maintenance", "Maintenance", "Routine repair or inspection."],
            ["urgent", "Urgent", "Needs attention before next use."],
            ["critical", "Critical / Safety", "Possible safety issue; immediate attention."],
          ] as const).map(([value, title, detail]) => {
            const selected = escalation === value;
            return <button
              key={value}
              type="button"
              onClick={() => setEscalation(value)}
              aria-pressed={selected}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                minHeight: 38,
                padding: "7px 10px",
                border: selected ? "1px solid #8d98a3" : "1px solid #dfe4e8",
                borderRadius: 7,
                background: selected ? "#f4f6f8" : "#fff",
                color: "#24303a",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true" style={{ width: 14, height: 14, flex: "0 0 14px", borderRadius: "50%", border: selected ? "4px solid #2563eb" : "1.5px solid #8b949e", background: selected ? "#fff" : "transparent", boxSizing: "border-box" }} />
              <span style={{ fontSize: 11, lineHeight: 1.25 }}><strong>{title}</strong> <span style={{ color: "#707a84" }}>— {detail}</span></span>
            </button>;
          })}
        </div>

        {message ? <div style={{ marginTop: 9, fontSize: 11, color: message.startsWith("Report saved") ? "#2c6b46" : "#9b3030" }}>{message}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={() => !busy && setReportRow(null)} disabled={busy} style={{ minHeight: 34, padding: "0 12px", border: "1px solid #cbd1d8", borderRadius: 7, background: "#fff", color: "#4d5863", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Cancel</button>
          <button type="button" onClick={submit} disabled={busy} style={{ minHeight: 34, padding: "0 13px", border: 0, borderRadius: 7, background: escalation === "critical" ? "#a62f2f" : escalation === "urgent" ? "#b86b12" : "#475866", color: "#fff", fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>{busy ? "Submitting…" : "Submit Report"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
