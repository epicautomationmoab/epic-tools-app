"use client";

import { useMemo, useState } from "react";
import styles from "./MissedCalls.module.css";
import PhoneReportC360Link from "../phone-report/PhoneReportC360Link";

export type MissedCallItem = {
  id: string;
  source_record_id: string | null;
  contact_id?: string | null;
  status: string;
  subject: string | null;
  summary: string | null;
  assigned_name: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function durationLabel(value: unknown) {
  const seconds = Number(value || 0);
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function phoneHref(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "#";
  return `tel:+${digits.length === 10 ? `1${digits}` : digits}`;
}

export default function MissedCallsClient({ initialItems }: { initialItems: MissedCallItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const unclaimed = useMemo(() => items.filter((item) => !item.assigned_name).length, [items]);

  async function refresh() {
    const response = await fetch("/api/sales/missed-calls", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to refresh missed calls.");
    setItems(payload.items || []);
  }

  async function action(item: MissedCallItem, actionName: string) {
    setBusy(item.id);
    setError("");
    try {
      const response = await fetch("/api/sales/missed-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_item_id: item.id, action: actionName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update missed call.");
      if (actionName === "create_lead" && payload.opportunity_id) {
        window.location.href = `/sales/leads?open=${encodeURIComponent(payload.opportunity_id)}`;
        return;
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update missed call.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <strong>{items.length} callback{items.length === 1 ? "" : "s"}</strong>
          <span> · {unclaimed} unclaimed</span>
        </div>
        <button onClick={() => refresh().catch((err) => setError(err.message))}>Refresh</button>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.list}>
        {items.map((item) => {
          const m = item.metadata || {};
          const phone = text(m.phone);
          const caller = text(m.caller_name) || phone || "Unknown caller";
          const rawCallType = text(m.call_type) || (m.voicemail ? "voicemail" : "missed");
          const callType = rawCallType === "voicemail_transcription" ? "voicemail" : rawCallType;
          const recording = text(m.recording_url);
          const source = text(m.source_name);
          const campaign = text(m.campaign);
          const duration = durationLabel(m.duration_seconds);

          return (
            <article className={styles.card} key={item.id}>
              <div className={styles.cardMain}>
                <div className={styles.titleRow}>
                  <strong>{caller}</strong>
                  <span className={styles.badge}>{callType}</span>
                </div>
                <div className={styles.phone}>{phone || "No caller number"}</div>
                <div className={styles.summary}>{item.summary || "Unanswered inbound call"}</div>
                <div className={styles.meta}>
                  <span>{formatTime(item.created_at)}</span>
                  {duration ? <span>{duration}</span> : null}
                  {source ? <span>{source}</span> : null}
                  {campaign ? <span>{campaign}</span> : null}
                  {recording ? <a href={recording} target="_blank" rel="noreferrer">Listen ↗</a> : null}
                  <PhoneReportC360Link contactId={item.contact_id || null} reservationId={text(m.reservation_id) || null} reservationConfirmation={text(m.confirmation_code) || null} phone={phone || null} />
                </div>
              </div>

              <div className={styles.actions}>
                <div className={styles.owner}>{item.assigned_name || "Unclaimed"}</div>
                {!item.assigned_name ? (
                  <button className={styles.darkButton} disabled={busy === item.id} onClick={() => action(item, "claim")}>Claim</button>
                ) : (
                  <button disabled={busy === item.id} onClick={() => action(item, "release")}>Release</button>
                )}
                <a className={styles.callButton} href={phoneHref(phone)}>Call Back</a>
                <button className={styles.primaryButton} disabled={busy === item.id} onClick={() => action(item, "create_lead")}>Create Lead</button>
                <button disabled={busy === item.id} onClick={() => action(item, "other")}>Other / Internal</button>
                <button disabled={busy === item.id} onClick={() => action(item, "junk")}>Junk</button>
              </div>
            </article>
          );
        })}

        {!items.length ? <div className={styles.empty}>No missed calls or voicemails are waiting for callback.</div> : null}
      </div>
    </>
  );
}
