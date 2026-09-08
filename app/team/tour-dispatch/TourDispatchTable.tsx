"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PrintSingleVehicleTagButton } from "./NativePrintButton";
import styles from "./TourDispatch.module.css";

export type TourDispatchRow = {
  store_visit_id: string;
  readiness_id: string | null;
  confirmation_code: string;
  customer_name: string;
  product_display_name: string;
  visit_start_time: string;
  visit_date: string;
  source_experience_ids: string[] | null;
  total_vehicle_count: number;
  vehicle_slot: number;
  vehicle_label: string | null;
  checkout_mileage: number | null;
  checkout_engine_hours: number | null;
  checkout_status: string;
  checkin_status: string;
};

export type TourManifestGuide = {
  visit_date: string;
  experience_key: string;
  visit_start_time: string;
  guide_name: string;
};

type Draft = { car: string; mileage: string; hours: string };

type ManifestGroup = {
  key: string;
  visitDate: string;
  experienceKey: string;
  visitStartTime: string;
  activity: string;
  rows: TourDispatchRow[];
};

type ManifestTheme = "poison" | "hells" | "discovery" | "proR" | "default";

const EXPERIENCE_THEME: Record<string, ManifestTheme> = {
  "16190": "poison",
  "13804": "poison",
  "11126": "hells",
  "13799": "hells",
  "19043": "hells",
  "17328": "hells",
  "16417": "discovery",
  "15783": "proR",
  "18197": "proR",
};

