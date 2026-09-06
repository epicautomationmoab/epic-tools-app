"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import styles from "./CustomerJourneyModal.module.css";

type JourneyKind = "call" | "text" | "email" | "document" | "reservation" | "operation";
type JourneyFilter = "all" | JourneyKind;
type JourneyReadiness = "complete" | "partial" | "missing";
type JourneyEvent = { id: string; kind: JourneyKind; at: string | null; title: string; meta: string; body?: string | null; href?: string | null; readiness?: JourneyReadiness };
type CallRailCall = { id: string; at: string; direction: string; answered: boolean | null; voicemail: boolean | null; duration_seconds: number | null; recording_url: string | null; summary: string | null; transcription: string | null; lead_explanation: string | null };
type CallRailMessage = { message_id: string; direction: string; message_body: string | null; status: string | null; sent_at: string | null; first_received_at: string; agent_name: string | null };
type MessageTemplate = { template_id: string; name: string; message_body: string; sort_order: number; active: boolean; updated_at: string; updated_by: string | null };

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" }).format(date);
}
function docsSummary(row: ReadinessRow) { return `${row.epic_document_received_count ?? 0}/${row.epic_document_expected_count ?? row.expected_guest_count ?? 0}`; }
function mpwrSummary(row: ReadinessRow) { if (row.requires_mpwr === false) return "Not required"; return `${row.mpwr_document_received_count ?? 0}/${row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0}`; }
function handoffLabel(value: ReadinessRow["handoff_status"]) { if (!value) return "Not started"; if (value === "checked_in") return "Checked In"; if (value === "rental_out") return "Rental Out"; if (value === "rental_returned") return "Rental Returned"; if (value === "tour_returned") return "Tour Returned"; return String(value).replaceAll("_", " "); }
function durationLabel(seconds: number | null) { if (!seconds) return ""; const m = Math.floor(seconds / 60); const s = seconds % 60; return m ? `${m}m ${s}s` : `${s}s`; }
function callTitle(call: CallRailCall) { if (call.voicemail) return "Voicemail"; if (call.answered === false) return "Missed Call"; return call.direction === "outbound" ? "Outbound Call" : "Answered Call"; }
function readinessStatus(received: number, expected: number): JourneyReadiness { if (expected <= 0 || received >= expected) return "complete"; if (received > 0) return "partial"; return "missing"; }

function applyTemplate(template: string, row: ReadinessRow) {
  const firstName = row.customer_name.trim().split(/\s+/)[0] || "Guest";
  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{guest_name}}", row.customer_name)
    .replaceAll("{{activity}}", row.product_display_name)
    .replaceAll("{{time}}", formatTime(row.visit_start_time))
    .replaceAll("{{confirmation}}", row.confirmation_code);
}

