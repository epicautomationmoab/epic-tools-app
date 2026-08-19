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
};

type Draft = {
  car: string;
  mileage: string;
  hours: string;
};

function formatTime(value: string) {
  const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

function isLockedStatus(status: string) {
  return ["checkout_queued", "checking_out", "out"].includes(status);
}

function actionLabel(status: string, submitting: boolean) {
  if (submitting) return "Queueing…";
  if (status === "checkout_queued") return "Checkout Queued";
  if (status === "checking_out") return "Checking Out…";
  if (status === "out") return "Check In Vehicle";
  return "Check Out Vehicle";
}

export default function TourDispatchTable({ rows }: { rows: TourDispatchRow[] }) {
  const initialDrafts = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const row of rows) {
      map[`${row.store_visit_id}:${row.vehicle_slot}`] = {
        car: row.vehicle_label ?? "",
        mileage: row.checkout_mileage == null ? "" : String(row.checkout_mileage),
        hours: row.checkout_engine_hours == null ? "" : String(row.checkout_engine_hours),
      };
    }
    return map;
  }, [rows]);

  const initialStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of rows) map[`${row.store_visit_id}:${row.vehicle_slot}`] = row.checkout_status;
    return map;
  }, [rows]);

  const [drafts, setDrafts] = useState(initialDrafts);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  function update(key: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
    setMessages((current) => ({ ...current, [key]: "" }));
  }

  async function queueCheckout(row: TourDispatchRow) {
    const key = `${row.store_visit_id}:${row.vehicle_slot}`;
    const draft = drafts[key];
    const status = statuses[key] ?? row.checkout_status;

    if (status === "out") {
      setMessages((current) => ({ ...current, [key]: "Check-in automation is not enabled yet." }));
      return;
    }
    if (isLockedStatus(status)) return;

    if (!draft?.car.trim() || !draft.mileage.trim() || !draft.hours.trim()) {
      setMessages((current) => ({ ...current, [key]: "Enter car #, mileage, and hours." }));
      return;
    }

    setSubmittingKey(key);
    setMessages((current) => ({ ...current, [key]: "" }));
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
      if (!response.ok) throw new Error(payload?.error || "Unable to queue vehicle checkout.");
      const nextStatus = payload?.checkout_status || "checkout_queued";
      setStatuses((current) => ({ ...current, [key]: nextStatus }));
      setMessages((current) => ({ ...current, [key]: "Checkout queued" }));
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : "Unable to queue vehicle checkout.",
      }));
    } finally {
      setSubmittingKey(null);
    }
  }

  if (!rows.length) {
    return <div className={styles.empty}>No MPWR tour vehicles are scheduled for today.</div>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Activity</th>
            <th>Time</th>
            <th>Car #</th>
            <th>Mileage</th>
            <th>Hours</th>
            <th aria-label="Vehicle action" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = `${row.store_visit_id}:${row.vehicle_slot}`;
            const draft = drafts[key] ?? { car: "", mileage: "", hours: "" };
            const multiVehicle = row.total_vehicle_count > 1;
            const message = messages[key];
            const status = statuses[key] ?? row.checkout_status;
            const locked = isLockedStatus(status);
            const submitting = submittingKey === key;
            const isOut = status === "out";

            return (
              <tr key={key}>
                <td>
                  <strong>{row.customer_name}</strong>
                  {multiVehicle ? <span className={styles.slot}>Vehicle {row.vehicle_slot} of {row.total_vehicle_count}</span> : null}
                </td>
                <td>{row.product_display_name}</td>
                <td className={styles.time}>{formatTime(row.visit_start_time)}</td>
                <td><input value={draft.car} onChange={(event) => update(key, "car", event.target.value)} inputMode="text" disabled={locked} aria-label={`Car number for ${row.customer_name}`} /></td>
                <td><input value={draft.mileage} onChange={(event) => update(key, "mileage", event.target.value)} inputMode="decimal" disabled={locked} aria-label={`Mileage for ${row.customer_name}`} /></td>
                <td><input value={draft.hours} onChange={(event) => update(key, "hours", event.target.value)} inputMode="decimal" disabled={locked} aria-label={`Hours for ${row.customer_name}`} /></td>
                <td className={styles.saveCell}>
                  <button
                    type="button"
                    onClick={() => queueCheckout(row)}
                    disabled={submitting || (locked && !isOut)}
                  >
                    {actionLabel(status, submitting)}
                  </button>
                  {message ? <span className={message === "Checkout queued" ? styles.saved : styles.error}>{message}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
