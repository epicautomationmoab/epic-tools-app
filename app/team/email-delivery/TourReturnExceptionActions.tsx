"use client";

import { useState } from "react";

type Props = {
  storeVisitId: string;
  vehicleSlot: number;
  checkinStatus: string;
};

export default function TourReturnExceptionActions({ storeVisitId, vehicleSlot, checkinStatus }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function retry() {
    setBusy(true);
    setMessage("");
    try {
      const endpoint = checkinStatus === "prepared"
        ? "/api/team/tour-dispatch/checkin"
        : "/api/team/tour-dispatch/checkin/retry";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_visit_id: storeVisitId, vehicle_slot: vehicleSlot }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to retry tour vehicle check-in.");
      setMessage("Retry sent to Axel In.");
      window.setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to retry tour vehicle check-in.");
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "right" }}>
      <button type="button" disabled={busy} onClick={retry} style={{ whiteSpace: "nowrap", background: "#fff", border: "1px solid #c8d0d7", borderRadius: 8, padding: "10px 14px", color: "#26313b", fontWeight: 850, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Trying…" : "Try Again"}
      </button>
      {message ? <div style={{ marginTop: 6, maxWidth: 220, color: message.startsWith("Retry sent") ? "#187a45" : "#a73b2e", fontSize: 12, fontWeight: 650 }}>{message}</div> : null}
    </div>
  );
}
