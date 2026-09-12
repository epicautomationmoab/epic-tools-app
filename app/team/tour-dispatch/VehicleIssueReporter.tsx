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
      setReport("");
      setEscalation("maintenance");
      setOpen(false);
      setMessage(payload?.notification_warning ? `Report saved. ${payload.notification_warning}` : "Vehicle issue reported.");
      window.setTimeout(() => setMessage(""), 6000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit vehicle report.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => { setOpen(true); setMessage(""); }}
        style={{
          minHeight: 32,
          padding: "0 11px",
          border: "1px solid #c7a34a",
          borderRadius: 7,
          background: "#fff8df",
          color: "#6d5312",
          fontSize: 11,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >⚠ Report Car Trouble</button>
      {message ? <div style={{ marginTop: 5, maxWidth: 250, fontSize: 11, color: message.includes("saved") || message.includes("reported") ? "#2c6b46" : "#9b3030" }}>{message}</div> : null}
    </div>;
  }

  return <div style={{ marginTop: 10, width: 330, maxWidth: "78vw", padding: 12, border: "1px solid #d5d9de", borderRadius: 9, background: "#fff" }}>
    <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 7 }}>Report Car Trouble — {car}</div>
    <div style={{ marginBottom: 7, color: "#59636d", fontSize: 11, lineHeight: 1.35 }}>
      Describe what you or the guest experienced, heard, saw, smelled, or felt. Please do not diagnose the mechanical cause.
    </div>
    <textarea
      value={report}
      onChange={(event) => { setReport(event.target.value); setMessage(""); }}
      rows={4}
      maxLength={2000}
      placeholder="Example: AC was blowing, but the air was not cold."
      style={{ width: "100%", resize: "vertical", padding: 9, border: "1px solid #cbd1d8", borderRadius: 7, font: "inherit", fontSize: 12 }}
    />
    <div style={{ display: "grid", gap: 6, marginTop: 10, fontSize: 11 }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 7 }}><input type="radio" name={`issue-${row.store_visit_id}-${row.vehicle_slot}`} checked={escalation === "maintenance"} onChange={() => setEscalation("maintenance")} /><span><strong>Maintenance Notification</strong><br />Routine repair or inspection item.</span></label>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 7 }}><input type="radio" name={`issue-${row.store_visit_id}-${row.vehicle_slot}`} checked={escalation === "urgent"} onChange={() => setEscalation("urgent")} /><span><strong>Urgent</strong><br />Needs attention before this vehicle's next scheduled use.</span></label>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 7 }}><input type="radio" name={`issue-${row.store_visit_id}-${row.vehicle_slot}`} checked={escalation === "critical"} onChange={() => setEscalation("critical")} /><span><strong>Critical / Safety</strong><br />Possible safety issue. Immediate leadership/maintenance attention.</span></label>
    </div>
    {message ? <div style={{ marginTop: 8, fontSize: 11, color: "#9b3030" }}>{message}</div> : null}
    <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
      <button type="button" onClick={submit} disabled={busy} style={{ minHeight: 34, padding: "0 12px", border: 0, borderRadius: 7, background: escalation === "critical" ? "#a62f2f" : escalation === "urgent" ? "#b86b12" : "#475866", color: "#fff", fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>{busy ? "Submitting…" : "Submit Report"}</button>
      <button type="button" onClick={() => { if (!busy) { setOpen(false); setMessage(""); } }} disabled={busy} style={{ minHeight: 34, padding: "0 12px", border: "1px solid #cbd1d8", borderRadius: 7, background: "#fff", color: "#4d5863", fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>Cancel</button>
    </div>
  </div>;
}