function keyFor(row: TourDispatchRow) { return `${row.store_visit_id}:${row.vehicle_slot}`; }
function formatTime(value: string) {
  const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour24 = Number(match[1]);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour24 % 12 || 12}:${match[2]} ${suffix}`;
}
function normalizeStart(value: string) { return value.replace("T", " ").slice(0, 19); }
function experienceKey(row: TourDispatchRow) {
  const ids = (row.source_experience_ids ?? []).filter(Boolean).sort();
  return ids.length ? ids.join(",") : `name:${row.product_display_name}`;
}
function manifestKey(row: TourDispatchRow) {
  return `${row.visit_date}|${experienceKey(row)}|${normalizeStart(row.visit_start_time)}`;
}
function manifestTheme(group: ManifestGroup): ManifestTheme {
  for (const row of group.rows) {
    for (const id of row.source_experience_ids ?? []) {
      if (EXPERIENCE_THEME[id]) return EXPERIENCE_THEME[id];
    }
  }
  return "default";
}
function manifestThemeClass(theme: ManifestTheme) {
  if (theme === "poison") return styles.themePoison;
  if (theme === "hells") return styles.themeHells;
  if (theme === "discovery") return styles.themeDiscovery;
  if (theme === "proR") return styles.themeProR;
  return styles.themeDefault;
}
function departureLocked(status: string) { return ["checkout_queued", "checking_out", "out"].includes(status); }
function returnInProgress(status: string) { return ["checkin_queued", "checking_in"].includes(status); }
function returnComplete(status: string) { return ["returned", "completed", "checked_in"].includes(status); }

function GuideField({ group, initialValue }: { group: ManifestGroup; initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setValue(initialValue);
    setSavedValue(initialValue);
  }, [initialValue]);

  async function save() {
    const next = value.trim();
    if (next === savedValue.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/team/tour-dispatch/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visit_date: group.visitDate,
          experience_key: group.experienceKey,
          visit_start_time: normalizeStart(group.visitStartTime),
          guide_name: next,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to save guide.");
      setSavedValue(next);
      setMessage(next ? "Guide saved." : "Guide cleared.");
      window.setTimeout(() => setMessage(""), 1800);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save guide.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.guideField}>
    <label>Guide <span>(optional)</span></label>
    <input
      value={value}
      onChange={(e) => { setValue(e.target.value); setMessage(""); }}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      placeholder="Guide name"
      aria-label={`Guide for ${group.activity} at ${formatTime(group.visitStartTime)}`}
    />
    {busy ? <span className={styles.guideStatus}>Saving…</span> : message ? <span className={message.includes("Unable") ? styles.error : styles.guideStatus}>{message}</span> : null}
  </div>;
}

export default function TourDispatchTable({ rows, guides }: { rows: TourDispatchRow[]; guides: TourManifestGuide[] }) {
  const router = useRouter();
  const initialDrafts = useMemo(() => Object.fromEntries(rows.map((row) => [keyFor(row), {
    car: row.vehicle_label ?? "",
    mileage: row.checkout_mileage == null ? "" : String(row.checkout_mileage),
    hours: row.checkout_engine_hours == null ? "" : String(row.checkout_engine_hours),
  }])), [rows]);

  const grouped = useMemo<ManifestGroup[]>(() => {
    const map = new Map<string, ManifestGroup>();
    for (const row of rows) {
      const key = manifestKey(row);
      const existing = map.get(key);
      if (existing) existing.rows.push(row);
      else map.set(key, {
        key,
        visitDate: row.visit_date,
        experienceKey: experienceKey(row),
        visitStartTime: row.visit_start_time,
        activity: row.product_display_name,
        rows: [row],
      });
    }
    return Array.from(map.values())
      .map((group) => ({ ...group, rows: [...group.rows].sort((a, b) => a.customer_name.localeCompare(b.customer_name) || a.vehicle_slot - b.vehicle_slot) }))
      .sort((a, b) => {
        const time = a.visitStartTime.localeCompare(b.visitStartTime);
        if (time) return time;
        const activity = a.activity.localeCompare(b.activity);
        return activity || a.experienceKey.localeCompare(b.experienceKey);
      });
  }, [rows]);

  const guideMap = useMemo(() => new Map(guides.map((guide) => [
    `${guide.visit_date}|${guide.experience_key}|${normalizeStart(guide.visit_start_time)}`,
    guide.guide_name,
  ])), [guides]);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts);
  const [statuses, setStatuses] = useState<Record<string, string>>(Object.fromEntries(rows.map((row) => [keyFor(row), row.checkout_status])));
  const [checkinStatuses, setCheckinStatuses] = useState<Record<string, string>>(Object.fromEntries(rows.map((row) => [keyFor(row), row.checkin_status])));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  function reconcileAfterAction() {
    for (const delay of [2000, 6000, 15000, 30000]) window.setTimeout(() => router.refresh(), delay);
  }

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        const key = keyFor(row);
        next[key] = {
          car: row.vehicle_label ?? next[key]?.car ?? "",
          mileage: row.checkout_mileage == null ? next[key]?.mileage ?? "" : String(row.checkout_mileage),
          hours: row.checkout_engine_hours == null ? next[key]?.hours ?? "" : String(row.checkout_engine_hours),
        };
      }
      return next;
    });
    setStatuses((current) => ({ ...current, ...Object.fromEntries(rows.map((row) => [keyFor(row), row.checkout_status])) }));
    setCheckinStatuses((current) => ({ ...current, ...Object.fromEntries(rows.map((row) => [keyFor(row), row.checkin_status])) }));
  }, [rows]);

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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_visit_id: row.store_visit_id, vehicle_slot: row.vehicle_slot, vehicle_label: draft.car.trim(), checkout_mileage: Number(draft.mileage), checkout_engine_hours: Number(draft.hours) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to prepare checkout.");
      setStatuses((current) => ({ ...current, [key]: payload?.checkout_status || "checkout_queued" }));
      setCheckinStatuses((current) => ({ ...current, [key]: payload?.checkin_status || "prepared" }));
      setMessages((current) => ({ ...current, [key]: "Checkout prepared." }));
      reconcileAfterAction();
    } catch (error) {
      setMessages((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to prepare checkout." }));
    } finally { setBusyKey(null); }
  }

  async function releaseCheckin(row: TourDispatchRow) {
    const key = keyFor(row);
    setBusyKey(key);
    try {
      const response = await fetch("/api/team/tour-dispatch/checkin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_visit_id: row.store_visit_id, vehicle_slot: row.vehicle_slot }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to record vehicle return.");
      setCheckinStatuses((current) => ({ ...current, [key]: "checkin_queued" }));
      const checkinNote = payload?.axel_ready ? " Check-in package released." : " Check-in is pending.";
      const tourNote = payload?.tour_returned ? " Tour is returned." : "";
      setMessages((current) => ({ ...current, [key]: `Vehicle return recorded.${checkinNote}${tourNote}` }));
      reconcileAfterAction();
    } catch (error) {
      setMessages((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to record vehicle return." }));
    } finally { setBusyKey(null); }
  }

  async function retryCheckin(row: TourDispatchRow) {
    const key = keyFor(row);
    setBusyKey(key);
    try {
      const response = await fetch("/api/team/tour-dispatch/checkin/retry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_visit_id: row.store_visit_id, vehicle_slot: row.vehicle_slot }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to retry vehicle check-in.");
      setMessages((current) => ({ ...current, [key]: "Axel In retry sent." }));
      reconcileAfterAction();
    } catch (error) {
      setMessages((current) => ({ ...current, [key]: error instanceof Error ? error.message : "Unable to retry vehicle check-in." }));
    } finally { setBusyKey(null); }
  }

  if (!rows.length) return <div className={styles.empty}>No MPWR tour vehicles are scheduled for today.</div>;

  return <div className={styles.manifestList}>{grouped.map((group) => {
    const assignedGuide = guideMap.get(group.key) ?? "";
    const theme = manifestTheme(group);
    return <section className={`${styles.manifestGroup} ${manifestThemeClass(theme)}`} key={group.key}>
      <div className={styles.manifestHeader}>
        <div>
          <div className={styles.manifestEyebrow}>Tour Manifest</div>
          <div className={styles.manifestTitleRow}>
            <h2>{group.activity}</h2>
            <span className={styles.manifestTime}>{formatTime(group.visitStartTime)}</span>
          </div>
          <div className={styles.manifestMeta}>{group.rows.length} {group.rows.length === 1 ? "vehicle" : "vehicles"}</div>
        </div>
        <GuideField group={group} initialValue={assignedGuide} />
      </div>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Name</th><th>Car #</th><th>Mileage</th><th>Hours</th><th aria-label="Vehicle action" /></tr></thead>
        <tbody>{group.rows.map((row) => {
          const key = keyFor(row);
          const draft = drafts[key] ?? { car: "", mileage: "", hours: "" };
          const status = statuses[key] ?? row.checkout_status;
          const checkinStatus = checkinStatuses[key] ?? row.checkin_status;
          const locked = departureLocked(status);
          const busy = busyKey === key;
          const message = messages[key];
          return <tr key={key}>
            <td><strong>{row.customer_name}</strong>{row.total_vehicle_count > 1 ? <span className={styles.slot}>Vehicle {row.vehicle_slot} of {row.total_vehicle_count}</span> : null}<PrintSingleVehicleTagButton className={styles.inlinePrintButton} card={{ customer_name: row.customer_name, product_display_name: row.product_display_name, visit_start_time: row.visit_start_time, confirmation_code: row.confirmation_code }} /></td>
            <td><input value={draft.car} onChange={(e) => updateDraft(key, "car", e.target.value)} disabled={locked} /></td>
            <td><input value={draft.mileage} onChange={(e) => updateDraft(key, "mileage", e.target.value)} inputMode="decimal" disabled={locked} /></td>
            <td><input value={draft.hours} onChange={(e) => updateDraft(key, "hours", e.target.value)} inputMode="decimal" disabled={locked} /></td>
            <td className={styles.saveCell}>
              {!locked ? <button type="button" onClick={() => queueCheckout(row)} disabled={busy}>{busy ? "Preparing…" : "Check Out Vehicle"}</button> : null}
              {status === "checkout_queued" ? <button type="button" onClick={() => queueCheckout(row)} disabled={busy}>{busy ? "Retrying…" : "Retry Checkout"}</button> : null}
              {status === "checking_out" ? <span className={styles.axelPill}>Checkout In Progress…</span> : null}
              {status === "out" && !returnInProgress(checkinStatus) && !returnComplete(checkinStatus) ? <button type="button" className={styles.checkinButton} onClick={() => releaseCheckin(row)} disabled={busy}>{busy ? "Recording…" : "Check In Vehicle"}</button> : null}
              {returnInProgress(checkinStatus) ? <><span className={styles.axelPill}>Check-In In Progress…</span><button type="button" onClick={() => retryCheckin(row)} disabled={busy}>{busy ? "Retrying…" : "Try Again"}</button></> : null}
              {returnComplete(checkinStatus) ? <span className={styles.statusPill}>Vehicle Returned</span> : null}
              {message ? <span className={message.includes("Unable") || message.includes("Enter ") ? styles.error : styles.saved}>{message}</span> : null}
            </td>
          </tr>;
        })}</tbody>
      </table></div>
    </section>;
  })}</div>;
}
