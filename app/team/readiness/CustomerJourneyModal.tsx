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

function handoffLabel(value: ReadinessRow["handoff_status"]) {
  if (!value) return "Not started";
  if (value === "checked_in") return "Checked In";
  if (value === "rental_out") return "Rental Out";
  if (value === "rental_returned") return "Rental Returned";
  if (value === "tour_returned") return "Tour Returned";
  return String(value).replaceAll("_", " ");
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
    events.push({ title: `Epic Docs received (${docsSummary(row)})`, meta: "Document activity from readiness" });
  }

  if ((row.mpwr_document_received_count ?? 0) > 0) {
    events.push({ title: `MPWR waivers received (${mpwrSummary(row)})`, meta: "Waiver activity from readiness" });
  }

  if (row.handoff_status) {
    events.push({ title: handoffLabel(row.handoff_status), meta: "Operational handoff status" });
  }

  return events;
}

function DetailCard({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={`${styles.card} ${tone ? styles[`tone_${tone}`] : ""}`}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.value}>{value}</strong>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.detailSection}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}

export default function CustomerJourneyModal({ row, onClose }: { row: ReadinessRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events = timelineEvents(row);
  const epicDocsComplete = (row.epic_document_received_count ?? 0) >= (row.epic_document_expected_count ?? row.expected_guest_count ?? 0);
  const mpwrExpected = row.requires_mpwr === false ? 0 : (row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0);
  const mpwrComplete = mpwrExpected === 0 || (row.mpwr_document_received_count ?? 0) >= mpwrExpected;
  const balanceDue = (row.amount_due_cents ?? 0) > 0 && !row.is_paid;

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`Customer journey for ${row.customer_name}`} onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Guest Record</div>
            <h2 className={styles.title}>{row.customer_name}</h2>
            <p className={styles.subtitle}>{formatDateTime(row.visit_start_time)} · {row.product_display_name} · {row.business_line}</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.action} type="button" disabled>Text Guest</button>
            {row.tripworks_booking_url ? <a className={styles.action} href={row.tripworks_booking_url} target="_blank" rel="noreferrer">TripWorks</a> : null}
            {row.mpwr_reservation_url ? <a className={styles.action} href={row.mpwr_reservation_url} target="_blank" rel="noreferrer">MPWR</a> : null}
            <button className={styles.close} type="button" aria-label="Close" onClick={onClose}>×</button>
          </div>
        </header>

        <div className={styles.body}>
          <aside className={styles.operations}>
            <h3 className={styles.sectionTitle}>Operational Readiness</h3>

            {row.attention_flags?.length ? (
              <div className={styles.alertBox}>
                <strong>Needs attention</strong>
                <div>{row.attention_flags.join(" · ")}</div>
              </div>
            ) : null}

            <Section title="Guest & Reservation">
              <div className={styles.cardGrid}>
                <DetailCard label="Phone" value={row.customer_phone || "Not available"} />
                <DetailCard label="Email" value={row.customer_email || "Not available"} />
                <DetailCard label="TripWorks" value={row.confirmation_code} />
                <DetailCard label="MPWR" value={row.mpwr_confirmation_number || "N/A"} />
                <DetailCard label="People" value={row.expected_guest_count ?? "Unknown"} />
                <DetailCard label="Vehicles" value={row.total_vehicle_count ?? 0} />
                <DetailCard label="Duration" value={row.rental_duration || "N/A"} />
                <DetailCard label="Status" value={handoffLabel(row.handoff_status)} />
              </div>
              {row.vehicle_breakdown?.length ? (
                <div className={styles.inlineList}>
                  {row.vehicle_breakdown.map((vehicle) => <span key={`${vehicle.model}-${vehicle.quantity}`}>{vehicle.quantity} × {vehicle.model}</span>)}
                </div>
              ) : null}
            </Section>

            <Section title="Money & Protection">
              <div className={styles.cardGrid}>
                <DetailCard label="Balance" value={balanceSummary(row)} tone={balanceDue ? "bad" : "good"} />
                <DetailCard label="Adventure Assure" value={assureSummary(row)} />
                <DetailCard label="OHV" value={ohvSummary(row)} tone={ohvSummary(row) === "Missing" ? "warn" : undefined} />
                <DetailCard label="Operational Status" value={handoffLabel(row.handoff_status)} />
              </div>
            </Section>

            <Section title="Epic Documents">
              <div className={styles.summaryRow}>
                <span className={epicDocsComplete ? styles.summaryGood : styles.summaryWarn}>{docsSummary(row)}</span>
                <span>{epicDocsComplete ? "Complete" : "Still needed"}</span>
              </div>
              {row.epic_document_signers?.length ? (
                <div className={styles.personList}>
                  {row.epic_document_signers.map((signer, index) => (
                    <div className={styles.personRow} key={`${signer.name}-${index}`}>
                      <div><strong>{signer.name}</strong><span>{signer.is_minor_or_child ? "Minor / child" : signer.is_waiver_adult ? "Adult waiver" : "Signed"}</span></div>
                      {signer.document_url ? <a href={signer.document_url} target="_blank" rel="noreferrer">View</a> : null}
                    </div>
                  ))}
                </div>
              ) : <div className={styles.emptyMini}>No signer detail available yet.</div>}
              {row.epic_document_delivery_failures?.length ? (
                <div className={styles.failureList}>
                  {row.epic_document_delivery_failures.map((failure, index) => <div key={`${failure.name}-${index}`}><strong>{failure.name}</strong> · {failure.email || "no email"}{failure.error ? ` · ${failure.error}` : ""}</div>)}
                </div>
              ) : null}
            </Section>

            <Section title="MPWR Waivers">
              <div className={styles.summaryRow}>
                <span className={mpwrComplete ? styles.summaryGood : styles.summaryWarn}>{mpwrSummary(row)}</span>
                <span>{mpwrComplete ? "Complete" : "Still needed"}</span>
              </div>
              {row.mpwr_waivers?.length ? (
                <div className={styles.personList}>
                  {row.mpwr_waivers.map((waiver, index) => (
                    <div className={styles.personRow} key={`${waiver.name}-${index}`}>
                      <div><strong>{waiver.name}</strong><span>{waiver.is_minor ? "Minor" : waiver.is_passenger ? "Passenger" : "Participant"}{waiver.email ? ` · ${waiver.email}` : ""}</span></div>
                      {waiver.document_url ? <a href={waiver.document_url} target="_blank" rel="noreferrer">View</a> : null}
                    </div>
                  ))}
                </div>
              ) : <div className={styles.emptyMini}>No waiver detail available yet.</div>}
            </Section>

            <Section title="Courtesy Call">
              <div className={styles.cardGrid}>
                <DetailCard label="Status" value={row.courtesy_call_completed ? "Complete" : "Not complete"} tone={row.courtesy_call_completed ? "good" : "warn"} />
                <DetailCard label="Completed By" value={row.courtesy_call_completed_by || "—"} />
                <DetailCard label="Outcome" value={row.courtesy_call_outcome || "—"} />
                <DetailCard label="Completed At" value={row.courtesy_call_completed_at ? formatDateTime(row.courtesy_call_completed_at) : "—"} />
              </div>
            </Section>

            <Section title="Notes">
              <div className={styles.notesBox}>{row.notes || "No notes yet"}</div>
            </Section>
          </aside>

          <main className={styles.journey}>
            <div className={styles.journeyHeader}>
              <h3 className={styles.sectionTitle}>Customer Journey</h3>
              <div className={styles.filters} aria-label="Journey filters">
                {['All','Calls','Texts','Emails','Documents','Reservation','Operations'].map((label) => <span className={styles.filter} key={label}>{label}</span>)}
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
            ) : null}

            <div className={styles.placeholder}>
              Calls, texts, emails, reservation events, document timestamps, and operational history will plug into this shared timeline next. The operational side is being built first so we can make sure the guest record itself is complete before we join additional data sources.
            </div>
          </main>
        </div>
      </section>
    </div>
  );
}
