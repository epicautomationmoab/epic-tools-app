"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import styles from "./CustomerJourneyModal.module.css";

type JourneyKind = "call" | "text" | "email" | "document" | "reservation" | "operation";
type JourneyFilter = "all" | JourneyKind;
type JourneyEvent = { id: string; kind: JourneyKind; at: string | null; title: string; meta: string; body?: string | null; href?: string | null };
type CallRailCall = { id: string; at: string; direction: string; answered: boolean | null; voicemail: boolean | null; duration_seconds: number | null; recording_url: string | null; summary: string | null; transcription: string | null; lead_explanation: string | null };
type CallRailMessage = { message_id: string; direction: string; message_body: string | null; status: string | null; sent_at: string | null; first_received_at: string; agent_name: string | null; source_number: string | null; destination_number: string | null };

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
function docsSummary(row: ReadinessRow) { return `${row.epic_document_received_count ?? 0}/${row.epic_document_expected_count ?? row.expected_guest_count ?? 0}`; }
function mpwrSummary(row: ReadinessRow) { if (row.requires_mpwr === false) return "Not required"; return `${row.mpwr_document_received_count ?? 0}/${row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0}`; }
function balanceSummary(row: ReadinessRow) { const cents = row.amount_due_cents ?? 0; if (row.is_paid || cents <= 0) return "$0 due"; return `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)} due`; }
function assureSummary(row: ReadinessRow) { if (row.business_line === "tour") return "Tour"; if (row.premier_adventure_assure) return "Premier"; return row.adventure_assure_level || "Standard"; }
function ohvSummary(row: ReadinessRow) { if (row.business_line !== "rental" || row.ohv_required === false) return "N/A"; return row.ohv_certificate_uploaded ? "Ready" : "Missing"; }
function handoffLabel(value: ReadinessRow["handoff_status"]) { if (!value) return "Not started"; if (value === "checked_in") return "Checked In"; if (value === "rental_out") return "Rental Out"; if (value === "rental_returned") return "Rental Returned"; if (value === "tour_returned") return "Tour Returned"; return String(value).replaceAll("_", " "); }
function durationLabel(seconds: number | null) { if (!seconds) return ""; const m = Math.floor(seconds / 60); const s = seconds % 60; return m ? `${m}m ${s}s` : `${s}s`; }
function callTitle(call: CallRailCall) { if (call.voicemail) return "Voicemail"; if (call.answered === false) return "Missed Call"; return call.direction === "outbound" ? "Outbound Call" : "Answered Call"; }
function messageTitle(message: CallRailMessage) { return message.direction === "outbound" ? "Text sent" : "Text received"; }

function readinessEvents(row: ReadinessRow): JourneyEvent[] {
  const events: JourneyEvent[] = [];
  if (row.courtesy_call_completed) events.push({ id: "courtesy", kind: "operation", at: row.courtesy_call_completed_at || null, title: "Courtesy call completed", meta: [row.courtesy_call_completed_by ? `by ${row.courtesy_call_completed_by}` : null, row.courtesy_call_outcome || null].filter(Boolean).join(" · ") });
  if ((row.epic_document_received_count ?? 0) > 0) events.push({ id: "epic-docs", kind: "document", at: null, title: `Epic Docs received (${docsSummary(row)})`, meta: "Current document readiness" });
  if ((row.mpwr_document_received_count ?? 0) > 0) events.push({ id: "mpwr-docs", kind: "document", at: null, title: `MPWR waivers received (${mpwrSummary(row)})`, meta: "Current waiver readiness" });
  if (row.handoff_status) events.push({ id: "handoff", kind: "operation", at: null, title: handoffLabel(row.handoff_status), meta: "Current operational handoff status" });
  events.push({ id: "reservation", kind: "reservation", at: row.visit_start_time, title: row.product_display_name, meta: `${row.confirmation_code} · ${row.business_line}${row.rental_duration ? ` · ${row.rental_duration}` : ""}` });
  return events;
}

function DetailCard({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "warn" | "bad" }) {
  return <div className={`${styles.card} ${tone ? styles[`tone_${tone}`] : ""}`}><span className={styles.label}>{label}</span><strong className={styles.value}>{value}</strong></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className={styles.detailSection}><h4>{title}</h4>{children}</section>; }

