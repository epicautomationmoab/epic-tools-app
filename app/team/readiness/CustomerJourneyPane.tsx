"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import styles from "./CustomerJourneyModal.module.css";

type JourneyKind = "call" | "text" | "email" | "document" | "reservation" | "operation";
type JourneyFilter = "all" | JourneyKind;
type JourneyReadiness = "complete" | "partial" | "missing";
type JourneyEvent = { id: string; kind: JourneyKind; at: string | null; title: string; meta: string; body?: string | null; href?: string | null; readiness?: JourneyReadiness };
type CallRailCall = { id: string; at: string; direction: string; answered: boolean | null; voicemail: boolean | null; duration_seconds: number | null; recording_url: string | null; summary: string | null; transcription: string | null; lead_explanation: string | null };
type CallRailMessage = { message_id: string; direction: string; message_body: string | null; status: string | null; sent_at: string | null; first_received_at: string; agent_name: string | null };

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
function docsSummary(row: ReadinessRow) { return `${row.epic_document_received_count ?? 0}/${row.epic_document_expected_count ?? row.expected_guest_count ?? 0}`; }
function mpwrSummary(row: ReadinessRow) { if (row.requires_mpwr === false) return "Not required"; return `${row.mpwr_document_received_count ?? 0}/${row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0}`; }
function handoffLabel(value: ReadinessRow["handoff_status"]) { if (!value) return "Not started"; if (value === "checked_in") return "Checked In"; if (value === "rental_out") return "Rental Out"; if (value === "rental_returned") return "Rental Returned"; if (value === "tour_returned") return "Tour Returned"; return String(value).replaceAll("_", " "); }
function durationLabel(seconds: number | null) { if (!seconds) return ""; const m = Math.floor(seconds / 60); const s = seconds % 60; return m ? `${m}m ${s}s` : `${s}s`; }
function callTitle(call: CallRailCall) { if (call.voicemail) return "Voicemail"; if (call.answered === false) return "Missed Call"; return call.direction === "outbound" ? "Outbound Call" : "Answered Call"; }
function readinessStatus(received: number, expected: number): JourneyReadiness {
  if (expected <= 0 || received >= expected) return "complete";
  if (received > 0) return "partial";
  return "missing";
}

function readinessEvents(row: ReadinessRow): JourneyEvent[] {
  const events: JourneyEvent[] = [];
  if (row.courtesy_call_completed) events.push({ id: "courtesy", kind: "operation", at: row.courtesy_call_completed_at || null, title: "Courtesy call completed", meta: [row.courtesy_call_completed_by ? `by ${row.courtesy_call_completed_by}` : null, row.courtesy_call_outcome || null].filter(Boolean).join(" · ") });

  const epicReceived = row.epic_document_received_count ?? 0;
  const epicExpected = row.epic_document_expected_count ?? row.expected_guest_count ?? 0;
  if (epicExpected > 0 || epicReceived > 0) {
    const status = readinessStatus(epicReceived, epicExpected);
    events.push({
      id: "epic-docs",
      kind: "document",
      readiness: status,
      at: null,
      title: `Epic Docs ${status === "complete" ? "ready" : status === "partial" ? "incomplete" : "missing"} (${docsSummary(row)})`,
      meta: status === "complete" ? "Current state · Ready" : status === "partial" ? "Current state · More signatures needed" : "Current state · Documents needed",
    });
  }

  if (row.requires_mpwr !== false) {
    const mpwrReceived = row.mpwr_document_received_count ?? 0;
    const mpwrExpected = row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0;
    if (mpwrExpected > 0 || mpwrReceived > 0) {
      const status = readinessStatus(mpwrReceived, mpwrExpected);
      events.push({
        id: "mpwr-docs",
        kind: "document",
        readiness: status,
        at: null,
        title: `MPWR waivers ${status === "complete" ? "ready" : status === "partial" ? "incomplete" : "missing"} (${mpwrSummary(row)})`,
        meta: status === "complete" ? "Current state · Ready" : status === "partial" ? "Current state · More waivers needed" : "Current state · Waivers needed",
      });
    }
  }

  if (row.handoff_status) events.push({ id: "handoff", kind: "operation", at: null, title: handoffLabel(row.handoff_status), meta: "Current operational handoff status" });
  events.push({ id: "reservation", kind: "reservation", at: row.visit_start_time, title: row.product_display_name, meta: `${row.confirmation_code} · ${row.business_line}${row.rental_duration ? ` · ${row.rental_duration}` : ""}` });
  return events;
}

