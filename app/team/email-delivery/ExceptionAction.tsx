"use client";

import { useState } from "react";

export default function ExceptionAction({ sourceType, sourceId }: { sourceType: "payment" | "deposit_release" | "email_delivery"; sourceId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function markFixed() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/team/exceptions/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_type: sourceType, source_id: sourceId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to mark fixed.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to mark fixed.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "stretch" }}>
      <button
        type="button"
        disabled={busy}
        onClick={markFixed}
        style={{
          whiteSpace: "nowrap",
          border: "1px solid #157f3b",
          borderRadius: 8,
          padding: "10px 14px",
          background: "#edf9f0",
          color: "#126b33",
          fontWeight: 850,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Saving…" : "Mark Fixed"}
      </button>
      {message ? <div style={{ maxWidth: 220, fontSize: 12, color: "#a73b2e", fontWeight: 700 }}>{message}</div> : null}
    </div>
  );
}
