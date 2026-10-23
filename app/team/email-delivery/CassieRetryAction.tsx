"use client";
import { useState } from "react";

export default function CassieRetryAction({ sourceId }: { sourceId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function retry() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/team/exceptions/retry-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to queue settlement retry.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to retry.");
      setBusy(false);
    }
  }
  return <div style={{ display: "grid", gap: 7 }}>
    <button type="button" disabled={busy} onClick={retry} style={{ border: "1px solid #315f8a", borderRadius: 8, background: "#eef5fc", padding: "10px 14px", fontWeight: 850, color: "#24547c", cursor: busy ? "wait" : "pointer" }}>
      {busy ? "Queuing Retry..." : "Retry Settlement"}
    </button>
    {error && <span role="alert" style={{ color: "#a73b2e", fontSize: 12 }}>{error}</span>}
  </div>;
}
