"use client";

import { useState } from "react";
import styles from "./ExpParticipants.module.css";

export type ExpParticipantDraft = { fullName: string; initials: string };
export default function ExpParticipants({
  onContinue,
  onBack,
}: {
  onContinue: (participants: ExpParticipantDraft[]) => void;
  onBack: () => void;
}) {
  const [drivers, setDrivers] = useState<ExpParticipantDraft[]>([{ fullName: "", initials: "" }]);
  const [confirmed, setConfirmed] = useState(false);
  const names = drivers.map(d => d.fullName.trim().replace(/\s+/g, " "));
  const ready = confirmed && drivers.length > 0 && drivers.every(d => d.fullName.trim().length >= 3 && /^[a-z]{1,6}$/i.test(d.initials.trim())) && new Set(names.map(n => n.toLowerCase())).size === drivers.length;
  function edit(index: number, key: keyof ExpParticipantDraft, value: string) {
    setDrivers(prev => prev.map((d, i) => i === index ? { ...d, [key]: value } : d));
  }
  return <section className={styles.wrap} aria-label="EXP participating drivers">
    <h3>Who is participating?</h3>
    <p>One person or a group can take this assessment together. Every driver participating must be listed.</p>
    <p className={styles.note}>If a driver's waiver isn't available yet, enter the name they'll use on their waiver. Readiness will reconcile any differences.</p>
    {drivers.map((driver, index) => <div className={styles.driver} key={index}>
      <label>Driver {index + 1} — full name
        <input autoComplete="off" value={driver.fullName} maxLength={120} onChange={e => edit(index, "fullName", e.target.value)} placeholder="First and last name" />
      </label>
      <label>Initials
        <input autoComplete="off" value={driver.initials} maxLength={6} onChange={e => edit(index, "initials", e.target.value)} placeholder="Initials" />
      </label>
      {drivers.length > 1 ? <button type="button" className={styles.remove} onClick={() => setDrivers(prev => prev.filter((_, i) => i !== index))} aria-label={`Remove driver ${index + 1}`}>Remove</button> : null}
    </div>)}
    <button type="button" className={styles.add} disabled={drivers.length >= 20} onClick={() => setDrivers(prev => [...prev, { fullName: "", initials: "" }])}>+ Add another driver</button>
    <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
      <span>All drivers listed watched the entire Epic Xpress Ready orientation and are participating in this knowledge check.</span>
    </label>
    <div className={styles.actions}>
      <button type="button" disabled={!ready} onClick={() => onContinue(drivers.map(d => ({fullName:d.fullName.trim().replace(/\s+/g, " "), initials:d.initials.trim().toUpperCase()})))}>Continue to Knowledge Check</button>
      <button type="button" className={styles.back} onClick={onBack}>Back to orientation</button>
    </div>
    <p className={styles.note}>Preview only: driver names and initials are not saved or matched to waivers yet.</p>
  </section>;
}
