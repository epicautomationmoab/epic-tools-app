"use client";

import { useState } from "react";

export type VehicleIssueReporterRow = {
  store_visit_id: string;
  vehicle_slot: number;
  vehicle_label: string | null;
  vehicle_number?: string | null;
};

type Escalation = "maintenance" | "urgent" | "critical";

export function VehicleIssueReporter({ row, guideName }: { row: VehicleIssueReporterRow; guideName: string }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState("");
  const [escalation, setEscalation] = useState<Escalation>("maintenance");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const car = row.vehicle_number || row.vehicle_label || "vehicle";

  async function submit() {
    const text = report.trim();
    if (!text) {
      setMessage("Describe what you or the guest experienced.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/team/tour-dispatch/issue-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_visit_id: row.store_visit_id,
          vehicle_slot: row.vehicle_slot,
          experience_report: text,
          escalation_level: escalation,
          guide_name: guideName,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to submit vehicle report.");
      if (payload?.notification_warning) {
        setMessage(`Report saved. ${payload.notification_warning}`);
        return;
      }
      setReport("");
      setEscalation("maintenance");
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit vehicle report.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button
      type="button"
      onClick={() => { setOpen(true); setMessage(""); }}
      title="Report car trouble"
      aria-label={`Report car trouble for ${car}`}
      style={{
        width: 34,
        height: 34,
        marginLeft: 7,
        padding: 0,
        border: "1px solid #c7a34a",
        borderRadius: 7,
        background: "#fff8df",
        color: "#7b5a08",
        fontSize: 16,
        lineHeight: 1,
        fontWeight: 900,
        cursor: "pointer",
        verticalAlign: "middle",
      }}
    >⚠</button>

    {open ? <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(24, 31, 38, 0.28)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report car trouble for ${car}`}
        style={{
          width: 430,
          maxWidth: "94vw",
          padding: 18,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 18px 55px rgba(20, 27, 34, 0.22)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 12 }}>
          <div>
            <div style={{ color: "#8a670d", fontSize: 10, fontWeight: 900, letterSpacing: ".07em", textTransform: "uppercase" }}>Vehicle Issue</div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>Car {car}</div>
          </div>
          <button
            type="button"
            onClick={() => { if (!busy) setOpen(false); }}
            disabled={busy}
            aria-label="Close"
            style={{ border: 0, background: "transparent", color: "#68727c", fontSize: 22, lineHeight: 1, cursor: busy ? "wait" : "pointer" }}
          >×</button>
        </div>

        <label style={{ display: "block", marginBottom: 6, color: "#2f3943", fontSize: 12, fontWeight: 800 }}>What did you experience with this vehicle?</label>
        <div style={{ marginBottom: 8, color: "#66717b", fontSize: 11, lineHeight: 1.35 }}>
          Describe what you or the guest experienced, heard, saw, smelled, or felt. Please do not diagnose the mechanical cause.
        </div>
        <textarea
          autoFocus
          value={report}
          onChange={(event) => { setReport(event.target.value); setMessage(""); }}
          rows={3}
          maxLength={2000}
          placeholder="Example: AC was blowing, but the air was not cold."
          style={{ width: "100%", resize: "vertical", boxSizing: "border-box", padding: 9, border: "1px solid #cbd1d8", borderRadius: 7, font: "inherit", fontSize: 12 }}
        />

        <div style={{ marginTop: 12, marginBottom: 6, color: "#2f3943", fontSize: 12, fontWeight: 800 }}>Escalation</div>
        <div style={{ display: "grid", gap: 6 }}>
          {([
            ["maintenance", "Maintenance", "Routine repair or inspection."],
            ["urgent", "Urgent", "Needs attention before next use."],
            ["critical", "Critical / Safety", "Possible safety issue; immediate attention."],
          ] as const).map(([value, title, detail]) => <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34, padding: "5px 8px", border: escalation === value ? "1px solid #b7bec6" : "1px solid #e1e5e9", borderRadius: 7, background: escalation === value ? "#f6f8fa" : "#fff", cursor: "pointer" }}>
            <input type="radio" name={`issue-${row.store_visit_id}-${row.vehicle_slot}`} checked={escalation === value} onChange={() => setEscalation(value)} />
            <span style={{ fontSize: 11, lineHeight: 1.25 }}><strong>{title}</strong> <span style={{ color: "#707a84" }}>— {detail}</span></span>
          </label>)}
        </div>

        {message ? <div style={{ marginTop: 9, fontSize: 11, color: message.startsWith("Report saved") ? "#2c6b46" : "#9b3030" }}>{message}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={() => { if (!busy) setOpen(false); }} disabled={busy} style={{ minHeight: 34, padding: "0 12px", border: "1px solid #cbd1d8", borderRadius: 7, background: "#fff", color: "#4d5863", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Cancel</button>
          <button type="button" onClick={submit} disabled={busy} style={{ minHeight: 34, padding: "0 13px", border: 0, borderRadius: 7, background: escalation === "critical" ? "#a62f2f" : escalation === "urgent" ? "#b86b12" : "#475866", color: "#fff", fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>{busy ? "Submitting…" : "Submit Report"}</button>
        </div>
      </div>
    </div> : null}
  </>;
}