function readinessEvents(row: ReadinessRow): JourneyEvent[] {
  const events: JourneyEvent[] = [];
  if (row.courtesy_call_completed) events.push({ id: "courtesy", kind: "operation", at: row.courtesy_call_completed_at || null, title: "Courtesy call completed", meta: [row.courtesy_call_completed_by ? `by ${row.courtesy_call_completed_by}` : null, row.courtesy_call_outcome || null].filter(Boolean).join(" · ") });
  const epicReceived = row.epic_document_received_count ?? 0;
  const epicExpected = row.epic_document_expected_count ?? row.expected_guest_count ?? 0;
  if (epicExpected > 0 || epicReceived > 0) {
    const status = readinessStatus(epicReceived, epicExpected);
    events.push({ id: "epic-docs", kind: "document", readiness: status, at: null, title: `Epic Docs ${status === "complete" ? "ready" : status === "partial" ? "incomplete" : "missing"} (${docsSummary(row)})`, meta: status === "complete" ? "Current state · Ready" : status === "partial" ? "Current state · More signatures needed" : "Current state · Documents needed" });
  }
  if (row.requires_mpwr !== false) {
    const mpwrReceived = row.mpwr_document_received_count ?? 0;
    const mpwrExpected = row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0;
    if (mpwrExpected > 0 || mpwrReceived > 0) {
      const status = readinessStatus(mpwrReceived, mpwrExpected);
      events.push({ id: "mpwr-docs", kind: "document", readiness: status, at: null, title: `MPWR waivers ${status === "complete" ? "ready" : status === "partial" ? "incomplete" : "missing"} (${mpwrSummary(row)})`, meta: status === "complete" ? "Current state · Ready" : status === "partial" ? "Current state · More waivers needed" : "Current state · Waivers needed" });
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
  const [effectivePhone, setEffectivePhone] = useState(row.customer_phone || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [smsText, setSmsText] = useState("");
  const [smsStatus, setSmsStatus] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [canManageTemplates, setCanManageTemplates] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");

  const loadActivity = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(row.confirmation_code)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load communication activity.");
      setCalls(payload.calls || []);
      setMessages(payload.messages || []);
      if (typeof payload.customer_phone === "string") setEffectivePhone(payload.customer_phone);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Unable to load communication activity.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [row.confirmation_code]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/team/readiness/message-templates", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load templates.");
      setTemplates(payload.templates || []);
      setCanManageTemplates(payload.can_manage === true);
    } catch (err) {
      setTemplateStatus(err instanceof Error ? err.message : "Unable to load templates.");
    }
  }, []);

  useEffect(() => {
    setSmsText("");
    setSmsStatus("");
    setEffectivePhone(row.customer_phone || "");
    void loadActivity();
    void loadTemplates();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadActivity(true); }, 3000);
    const handleContactSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ confirmationCode?: string; field?: string; value?: string }>).detail;
      if (detail?.confirmationCode === row.confirmation_code && detail.field === "phone" && detail.value) {
        setEffectivePhone(detail.value);
        void loadActivity(true);
      }
    };
    window.addEventListener("readiness-contact-saved", handleContactSaved as EventListener);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("readiness-contact-saved", handleContactSaved as EventListener);
    };
  }, [loadActivity, loadTemplates, row.confirmation_code, row.customer_phone]);

  async function sendSms() {
    const text = smsText.trim();
    if (!text || smsSending) return;
    setSmsSending(true);
    setSmsStatus("");
    try {
      const response = await fetch("/api/team/readiness/callrail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: row.confirmation_code, message_text: text }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to send text message.");
      if (typeof payload.customer_phone === "string") setEffectivePhone(payload.customer_phone);
      setSmsText("");
      setSmsStatus("Sent ✓");
      window.setTimeout(() => setSmsStatus(""), 2500);
      await loadActivity(true);
      window.setTimeout(() => void loadActivity(true), 1500);
    } catch (err) {
      setSmsStatus(err instanceof Error ? err.message : "Unable to send text message.");
    } finally {
      setSmsSending(false);
    }
  }

  function startAddTemplate() {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateBody("");
    setTemplateStatus("");
  }

  function startEditTemplate(template: MessageTemplate) {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateBody(template.message_body);
    setTemplateStatus("");
  }

  async function saveTemplate() {
    const name = templateName.trim();
    const messageBody = templateBody.trim();
    if (!name || !messageBody) { setTemplateStatus("Template name and message are required."); return; }
    setTemplateStatus("Saving…");
    try {
      const response = await fetch("/api/team/readiness/message-templates", {
        method: editingTemplate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate ? { template_id: editingTemplate.template_id, name, message_body: messageBody } : { name, message_body: messageBody }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save template.");
      setTemplateStatus("Saved ✓");
      startAddTemplate();
      await loadTemplates();
    } catch (err) {
      setTemplateStatus(err instanceof Error ? err.message : "Unable to save template.");
    }
  }

  async function archiveTemplate(template: MessageTemplate) {
    if (!window.confirm(`Remove the template “${template.name}”?`)) return;
    try {
      const response = await fetch("/api/team/readiness/message-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: template.template_id, active: false }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to remove template.");
      await loadTemplates();
    } catch (err) {
      setTemplateStatus(err instanceof Error ? err.message : "Unable to remove template.");
    }
  }

  const events = useMemo(() => {
    const callEvents: JourneyEvent[] = calls.map((call) => ({ id: `call-${call.id}`, kind: "call", at: call.at, title: callTitle(call), meta: [call.direction, durationLabel(call.duration_seconds)].filter(Boolean).join(" · "), body: call.summary || call.lead_explanation || call.transcription, href: call.recording_url }));
    const textEvents: JourneyEvent[] = messages.map((message) => ({ id: `text-${message.message_id}`, kind: "text", at: message.sent_at || message.first_received_at, title: message.direction === "outbound" ? "Text sent" : "Text received", meta: [message.direction, message.agent_name ? `by ${message.agent_name}` : null, message.status || null].filter(Boolean).join(" · "), body: message.message_body || "(No message body)" }));
    return [...readinessEvents(row), ...callEvents, ...textEvents].sort((a, b) => {
      if (!a.at && !b.at) return 0;
      if (!a.at) return 1;
      if (!b.at) return -1;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });
  }, [row, calls, messages]);

  const visible = useMemo(() => {
    const filtered = filter === "all" ? events : events.filter((event) => event.kind === filter);
    if (filter === "text") {
      return [...filtered].sort((a, b) => {
        if (!a.at && !b.at) return 0;
        if (!a.at) return -1;
        if (!b.at) return 1;
        return new Date(a.at).getTime() - new Date(b.at).getTime();
      });
    }
    return filtered;
  }, [events, filter]);

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

      <div className={styles.smsComposer}>
        <div className={styles.smsComposerHeader}>
          <strong>Text {row.customer_name.split(" ")[0] || "Guest"}</strong>
          <span>{effectivePhone || "No phone number"}</span>
        </div>

        <div className={styles.templateBar}>
          <button type="button" className={styles.templateButton} onClick={() => setTemplatesOpen((value) => !value)}>Templates ▾</button>
          {canManageTemplates ? <button type="button" className={styles.templateManageButton} onClick={() => { setManageTemplatesOpen(true); startAddTemplate(); }}>Manage templates</button> : null}
          {templatesOpen ? <div className={styles.templateMenu}>{templates.map((template) => <button type="button" key={template.template_id} onClick={() => { setSmsText(applyTemplate(template.message_body, row)); setTemplatesOpen(false); setSmsStatus(""); }}>{template.name}</button>)}</div> : null}
        </div>

        <div className={styles.smsComposerRow}>
          <textarea
            value={smsText}
            onChange={(event) => { setSmsText(event.target.value); setSmsStatus(""); }}
            placeholder={effectivePhone ? "Type a message…" : "No phone number available"}
            maxLength={1600}
            disabled={!effectivePhone || smsSending}
            aria-label={`Text ${row.customer_name}`}
          />
          <button type="button" onClick={sendSms} disabled={!effectivePhone || !smsText.trim() || smsSending}>
            {smsSending ? "Sending…" : "Send"}
          </button>
        </div>
        <div className={styles.smsComposerFooter}>
          <span>{smsText.length}/1600</span>
          {smsStatus ? <span className={smsStatus === "Sent ✓" ? styles.smsSuccess : styles.smsError}>{smsStatus}</span> : null}
        </div>
      </div>

      {manageTemplatesOpen ? <div className={styles.templateManagerBackdrop} onMouseDown={() => setManageTemplatesOpen(false)}>
        <section className={styles.templateManager} onMouseDown={(event) => event.stopPropagation()}>
          <header><div><strong>Text Templates</strong><span>Admin and Manager can add or edit templates.</span></div><button type="button" onClick={() => setManageTemplatesOpen(false)}>×</button></header>
          <div className={styles.templateManagerBody}>
            <div className={styles.templateList}>{templates.map((template) => <div className={styles.templateListRow} key={template.template_id}><button type="button" onClick={() => startEditTemplate(template)}><strong>{template.name}</strong><span>{template.message_body}</span></button><button type="button" className={styles.templateDelete} onClick={() => archiveTemplate(template)}>Remove</button></div>)}</div>
            <div className={styles.templateEditor}>
              <h4>{editingTemplate ? "Edit template" : "Add template"}</h4>
              <label>Name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" /></label>
              <label>Message<textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="Template message" rows={7} /></label>
              <div className={styles.templateHelp}>Available placeholders: {'{{first_name}}'}, {'{{guest_name}}'}, {'{{activity}}'}, {'{{time}}'}, {'{{confirmation}}'}</div>
              <div className={styles.templateEditorActions}><button type="button" onClick={startAddTemplate}>New</button><button type="button" className={styles.templateSave} onClick={saveTemplate}>Save template</button></div>
              {templateStatus ? <div className={styles.templateStatus}>{templateStatus}</div> : null}
            </div>
          </div>
        </section>
      </div> : null}
    </section>
  );
}
