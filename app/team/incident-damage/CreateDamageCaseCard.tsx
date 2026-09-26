"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../readiness/ReadinessShell.module.css";

export default function CreateDamageCaseCard({ confirmationCode }: { confirmationCode: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function createCase() {
    if (!vehicleNumber.trim()) {
      setError("Enter the vehicle number first.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/team/incident-damage/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationCode,
          caseType: "returned_damage",
          vehicleNumber: vehicleNumber.trim(),
          note: note.trim() || undefined,
        }),
      });
      const data = await response.json() as { caseId?: string; error?: string };
      if (!response.ok || !data.caseId) throw new Error(data.error || "Unable to create damage case.");
      router.push(`/team/incident-damage/case/${encodeURIComponent(data.caseId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create damage case.");
      setWorking(false);
    }
  }

  if (!expanded) {
    return <button className={styles.actionButton} type="button" onClick={() => setExpanded(true)}>Create Damage Case</button>;
  }

  return <div style={{ display: "grid", gap: 9 }}>
    <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>
      Vehicle #
      <input
        value={vehicleNumber}
        onChange={event => setVehicleNumber(event.target.value)}
        placeholder="Vehicle number"
        inputMode="numeric"
        autoFocus
        style={{ minHeight: 42, borderRadius: 9, border: "1px solid rgba(0,0,0,.16)", padding: "0 11px", font: "inherit", background: "rgba(255,255,255,.7)" }}
      />
    </label>
    <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>
      Quick staff note <span style={{ opacity: .55, fontWeight: 600 }}>(optional)</span>
      <textarea
        value={note}
        onChange={event => setNote(event.target.value)}
        placeholder="What caught your attention?"
        rows={2}
        style={{ borderRadius: 9, border: "1px solid rgba(0,0,0,.16)", padding: 10, font: "inherit", resize: "vertical", background: "rgba(255,255,255,.7)" }}
      />
    </label>
    {error ? <div style={{ color: "#9b1c1c", fontSize: 13, fontWeight: 800 }}>{error}</div> : null}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className={styles.actionButton} type="button" disabled={working} onClick={() => void createCase()}>{working ? "Creating…" : "Create Case"}</button>
      <button className={styles.actionButton} type="button" disabled={working} onClick={() => { setExpanded(false); setError(""); }}>Cancel</button>
    </div>
  </div>;
}
