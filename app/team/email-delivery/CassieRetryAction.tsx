"use client";
import { useState } from "react";

export default function CassieRetryAction({ sourceId, mpwrConfirmation }: { sourceId: string; mpwrConfirmation: string | null }) {
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function retry() {
    const dollars = balance.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(dollars) || Number(dollars) <= 0 || confirmation.trim() !== mpwrConfirmation) {
      setError("Enter the current positive MPWR balance and the exact MPWR reservation number.");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/team/exceptions/retry-payment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId, verified_mpwr_confirmation: confirmation.trim(), verified_balance_cents: Math.round(Number(dollars) * 100) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to queue settlement retry");
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to retry"); setBusy(false); }
  }
  return <div style={{ display: "grid", gap: 7 }}>
    <button type="button" onClick={() => setOpen(!open)} style={{ border: "1px solid #315f8a", borderRadius: 8, background: "#eef5fc", padding: "10px 14px", fontWeight: 850, color: "#24547c" }}>Retry Settlement</button>
    {open && <div style={{ display: "grid", gap: 7, maxWidth: 265 }}>
      <div style={{ fontSize: 12, color: "#394452" }}>Open MPWR first. Confirm payment is NOT already settled and note its current amount due. This queues a new attempt that can collect payment.</div>
      <label style={{ fontSize: 12 }}>Current MPWR amount due ($)<input aria-label="Current MPWR amount due" inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" style={{ width: "100%", padding: 7 }} /></label>
      <label style={{ fontSize: 12 }}>Confirm MPWR reservation number<input aria-label="Confirm MPWR number" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder={mpwrConfirmation || "CO-..."} style={{ width: "100%", padding: 7 }} /></label>
      <button type="button" disabled={busy || !mpwrConfirmation} onClick={retry} style={{ padding: 9, fontWeight: 800 }}> {busy ? "Queuing..." : "Confirm & Queue Retry"}</button>
      {error && <span role="alert" style={{ color: "#a73b2e", fontSize: 12 }}>{error}</span>}
    </div>}
  </div>;
}