export default function CustomerJourneyModal({ row, onClose }: { row: ReadinessRow; onClose: () => void }) {
  const [filter, setFilter] = useState<JourneyFilter>("all");
  const [calls, setCalls] = useState<CallRailCall[]>([]);
  const [messages, setMessages] = useState<CallRailMessage[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setActivityLoading(true); setActivityError("");
      try {
        const response = await fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(row.confirmation_code)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load communication activity.");
        if (!cancelled) {
          setCalls(payload.calls || []);
          setMessages(payload.messages || []);
        }
      } catch (error) {
        if (!cancelled) setActivityError(error instanceof Error ? error.message : "Unable to load communication activity.");
      } finally { if (!cancelled) setActivityLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [row.confirmation_code]);

  const events = useMemo(() => {
    const callEvents: JourneyEvent[] = calls.map((call) => ({ id: `call-${call.id}`, kind: "call", at: call.at, title: callTitle(call), meta: [call.direction, durationLabel(call.duration_seconds)].filter(Boolean).join(" · "), body: call.summary || call.lead_explanation || call.transcription, href: call.recording_url }));
    const textEvents: JourneyEvent[] = messages.map((message) => ({
      id: `text-${message.message_id}`,
      kind: "text",
      at: message.sent_at || message.first_received_at,
      title: messageTitle(message),
      meta: [message.direction, message.agent_name ? `by ${message.agent_name}` : null, message.status || null].filter(Boolean).join(" · "),
      body: message.message_body || "(No message body)",
    }));
    return [...readinessEvents(row), ...callEvents, ...textEvents].sort((a, b) => {
      if (!a.at && !b.at) return 0; if (!a.at) return 1; if (!b.at) return -1;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });
  }, [row, calls, messages]);

  const visibleEvents = filter === "all" ? events : events.filter((event) => event.kind === filter);
  const epicDocsComplete = (row.epic_document_received_count ?? 0) >= (row.epic_document_expected_count ?? row.expected_guest_count ?? 0);
  const mpwrExpected = row.requires_mpwr === false ? 0 : (row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0);
  const mpwrComplete = mpwrExpected === 0 || (row.mpwr_document_received_count ?? 0) >= mpwrExpected;
  const balanceDue = (row.amount_due_cents ?? 0) > 0 && !row.is_paid;

  const filterOptions: Array<[JourneyFilter, string]> = [["all","All"],["call","Calls"],["text","Texts"],["email","Emails"],["document","Documents"],["reservation","Reservation"],["operation","Operations"]];

  return <div className={styles.backdrop} onMouseDown={onClose}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`Customer journey for ${row.customer_name}`} onMouseDown={(event) => event.stopPropagation()}>
      <header className={styles.header}>
        <div><div className={styles.eyebrow}>Guest Record</div><h2 className={styles.title}>{row.customer_name}</h2><p className={styles.subtitle}>{formatDateTime(row.visit_start_time)} · {row.product_display_name} · {row.business_line}</p></div>
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
          {row.attention_flags?.length ? <div className={styles.alertBox}><strong>Needs attention</strong><div>{row.attention_flags.join(" · ")}</div></div> : null}

          <Section title="Guest & Reservation"><div className={styles.cardGrid}>
            <DetailCard label="Phone" value={row.customer_phone || "Not available"}/><DetailCard label="Email" value={row.customer_email || "Not available"}/><DetailCard label="TripWorks" value={row.confirmation_code}/><DetailCard label="MPWR" value={row.mpwr_confirmation_number || "N/A"}/><DetailCard label="People" value={row.expected_guest_count ?? "Unknown"}/><DetailCard label="Vehicles" value={row.total_vehicle_count ?? 0}/><DetailCard label="Duration" value={row.rental_duration || "N/A"}/><DetailCard label="Status" value={handoffLabel(row.handoff_status)}/>
          </div>{row.vehicle_breakdown?.length ? <div className={styles.inlineList}>{row.vehicle_breakdown.map((vehicle) => <span key={`${vehicle.model}-${vehicle.quantity}`}>{vehicle.quantity} × {vehicle.model}</span>)}</div> : null}</Section>

          <Section title="Money & Protection"><div className={styles.cardGrid}><DetailCard label="Balance" value={balanceSummary(row)} tone={balanceDue ? "bad" : "good"}/><DetailCard label="Adventure Assure" value={assureSummary(row)}/><DetailCard label="OHV" value={ohvSummary(row)} tone={ohvSummary(row) === "Missing" ? "warn" : undefined}/><DetailCard label="Operational Status" value={handoffLabel(row.handoff_status)}/></div></Section>

          <Section title="Epic Documents"><div className={styles.summaryRow}><span className={epicDocsComplete ? styles.summaryGood : styles.summaryWarn}>{docsSummary(row)}</span><span>{epicDocsComplete ? "Complete" : "Still needed"}</span></div>{row.epic_document_signers?.length ? <div className={styles.personList}>{row.epic_document_signers.map((signer,index)=><div className={styles.personRow} key={`${signer.name}-${index}`}><div><strong>{signer.name}</strong><span>{signer.is_minor_or_child ? "Minor / child" : signer.is_waiver_adult ? "Adult waiver" : "Signed"}</span></div>{signer.document_url ? <a href={signer.document_url} target="_blank" rel="noreferrer">View</a> : null}</div>)}</div> : <div className={styles.emptyMini}>No signer detail available yet.</div>}</Section>

          <Section title="MPWR Waivers"><div className={styles.summaryRow}><span className={mpwrComplete ? styles.summaryGood : styles.summaryWarn}>{mpwrSummary(row)}</span><span>{mpwrComplete ? "Complete" : "Still needed"}</span></div>{row.mpwr_waivers?.length ? <div className={styles.personList}>{row.mpwr_waivers.map((waiver,index)=><div className={styles.personRow} key={`${waiver.name}-${index}`}><div><strong>{waiver.name}</strong><span>{waiver.is_minor ? "Minor" : waiver.is_passenger ? "Passenger" : "Participant"}{waiver.email ? ` · ${waiver.email}` : ""}</span></div>{waiver.document_url ? <a href={waiver.document_url} target="_blank" rel="noreferrer">View</a> : null}</div>)}</div> : <div className={styles.emptyMini}>No waiver detail available yet.</div>}</Section>

          <Section title="Courtesy Call"><div className={styles.cardGrid}><DetailCard label="Status" value={row.courtesy_call_completed ? "Complete" : "Not complete"} tone={row.courtesy_call_completed ? "good" : "warn"}/><DetailCard label="Completed By" value={row.courtesy_call_completed_by || "—"}/><DetailCard label="Outcome" value={row.courtesy_call_outcome || "—"}/><DetailCard label="Completed At" value={row.courtesy_call_completed_at ? formatDateTime(row.courtesy_call_completed_at) : "—"}/></div></Section>
          <Section title="Notes"><div className={styles.notesBox}>{row.notes || "No notes yet"}</div></Section>
        </aside>

        <main className={styles.journey}>
          <div className={styles.journeyHeader}><h3 className={styles.sectionTitle}>Customer Journey</h3><div className={styles.filters} aria-label="Journey filters">{filterOptions.map(([value,label]) => <button type="button" className={`${styles.filter} ${filter === value ? styles.filterActive : ""}`} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
          {activityLoading ? <div className={styles.placeholder}>Loading communication history…</div> : null}
          {activityError ? <div className={styles.timelineError}>{activityError}</div> : null}
          <div className={styles.timeline}>{visibleEvents.map((event) => <article className={`${styles.event} ${styles[`event_${event.kind}`] || ""}`} key={event.id}><div className={styles.eventTop}><div className={styles.eventTitle}>{event.title}</div><span className={`${styles.eventKind} ${styles[`kind_${event.kind}`] || ""}`}>{event.kind}</span></div><div className={styles.eventMeta}>{event.at ? formatDateTime(event.at) : "Current state"}{event.meta ? ` · ${event.meta}` : ""}</div>{event.body ? <div className={styles.eventBody}>{event.body}</div> : null}{event.href ? <a className={styles.eventLink} href={event.href} target="_blank" rel="noreferrer">Listen to recording ↗</a> : null}</article>)}</div>
          {!visibleEvents.length && !activityLoading ? <div className={styles.placeholder}>No {filter === "all" ? "journey" : filter} activity is linked yet.</div> : null}
          {filter === "email" ? <div className={styles.placeholder}>Email history will plug into this same timeline later.</div> : null}
        </main>
      </div>
    </section>
  </div>;
}
