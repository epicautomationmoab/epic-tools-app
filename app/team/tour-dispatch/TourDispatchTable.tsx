"use client";

import { useMemo, useState } from "react";
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
};

type Draft = { car: string; mileage: string; hours: string };

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
    car: row.vehicle_label ?? "",
    mileage: row.checkout_mileage == null ? "" : String(row.checkout_mileage),
    hours: row.checkout_engine_hours == null ? "" : String(row.checkout_engine_hours),
  }])), [rows]);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts);
  const [statuses, setStatuses] = useState<Record<string, string>>(Object.fromEntries(rows.map((row) => [keyFor(row), row.checkout_status])));
  const [checkinStatuses, setCheckinStatuses] = useState<Record<string, string>>(Object.fromEntries(rows.map((row) => [keyFor(row), row.checkin_status])));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  function updateDraft(key: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
    setMessages((current) => ({ ...current, [key]: "" }));
  }

  async function queueCheckout(row: TourDispatchRow) {
    const key = keyFor(row);
    const draft = drafts[key];
    if (!draft?.car.trim() || !draft.mileage.trim() || !draft.hours.trim()) {
      setMessages((current) => ({ ...current, [key]: "Enter car #, mileage, and hours." }));
      return;
    }

    setBusyKey(key);
    try {
      const response = await fetch("/api/team/tour-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_visit_id: row.store_visit_id,
          vehicle_slot: row.vehicle_slot,
          vehicle_label: draft.car.trim(),
          checkout_mileage: Number(draft.mileage),
          checkout_engine_hours: Number(draft.hours),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to prepare checkout.");
      setStatuses((current) => ({ ...current, [key]: payload?.checkout_status || "checkout_queued" }));
      setCheckinStatuses((current) => ({ ...current, [key]: payload?.checkin_status || "prepared" }));
      setMessages((current) => ({ ...current, [key]: "Miles prepared Axel Out." }));
    } catch (error) {
      setMessages((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to prepare checkout." }));
    } finally {
      setBusyKey(null);
    }
  }

  async function releaseCheckin(row: TourDispatchRow) {
    const key = keyFor(row);
    setBusyKey(key);
    try {
      const response = await fetch("/api/team/tour-dispatch/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_visit_id: row.store_visit_id, vehicle_slot: row.vehicle_slot }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to record vehicle return.");
      setCheckinStatuses((current) => ({ ...current, [key]: "checkin_queued" }));
      const axelNote = payload?.axel_ready ? " Axel In package released." : " Axel In is pending.";
      const tourNote = payload?.tour_returned ? " Tour is returned." : "";
      setMessages((current) => ({ ...current, [key]: `Vehicle return recorded.${axelNote}${tourNote}` }));
    } catch (error) {
      setMessages((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to record vehicle return." }));
    } finally {
      setBusyKey(null);
    }
  }

  if (!rows.length) return <div className={styles.empty}>No MPWR tour vehicles are scheduled for today.</div>;

  return <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr><th>Name</th><th>Activity</th><th>Time</th><th>Car #</th><th>Mileage</th><th>Hours</th><th aria-label="Vehicle action" /></tr></thead>
    <tbody>{rows.map((row) => {
      const key = keyFor(row);
      const draft = drafts[key] ?? { car: "", mileage: "", hours: "" };
      const status = statuses[key] ?? row.checkout_status;
      const checkinStatus = checkinStatuses[key] ?? row.checkin_status;
      const locked = departureLocked(status);
      const busy = busyKey === key;
      const message = messages[key];

      return <tr key={key}>
        <td><strong>{row.customer_name}</strong>{row.total_vehicle_count > 1 ? <span className={styles.slot}>Vehicle {row.vehicle_slot} of {row.total_vehicle_count}</span> : null}</td>
        <td>{row.product_display_name}</td>
        <td className={styles.time}>{formatTime(row.visit_start_time)}</td>
        <td><input value={draft.car} onChange={(e) => updateDraft(key, "car", e.target.value)} disabled={locked} /></td>
        <td><input value={draft.mileage} onChange={(e) => updateDraft(key, "mileage", e.target.value)} inputMode="decimal" disabled={locked} /></td>
        <td><input value={draft.hours} onChange={(e) => updateDraft(key, "hours", e.target.value)} inputMode="decimal" disabled={locked} /></td>
        <td className={styles.saveCell}>
          {!locked ? <button type="button" onClick={() => queueCheckout(row)} disabled={busy}>{busy ? "Preparing…" : "Check Out Vehicle"}</button> : null}
          {status === "checkout_queued" ? <span className={styles.axelPill}>Axel Checkout Prepared</span> : null}
          {status === "checking_out" ? <span className={styles.axelPill}>Axel Working…</span> : null}
          {status === "out" && checkinStatus !== "checkin_queued" ? <button type="button" className={styles.checkinButton} onClick={() => releaseCheckin(row)} disabled={busy}>{busy ? "Recording…" : "Check In Vehicle"}</button> : null}
          {checkinStatus === "checkin_queued" ? <span className={styles.statusPill}>Vehicle Returned</span> : null}
          {message ? <span className={message.includes("Unable") || message.includes("Enter ") ? styles.error : styles.saved}>{message}</span> : null}
        </td>
      </tr>;
    })}</tbody>
  </table></div>;
}
