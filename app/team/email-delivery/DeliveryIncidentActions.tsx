"use client";

import { useState } from "react";

type Props = {
  incidentId: string;
  status: string;
};

export default function DeliveryIncidentActions({ incidentId, status }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run(action: "claim" | "resolve" | "reopen") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/guest-communications/delivery-incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, action }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to update delivery incident.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update delivery incident.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {status === "open" ? <button type="button" disabled={busy} onClick={() => run("claim")}>Claim</button> : null}
        {status !== "resolved" ? <button type="button" disabled={busy} onClick={() => run("resolve")}>Resolve</button> : null}
        {status === "resolved" ? <button type="button" disabled={busy} onClick={() => run("reopen")}>Reopen</button> : null}
      </div>
      {message ? <p style={{ margin: "8px 0 0", color: "#a73b2e", fontSize: 12 }}>{message}</p> : null}
    </div>
  );
}