export default function CustomerJourneyPane({ row }: { row: ReadinessRow }) {
  const [filter, setFilter] = useState<JourneyFilter>("all");
  const [calls, setCalls] = useState<CallRailCall[]>([]);
  const [messages, setMessages] = useState<CallRailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(row.confirmation_code)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load communication activity.");
        if (!cancelled) { setCalls(payload.calls || []); setMessages(payload.messages || []); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load communication activity.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [row.confirmation_code]);

  const events = useMemo(() => {
    const callEvents: JourneyEvent[] = calls.map((call) => ({ id: `call-${call.id}`, kind: "call", at: call.at, title: callTitle(call), meta: [call.direction, durationLabel(call.duration_seconds)].filter(Boolean).join(" · "), body: call.summary || call.lead_explanation || call.transcription, href: call.recording_url }));
    const textEvents: JourneyEvent[] = messages.map((message) => ({ id: `text-${message.message_id}`, kind: "text", at: message.sent_at || message.first_received_at, title: message.direction === "outbound" ? "Text sent" : "Text received", meta: [message.direction, message.agent_name ? `by ${message.agent_name}` : null, message.status || null].filter(Boolean).join(" · "), body: message.message_body || "(No message body)" }));
    return [...readinessEvents(row), ...callEvents, ...textEvents].sort((a, b) => {
      if (!a.at && !b.at) return 0; if (!a.at) return 1; if (!b.at) return -1;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });
  }, [row, calls, messages]);

  const visible = filter === "all" ? events : events.filter((event) => event.kind === filter);
  const filters: Array<[JourneyFilter, string]> = [["all","All"],["call","Calls"],["text","Texts"],["email","Emails"],["document","Documents"],["reservation","Reservation"],["operation","Operations"]];

  return (
    <section className={styles.journey} style={{ height: "100%", background: "#fff" }} aria-label="Customer journey">
      <div className={styles.journeyHeader}>
        <div className={styles.eyebrow}>Customer Journey</div>
        <h2 className={styles.title} style={{ fontSize: 24 }}>{row.customer_name}</h2>
        <p className={styles.subtitle}>{formatDateTime(row.visit_start_time)} · {row.product_display_name}</p>
        <div className={styles.filters} aria-label="Journey filters">
          {filters.map(([value,label]) => <button type="button" className={`${styles.filter} ${filter === value ? styles.filterActive : ""}`} key={value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>
      {loading ? <div className={styles.placeholder}>Loading communication history…</div> : null}
      {error ? <div className={styles.timelineError}>{error}</div> : null}
      <div className={styles.timeline}>
        {visible.map((event) => <article className={`${styles.event} ${styles[`event_${event.kind}`] || ""} ${event.readiness ? styles[`event_readiness_${event.readiness}`] || "" : ""}`} key={event.id}>
          <div className={styles.eventTop}><div className={styles.eventTitle}>{event.title}</div><span className={`${styles.eventKind} ${styles[`kind_${event.kind}`] || ""} ${event.readiness ? styles[`kind_readiness_${event.readiness}`] || "" : ""}`}>{event.readiness ? event.readiness : event.kind}</span></div>
          <div className={styles.eventMeta}>{event.at ? formatDateTime(event.at) : "Current state"}{event.meta ? ` · ${event.meta}` : ""}</div>
          {event.body ? <div className={styles.eventBody}>{event.body}</div> : null}
          {event.href ? <a className={styles.eventLink} href={event.href} target="_blank" rel="noreferrer">Listen to recording ↗</a> : null}
        </article>)}
      </div>
      {!visible.length && !loading ? <div className={styles.placeholder}>No {filter === "all" ? "journey" : filter} activity is linked yet.</div> : null}
      {filter === "email" ? <div className={styles.placeholder}>Email history will plug into this same timeline later.</div> : null}
    </section>
  );
}