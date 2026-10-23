"use client";
import { useState } from "react";

export default function RhettRepairAction({ sourceId }: { sourceId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function repair() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/team/exceptions/repair-rhett", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to start Rhett repair.");
      if (result.outcome === "requeued" || result.outcome === "recovered" || result.outcome === "already_completed") {
        window.location.reload();
        return;
      }
      setMessage(result.message || "Repair requires review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to repair booking.");
    } finally {
      setBusy(false);
    }
  }
  return <div style={{ display: "grid", gap: 6 }}>
    <button type="button" disabled={busy} onClick={repair}
      style={{ whiteSpace: "nowrap", background: "#eef5fc", border: "1px solid #315f8a", borderRadius: 8, padding: "10px 14px", color: "#24547c", fontWeight: 850 }}>
      {busy ? "Repairing…" : "Repair Booking"}
    </button>
    {message ? <div role="alert" style={{ maxWidth: 230, color: "#a73b2e", fontSize: 12 }}>{message}</div> : null}
  </div>;
}
