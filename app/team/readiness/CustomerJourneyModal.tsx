"use client";

import { useEffect } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import styles from "./CustomerJourneyModal.module.css";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function docsSummary(row: ReadinessRow) {
  const received = row.epic_document_received_count ?? 0;
  const expected = row.epic_document_expected_count ?? row.expected_guest_count ?? 0;
  return `${received}/${expected}`;
}

function mpwrSummary(row: ReadinessRow) {
  if (row.requires_mpwr === false) return "Not required";
  const received = row.mpwr_document_received_count ?? 0;
  const expected = row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0;
  return `${received}/${expected}`;
}

function balanceSummary(row: ReadinessRow) {
  const cents = row.amount_due_cents ?? 0;
  if (row.is_paid || cents <= 0) return "$0 due";
  return `${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)} due`;
}

function assureSummary(row: ReadinessRow) {
  if (row.business_line === "tour") return "Tour";
  if (row.premier_adventure_assure) return "Premier";
  return row.adventure_assure_level || "Standard";
}

function ohvSummary(row: ReadinessRow) {
  if (row.business_line !== "rental" || row.ohv_required === false) return "N/A";
  return row.ohv_certificate_uploaded ? "Ready" : "Missing";
}

function timelineEvents(row: ReadinessRow) {
  const events: Array<{ title: string; meta: string }> = [];

  if (row.courtesy_call_completed) {
    events.push({
      title: "Courtesy call completed",
      meta: [
        row.courtesy_call_completed_at ? formatDateTime(row.courtesy_call_completed_at) : null,
        row.courtesy_call_completed_by ? `by ${row.courtesy_call_completed_by}` : null,
        row.courtesy_call_outcome || null,
      ].filter(Boolean).join(" · "),
    });
  }

  if ((row.epic_document_received_count ?? 0) > 0) {
    events.push({
      title: `Epic Docs received (${docsSummary(row)})`,
      meta: "Document activity from readiness",
    });
  }

  if ((row.mpwr_document_received_count ?? 0) > 0) {
    events.push({
      title: `MPWR waivers received (${mpwrSummary(row)})`,
      meta: "Waiver activity from readiness",
    });
  }

  if (row.handoff_status) {
    events.push({
      title: row.handoff_status.replaceAll("_", " "),
      meta: "Operational handoff status",
    });
  }

  return events;
}

export default function CustomerJourneyModal({
  row,
  onClose,
}: {
  row: ReadinessRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events = timelineEvents(row);

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Customer journey for ${row.customer_name}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Guest Record</div>
            <h2 className={styles.title}>{row.customer_name}</h2>
            <p className={styles.subtitle}>
              {formatDateTime(row.visit_start_time)} · {row.product_display_name} · {row.business_line}
            </p>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.action} type="button" disabled>
              Text Guest
            </button>
            {row.tripworks_booking_url ? (
              <a className={styles.action} href={row.tripworks_booking_url} target="_blank" rel="noreferrer">
                TripWorks
              </a>
            ) : null}
            {row.mpwr_reservation_url ? (
              <a className={styles.action} href={row.mpwr_reservation_url} target="_blank" rel="noreferrer">
                MPWR
              </a>
            ) : null}
            <button className={styles.close} type="button" aria-label="Close" onClick={onClose}>×</button>
          </div>
        </header>

        <div className={styles.body}>
          <aside className={styles.operations}>
            <h3 className={styles.sectionTitle}>Operational Readiness</h3>
            <div className={styles.cardGrid}>
              <div className={styles.card}>
                <span className={styles.label}>Phone</span>
                <strong className={styles.value}>{row.customer_phone || "Not available"}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>Email</span>
                <strong className={styles.value}>{row.customer_email || "Not available"}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>TripWorks</span>
                <strong className={styles.value}>{row.confirmation_code}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>MPWR</span>
                <strong className={styles.value}>{row.mpwr_confirmation_number || "N/A"}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>People</span>
                <strong className={styles.value}>{row.expected_guest_count ?? "Unknown"}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>Vehicles</span>
                <strong className={styles.value}>{row.total_vehicle_count ?? 0}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>Epic Docs</span>
                <strong className={styles.value}>{docsSummary(row)}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>MPWR Waivers</span>
                <strong className={styles.value}>{mpwrSummary(row)}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>Adventure Assure</span>
                <strong className={styles.value}>{assureSummary(row)}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>Balance</span>
                <strong className={styles.value}>{balanceSummary(row)}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>OHV</span>
                <strong className={styles.value}>{ohvSummary(row)}</strong>
              </div>
              <div className={styles.card}>
                <span className={styles.label}>Courtesy Call</span>
                <strong className={styles.value}>{row.courtesy_call_completed ? "Complete" : "Not complete"}</strong>
              </div>
              <div className={`${styles.card} ${styles.cardWide}`}>
                <span className={styles.label}>Notes</span>
                <strong className={styles.value}>{row.notes || "No notes yet"}</strong>
              </div>
            </div>
          </aside>

          <main className={styles.journey}>
            <div className={styles.journeyHeader}>
              <h3 className={styles.sectionTitle}>Customer Journey</h3>
              <div className={styles.filters} aria-label="Journey filters">
                {['All','Calls','Texts','Emails','Documents','Reservation','Operations'].map((label) => (
                  <span className={styles.filter} key={label}>{label}</span>
                ))}
              </div>
            </div>

            {events.length ? (
              <div className={styles.timeline}>
                {events.map((event, index) => (
                  <div className={styles.event} key={`${event.title}-${index}`}>
                    <div className={styles.eventTitle}>{event.title}</div>
                    <div className={styles.eventMeta}>{event.meta}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.placeholder}>
                The journey panel is intentionally sparse in this first pass. Calls, texts, emails, reservation events, document timestamps, and operational history will be added here piece by piece as we connect each source.
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}
