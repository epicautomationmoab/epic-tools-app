"use client";

import { useState } from "react";

type Escalation = "maintenance" | "urgent" | "critical";
type Props = { storeVisitId: string; guideName: string; activity: string; onReported?: () => void };

export function GuideVehicleIssueReporter({ storeVisitId, guideName, activity, onReported }: Props) {
  const [open, setOpen] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [report, setReport] = useState("");
  const [escalation, setEscalation] = useState<Escalation>("maintenance");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reported, setReported] = useState(false);

  async function submit() {
    if (!vehicleNumber.trim() || !report.trim()) {
      setMessage("Enter the guide car number and describe the concern.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/team/tour-dispatch/issue-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_visit_id: storeVisitId,
          guide_vehicle: true,
          vehicle_number: vehicleNumber.trim(),
          guide_name: guideName,
          experience_report: report.trim(),
          escalation_level: escalation,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to save guide vehicle report.");
      setReported(true);
      onReported?.();
      if (payload.notification_warning) {
        setMessage(`Report saved, but notification needs attention: ${payload.notification_warning}`);
      } else {
        setOpen(false);
        setReport("");
        setVehicleNumber("");
        setEscalation("maintenance");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save report.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" title={reported ? "Report another guide vehicle concern" : "Report guide car trouble"} aria-label="Report guide car trouble"
      onClick={() => { setOpen(true); setMessage(""); }}
      style={{ border: reported ? "1px solid #d89a23" : "1px solid #e5e7eb", borderRadius: 8, padding: "7px 10px", background: reported ? "#fff4d9" : "#fff", color: "#be8000", fontSize: 19, cursor: "pointer", lineHeight: 1 }}>⚠</button>
    {open ? <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}
      style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", justifyContent: "center", alignItems: "center", padding: 16, background: "rgba(24,31,38,.4)" }}>
      <div role="dialog" aria-modal="true" aria-label="Guide vehicle trouble report"
        style={{ width: 430, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 18px 55px #1114" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <div><div style={{ color: "#9a6809", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Guide Vehicle Issue</div>
            <h3 style={{ margin: "5px 0" }}>Report Guide Car Trouble</h3>
            <div style={{ color: "#6b7280", fontSize: 12 }}>{activity}{guideName ? ` · ${guideName}` : ""}</div>
          </div>
          <button type="button" aria-label="Close report" disabled={busy} onClick={() => setOpen(false)} style={{ border: 0, background: "none", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>
        <label style={{ display: "block", margin: "18px 0 6px", fontWeight: 700, fontSize: 12 }}>Guide car number</label>
        <input autoFocus value={vehicleNumber} maxLength={20} onChange={e => { setVehicleNumber(e.target.value); setMessage(""); }} placeholder="e.g. 12-T"
          style={{ width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid #cbd1d8", borderRadius: 7 }} />
        <label style={{ display: "block", margin: "14px 0 6px", fontWeight: 700, fontSize: 12 }}>What did the guide experience?</label>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Describe what happened, not a mechanical diagnosis.</div>
        <textarea rows={4} maxLength={2000} value={report} onChange={e => { setReport(e.target.value); setMessage(""); }}
          placeholder="What did the guide see, hear, smell or feel?" style={{ width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid #cbd1d8", borderRadius: 7, resize: "vertical" }} />
        <div style={{ margin: "14px 0 7px", fontWeight: 700, fontSize: 12 }}>Priority</div>
        {([["maintenance", "Maintenance — routine attention"], ["urgent", "Urgent — inspect before next use"], ["critical", "Critical / Safety — immediate attention"]] as const).map(([value, label]) =>
          <label key={value} style={{ display: "block", padding: "7px 0", fontSize: 12, cursor: "pointer" }}>
            <input type="radio" checked={escalation === value} onChange={() => setEscalation(value)} style={{ marginRight: 8 }} />{label}
          </label>
        )}
        {message ? <p role="status" style={{ color: message.startsWith("Report saved") ? "#276749" : "#a12c2c", fontSize: 12 }}>{message}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button type="button" onClick={() => setOpen(false)} disabled={busy} style={{ border: "1px solid #cbd1d8", borderRadius: 7, padding: "9px 14px", background: "#fff", cursor: "pointer" }}>Cancel</button>
          <button type="button" onClick={submit} disabled={busy} style={{ border: 0, borderRadius: 7, padding: "9px 14px", background: "#334155", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{busy ? "Submitting…" : "Submit Report"}</button>
        </div>
      </div>
    </div> : null}
  </>;
}
