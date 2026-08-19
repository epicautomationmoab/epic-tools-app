"use client";

import { Fragment, useMemo, useState } from "react";
import styles from "./TourDispatch.module.css";

export type TourDispatchRow = {
  store_visit_id: string;
  readiness_id: string | null;
  confirmation_code: string;
  customer_name: string;
  product_display_name: string;
  visit_start_time: string;
  total_vehicle_count: number;
  vehicle_slot: number;
  vehicle_label: string | null;
  checkout_mileage: number | null;
  checkout_engine_hours: number | null;
  checkout_status: string;
  checkin_status: string;
  mpwr_vehicle_number_observed: string | null;
  mpwr_driver_observation: string | null;
  mpwr_driver_unexpected_names: boolean | null;
  mpwr_checkout_notes: string | null;
  manual_mpwr_checkout_confirmed_at: string | null;
};

type Draft = { car: string; mileage: string; hours: string };
type ObservationDraft = { mpwrCar: string; driver: string; unexpectedNames: boolean; notes: string };

function keyFor(row: TourDispatchRow) { return `${row.store_visit_id}:${row.vehicle_slot}`; }
function formatTime(value: string) {
  const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour24 = Number(match[1]);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour24 % 12 || 12}:${match[2]} ${suffix}`;
}
function departureLocked(status: string) { return ["checkout_queued", "checking_out", "out"].includes(status); }

export default function TourDispatchTable({ rows }: { rows: TourDispatchRow[] }) {
  const initialDrafts = useMemo(() => Object.fromEntries(rows.map((row) => [keyFor(row), {
    car: row.vehicle_label ?? "", mileage: row.checkout_mileage == null ? "" : String(row.checkout_mileage), hours: row.checkout_engine_hours == null ? "" : String(row.checkout_engine_hours),
  }])), [rows]);
  const initialObservations = useMemo(() => Object.fromEntries(rows.map((row) => [keyFor(row), {
    mpwrCar: row.mpwr_vehicle_number_observed ?? row.vehicle_label ?? "",
    driver: row.mpwr_driver_observation ?? "expected",
    unexpectedNames: row.mpwr_driver_unexpected_names ?? false,
    notes: row.mpwr_checkout_notes ?? "",
  }])), [rows]);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts);
  const [observations, setObservations] = useState<Record<string, ObservationDraft>>(initialObservations);
  const [statuses, setStatuses] = useState<Record<string, string>>(Object.fromEntries(rows.map((row) => [keyFor(row), row.checkout_status])));
  const [checkinStatuses, setCheckinStatuses] = useState<Record<string, string>>(Object.fromEntries(rows.map((row) => [keyFor(row), row.checkin_status])));
  const [openObservation, setOpenObservation] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  function updateDraft(key: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
    setMessages((current) => ({ ...current, [key]: "" }));
  }
  function updateObservation<K extends keyof ObservationDraft>(key: string, field: K, value: ObservationDraft[K]) {
    setObservations((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
    setMessages((current) => ({ ...current, [key]: "" }));
  }

  async function queueCheckout(row: TourDispatchRow) {
    const key = keyFor(row); const draft = drafts[key];
    if (!draft?.car.trim() || !draft.mileage.trim() || !draft.hours.trim()) {
      setMessages((current) => ({ ...current, [key]: "Enter car #, mileage, and hours." })); return;
    }
    setBusyKey(key);
    try {
      const response = await fetch("/api/team/tour-dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ store_visit_id: row.store_visit_id, vehicle_slot: row.vehicle_slot, vehicle_label: draft.car.trim(), checkout_mileage: Number(draft.mileage), checkout_engine_hours: Number(draft.hours) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to prepare checkout.");
      setStatuses((current) => ({ ...current, [key]: payload?.checkout_status || "checkout_queued" }));
      setCheckinStatuses((current) => ({ ...current, [key]: payload?.checkin_status || "prepared" }));
      setObservations((current) => ({ ...current, [key]: { ...current[key], mpwrCar: draft.car.trim() } }));
      setOpenObservation(key);
      setMessages((current) => ({ ...current, [key]: "Miles prepared Axel Out + Axel In (shadow)." }));
    } catch (error) { setMessages((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to prepare checkout." })); }
    finally { setBusyKey(null); }
  }

  async function saveObservation(row: TourDispatchRow) {
    const key = keyFor(row); const observation = observations[key];
    if (!observation?.mpwrCar.trim() || !observation.driver) { setMessages((current) => ({ ...current, [key]: "Enter the MPWR car number and Driver result." })); return; }
    setBusyKey(key);
    try {
      const response = await fetch("/api/team/tour-dispatch/observation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_visit_id: row.store_visit_id,
          vehicle_slot: row.vehicle_slot,
          mpwr_vehicle_number_observed: observation.mpwrCar.trim(),
          mpwr_driver_observation: observation.driver,
          mpwr_driver_unexpected_names: observation.unexpectedNames,
          mpwr_checkout_notes: observation.notes.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to save MPWR result.");
      setStatuses((current) => ({ ...current, [key]: "out" })); setOpenObservation(null);
      setMessages((current) => ({ ...current, [key]: "Manual MPWR checkout recorded. Vehicle is OUT." }));
    } catch (error) { setMessages((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to save MPWR result." })); }
    finally { setBusyKey(null); }
  }

  async function releaseCheckin(row: TourDispatchRow) {
    const key = keyFor(row); setBusyKey(key);
    try {
      const response = await fetch("/api/team/tour-dispatch/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ store_visit_id: row.store_visit_id, vehicle_slot: row.vehicle_slot }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to release Axel In shadow package.");
      setCheckinStatuses((current) => ({ ...current, [key]: "checkin_queued" }));
      setMessages((current) => ({ ...current, [key]: "Axel In shadow package released — no MPWR automation ran." }));
    } catch (error) { setMessages((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to release check-in." })); }
    finally { setBusyKey(null); }
  }

  if (!rows.length) return <div className={styles.empty}>No MPWR tour vehicles are scheduled for today.</div>;

  return <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Name</th><th>Activity</th><th>Time</th><th>Car #</th><th>Mileage</th><th>Hours</th><th aria-label="Vehicle action" /></tr></thead>
    <tbody>{rows.map((row) => {
      const key = keyFor(row), draft = drafts[key] ?? { car: "", mileage: "", hours: "" }, observation = observations[key] ?? { mpwrCar: "", driver: "expected", unexpectedNames: false, notes: "" };
      const status = statuses[key] ?? row.checkout_status, checkinStatus = checkinStatuses[key] ?? row.checkin_status, locked = departureLocked(status), busy = busyKey === key, observationVisible = openObservation === key, message = messages[key];
      return <Fragment key={key}>
        <tr>
          <td><strong>{row.customer_name}</strong>{row.total_vehicle_count > 1 ? <span className={styles.slot}>Vehicle {row.vehicle_slot} of {row.total_vehicle_count}</span> : null}</td>
          <td>{row.product_display_name}</td><td className={styles.time}>{formatTime(row.visit_start_time)}</td>
          <td><input value={draft.car} onChange={(e) => updateDraft(key, "car", e.target.value)} disabled={locked} /></td>
          <td><input value={draft.mileage} onChange={(e) => updateDraft(key, "mileage", e.target.value)} inputMode="decimal" disabled={locked} /></td>
          <td><input value={draft.hours} onChange={(e) => updateDraft(key, "hours", e.target.value)} inputMode="decimal" disabled={locked} /></td>
          <td className={styles.saveCell}>
            {!locked ? <button type="button" onClick={() => queueCheckout(row)} disabled={busy}>{busy ? "Preparing…" : "Check Out Vehicle"}</button> : null}
            {status === "checkout_queued" ? <button type="button" className={styles.secondaryButton} onClick={() => setOpenObservation(observationVisible ? null : key)}>{observationVisible ? "Close MPWR Check" : "Record MPWR Check"}</button> : null}
            {status === "out" && checkinStatus !== "checkin_queued" ? <button type="button" className={styles.checkinButton} onClick={() => releaseCheckin(row)} disabled={busy}>{busy ? "Releasing…" : "Check In Vehicle"}</button> : null}
            {checkinStatus === "checkin_queued" ? <span className={styles.statusPill}>Axel In Shadow Ready</span> : null}
            {message ? <span className={message.includes("Unable") || message.includes("Enter ") ? styles.error : styles.saved}>{message}</span> : null}
          </td>
        </tr>
        {status === "checkout_queued" && observationVisible ? <tr className={styles.observationRow}><td colSpan={7}><div className={styles.observationPanel}>
          <div><label>Actual vehicle # in MPWR<input value={observation.mpwrCar} onChange={(e) => updateObservation(key, "mpwrCar", e.target.value)} /></label></div>
          <div><label>Driver field<select value={observation.driver} onChange={(e) => updateObservation(key, "driver", e.target.value)}><option value="expected">Expected name</option><option value="different">Different name</option><option value="missing">Missing</option></select></label></div>
          <label className={styles.driverNamesCheck}><input type="checkbox" checked={observation.unexpectedNames} onChange={(e) => updateObservation(key, "unexpectedNames", e.target.checked)} /><span>Observed names not linked to this reservation in check-out driver dropdown.</span></label>
          <div className={styles.notesField}><label>Anything odd?<input value={observation.notes} onChange={(e) => updateObservation(key, "notes", e.target.value)} placeholder="Optional note" /></label></div>
          <button type="button" onClick={() => saveObservation(row)} disabled={busy}>{busy ? "Saving…" : "Save MPWR Result"}</button>
        </div></td></tr> : null}
      </Fragment>;
    })}</tbody>
  </table></div>;
}
