"use client";

import { useState } from "react";

export default function RhettManualResolution({ sourceId }: { sourceId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!note.trim()) { setError("Please add a note describing how this was resolved."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/team/exceptions/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_type: "rhett_booking", source_id: sourceId, resolution_note: note.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to mark manually repaired.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save resolution.");
      setBusy(false);
    }
  }
  return <div style={{ display: "grid", gap: 7, maxWidth: 260 }}>
    {!open ? <button type="button" onClick={() => setOpen(true)} style={{ whiteSpace: "nowrap", background: "#edf9f0", border: "1px solid #157f3b", borderRadius: 8, padding: "10px 14px", color: "#126b33", fontWeight: 850 }}>Manually Repaired</button> : <>
      <label htmlFor={`rhett-note-${sourceId}`} style={{ fontSize: 12, fontWeight: 750 }}>Resolution note (required)</label>
      <textarea id={`rhett-note-${sourceId}`} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="What was done to resolve this booking?" style={{ width: "100%", padding: 8, border: "1px solid #c8d0d7", borderRadius: 7 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" disabled={busy || !note.trim()} onClick={save} style={{ padding: "8px 10px", borderRadius: 7, color: "white", background: "#126b33", border: 0, fontWeight: 800 }}>{busy ? "Saving…" : "Save resolution"}</button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(""); }} style={{ padding: "8px 10px", borderRadius: 7, background: "white", border: "1px solid #c8d0d7" }}>Cancel</button>
      </div>
    </>}
    {error ? <div role="alert" style={{ color: "#a73b2e", fontSize: 12 }}>{error}</div> : null}
  </div>;
}
