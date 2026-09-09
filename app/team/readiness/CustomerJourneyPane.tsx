"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import styles from "./CustomerJourneyModal.module.css";

type CommunicationKind = "call" | "text" | "email";
type CommunicationFilter = "outbound" | "all" | CommunicationKind;
type CommunicationEvent = {
  id: string;
  kind: CommunicationKind;
  at: string | null;
  title: string;
  meta: string;
  body?: string | null;
  href?: string | null;
  direction?: string | null;
  label?: string | null;
  recipient?: string | null;
  sender?: string | null;
  status?: string | null;
  openCount?: number;
  firstOpenedAt?: string | null;
  lastOpenedAt?: string | null;
};
type CallRailCall = { id: string; at: string; direction: string; answered: boolean | null; voicemail: boolean | null; duration_seconds: number | null; recording_url: string | null; summary: string | null; transcription: string | null; lead_explanation: string | null };
type CallRailMessage = { message_id: string; direction: string; message_body: string | null; status: string | null; sent_at: string | null; first_received_at: string; agent_name: string | null };
type EmailHistoryItem = { id: string; direction: "outbound" | "inbound"; at: string; label: string; subject: string; communication_type: string; recipient: string | null; sender?: string | null; body?: string | null; provider_message_id: string | null; status: string; error: string | null; open_count?: number; first_opened_at?: string | null; last_opened_at?: string | null };
type MessageTemplate = { template_id: string; name: string; message_body: string; sort_order: number; active: boolean; updated_at: string; updated_by: string | null };

const GUEST_PORTAL_BASE_URL = "https://team.myepicreservation.com";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "numeric", day: "numeric" }).format(date);
}
function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" }).format(date);
}
function durationLabel(seconds: number | null) { if (!seconds) return ""; const m = Math.floor(seconds / 60); const s = seconds % 60; return m ? `${m}m ${s}s` : `${s}s`; }
function callTitle(call: CallRailCall) { if (call.voicemail) return "Voicemail"; if (call.answered === false) return "Missed Call"; return call.direction === "outbound" ? "Outbound Call" : "Inbound Call"; }
function portalUrl(row: ReadinessRow) { return row.guest_portal_token ? `${GUEST_PORTAL_BASE_URL}/guest/${encodeURIComponent(row.guest_portal_token)}` : ""; }
function timelineLabel(event: CommunicationEvent) {
  if (event.kind === "text") return "T";
  if (event.kind === "email") return "E";
  return event.direction === "outbound" ? "OC" : "IC";
}
function statusTone(status: string | null | undefined) {
  const value = (status || "").toLowerCase();
  if (value === "delivered" || value === "sent" || value === "received") return { background: "#e8f6ee", color: "#188a4b" };
  if (value === "failed" || value === "bounced") return { background: "#fff0ed", color: "#b42318" };
  if (value === "suppressed") return { background: "#f1f3f5", color: "#5f6a76" };
  return { background: "#fff3d8", color: "#8a5a00" };
}
function applyTemplate(template: string, row: ReadinessRow) {
  const firstName = row.customer_name.trim().split(/\s+/)[0] || "Guest";
  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{guest_name}}", row.customer_name)
    .replaceAll("{{activity}}", row.product_display_name)
    .replaceAll("{{time}}", formatTime(row.visit_start_time))
    .replaceAll("{{confirmation}}", row.confirmation_code)
    .replaceAll("{{portal_url}}", portalUrl(row));
}

export default function CustomerJourneyPane({ row }: { row: ReadinessRow }) {
  const [filter, setFilter] = useState<CommunicationFilter>("outbound");
  const [calls, setCalls] = useState<CallRailCall[]>([]);
  const [messages, setMessages] = useState<CallRailMessage[]>([]);
  const [emails, setEmails] = useState<EmailHistoryItem[]>([]);
  const [effectivePhone, setEffectivePhone] = useState(row.customer_phone || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [smsText, setSmsText] = useState("");
  const [smsStatus, setSmsStatus] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [canManageTemplates, setCanManageTemplates] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateLoadState, setTemplateLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [templateLoadMessage, setTemplateLoadMessage] = useState("");
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");

  const loadActivity = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [callrailResponse, emailResponse] = await Promise.all([
        fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(row.confirmation_code)}`, { cache: "no-store" }),
        fetch(`/api/team/readiness/email-history?confirmation=${encodeURIComponent(row.confirmation_code)}`, { cache: "no-store" }),
      ]);
      const callrailPayload = await callrailResponse.json();
      const emailPayload = await emailResponse.json();
      if (!callrailResponse.ok) throw new Error(callrailPayload.error || "Unable to load communication activity.");
      if (!emailResponse.ok) throw new Error(emailPayload.error || "Unable to load email history.");
      setCalls(callrailPayload.calls || []);
      setMessages(callrailPayload.messages || []);
      setEmails(emailPayload.emails || []);
      if (typeof callrailPayload.customer_phone === "string") setEffectivePhone(callrailPayload.customer_phone);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Unable to load communication activity.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [row.confirmation_code]);

  const loadTemplates = useCallback(async () => {
    setTemplateLoadState("loading");
    setTemplateLoadMessage("");
    try {
      const response = await fetch("/api/team/readiness/message-templates", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load templates.");
      const nextTemplates = payload.templates || [];
      setTemplates(nextTemplates);
      setCanManageTemplates(payload.can_manage === true);
      setTemplateLoadState("ready");
      setTemplateLoadMessage(nextTemplates.length ? "" : "No templates available.");
    } catch (err) {
      setTemplates([]);
      setCanManageTemplates(false);
      setTemplateLoadState("error");
      setTemplateLoadMessage(err instanceof Error ? err.message : "Unable to load templates.");
    }
  }, []);

  useEffect(() => {
    setFilter("outbound");
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

  function startAddTemplate() { setEditingTemplate(null); setTemplateName(""); setTemplateBody(""); setTemplateStatus(""); }
  function startEditTemplate(template: MessageTemplate) { setEditingTemplate(template); setTemplateName(template.name); setTemplateBody(template.message_body); setTemplateStatus(""); }
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
      startAddTemplate();
      await loadTemplates();
    } catch (err) { setTemplateStatus(err instanceof Error ? err.message : "Unable to save template."); }
  }
  async function archiveTemplate(template: MessageTemplate) {
    if (!window.confirm(`Remove the template “${template.name}”?`)) return;
    try {
      const response = await fetch("/api/team/readiness/message-templates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template_id: template.template_id, active: false }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to remove template.");
      await loadTemplates();
    } catch (err) { setTemplateStatus(err instanceof Error ? err.message : "Unable to remove template."); }
  }

  const events = useMemo(() => {
    const callEvents: CommunicationEvent[] = calls.map((call) => ({ id: `call-${call.id}`, kind: "call", direction: call.direction, at: call.at, title: callTitle(call), meta: [call.direction, durationLabel(call.duration_seconds)].filter(Boolean).join(" · "), body: call.summary || call.lead_explanation || call.transcription, href: call.recording_url }));
    const textEvents: CommunicationEvent[] = messages.map((message) => ({ id: `text-${message.message_id}`, kind: "text", direction: message.direction, at: message.sent_at || message.first_received_at, title: message.direction === "outbound" ? "Text sent" : "Text received", meta: [message.direction, message.agent_name ? `by ${message.agent_name}` : null, message.status || null].filter(Boolean).join(" · "), body: message.message_body || "(No message body)" }));
    const emailEvents: CommunicationEvent[] = emails.map((email) => ({
      id: `email-${email.id}`,
      kind: "email",
      direction: email.direction,
      at: email.at,
      title: email.subject,
      meta: email.direction === "inbound" ? [email.label, email.sender ? `from ${email.sender}` : null].filter(Boolean).join(" · ") : email.label,
      label: email.label,
      recipient: email.recipient,
      sender: email.sender,
      status: email.status,
      body: email.body,
      openCount: email.open_count || 0,
      firstOpenedAt: email.first_opened_at || null,
      lastOpenedAt: email.last_opened_at || null,
    }));
    return [...callEvents, ...textEvents, ...emailEvents].sort((a, b) => {
      if (!a.at && !b.at) return 0;
      if (!a.at) return 1;
      if (!b.at) return -1;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });
  }, [calls, messages, emails]);

  const visible = useMemo(() => {
    if (filter === "outbound") return [];
    const filtered = filter === "all" ? events : events.filter((event) => event.kind === filter);
    if (filter === "text" || filter === "all") return [...filtered].sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime());
    return filtered;
  }, [events, filter]);

  const timelineEvents = useMemo(() => events.filter((event) => event.at).slice().sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime()), [events]);
  const timelineRange = useMemo(() => {
    if (!timelineEvents.length) return null;
    const first = new Date(timelineEvents[0].at as string).getTime();
    const last = new Date(timelineEvents[timelineEvents.length - 1].at as string).getTime();
    return { first, last, span: Math.max(last - first, 1) };
  }, [timelineEvents]);
  const timelineDays = useMemo(() => {
    if (!timelineRange) return [] as Array<{ label: string; left: number }>;
    const seen = new Map<string, number>();
    for (const event of timelineEvents) {
      if (!event.at) continue;
      const timestamp = new Date(event.at).getTime();
      const label = formatShortDate(event.at);
      if (!seen.has(label)) seen.set(label, timelineEvents.length === 1 ? 50 : ((timestamp - timelineRange.first) / timelineRange.span) * 100);
    }
    return [...seen.entries()].map(([label, left]) => ({ label, left }));
  }, [timelineEvents, timelineRange]);

  const hasCalls = calls.length > 0;
  const hasTexts = messages.length > 0;
  const hasEmails = emails.length > 0;
  const filters: Array<[CommunicationFilter, string]> = [["outbound","Outbound"],["call","Calls"],["text","Texts"],["email","Emails"],["all","All"]];
  const firstName = row.customer_name.split(" ")[0] || "Guest";
  const emailHref = row.customer_email ? `mailto:${row.customer_email}` : "";

  const textComposer = <div className={styles.smsComposer} style={filter === "outbound" ? { position: "relative", bottom: "auto", margin: 0, borderTop: 0, boxShadow: "none", padding: 0, backdropFilter: "none" } : undefined}>
    <div className={styles.smsComposerHeader}><strong>Text {firstName}</strong><span>{effectivePhone || "No phone number"}</span></div>
    <div className={styles.templateBar}>
      <button type="button" className={styles.templateButton} onClick={() => setTemplatesOpen((value) => !value)}>Templates ▾</button>
      {canManageTemplates ? <button type="button" className={styles.templateManageButton} onClick={() => { setManageTemplatesOpen(true); startAddTemplate(); }}>Manage templates</button> : null}
      {templatesOpen ? <div className={styles.templateMenu}>
        {templateLoadState === "loading" ? <div style={{ padding: "10px 12px", fontSize: 12, color: "#6f7885" }}>Loading templates…</div> : null}
        {templateLoadState === "error" ? <div style={{ padding: "10px 12px", fontSize: 12, color: "#b42318", maxWidth: 280 }}>{templateLoadMessage}</div> : null}
        {templateLoadState === "ready" && templates.length === 0 ? <div style={{ padding: "10px 12px", fontSize: 12, color: "#6f7885" }}>{templateLoadMessage || "No templates available."}</div> : null}
        {templateLoadState === "ready" ? templates.map((template) => <button type="button" key={template.template_id} onClick={() => { setSmsText(applyTemplate(template.message_body, row)); setTemplatesOpen(false); setSmsStatus(""); }}>{template.name}</button>) : null}
      </div> : null}
    </div>
    <div className={styles.smsComposerRow}>
      <textarea value={smsText} onChange={(event) => { setSmsText(event.target.value); setSmsStatus(""); }} placeholder={effectivePhone ? "Type a message…" : "No phone number available"} maxLength={1600} disabled={!effectivePhone || smsSending} aria-label={`Text ${row.customer_name}`} />
      <button type="button" onClick={sendSms} disabled={!effectivePhone || !smsText.trim() || smsSending}>{smsSending ? "Sending…" : "Send"}</button>
    </div>
    <div className={styles.smsComposerFooter}><span>{smsText.length}/1600</span>{smsStatus ? <span className={smsStatus === "Sent ✓" ? styles.smsSuccess : styles.smsError}>{smsStatus}</span> : null}</div>
  </div>;

  return (
    <section className={styles.journey} style={{ height: "100%", background: "#fff" }} aria-label="Customer communications">
      <div className={styles.journeyHeader}>
        <div className={styles.eyebrow}>Customer Communications</div>
        <h2 className={styles.title} style={{ fontSize: 24 }}>{row.customer_name}</h2>
        <p className={styles.subtitle}>{formatDateTime(row.visit_start_time)} · {row.product_display_name}</p>
        <div className={styles.filters} aria-label="Communication filters">
          {filters.map(([value,label]) => {
            const hasActivity = value === "call" ? hasCalls : value === "text" ? hasTexts : value === "email" ? hasEmails : false;
            const presenceClass = value === "call" && hasActivity ? styles.filterHasCalls : value === "text" && hasActivity ? styles.filterHasTexts : value === "email" && hasActivity ? styles.filterHasEmails : "";
            return <button type="button" className={`${styles.filter} ${presenceClass} ${filter === value ? styles.filterActive : ""}`} key={value} onClick={() => setFilter(value)}>{label}</button>;
          })}
        </div>
      </div>

      {loading ? <div className={styles.placeholder}>Loading communication history…</div> : null}
      {error ? <div className={styles.timelineError}>{error}</div> : null}

      {filter === "outbound" ? <div style={{ display: "grid", gap: 16 }}>
        <div style={{ padding: 18, border: "1px solid #e1e6eb", borderRadius: 14, background: "#fbfcfd" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#202733", marginBottom: 10 }}>Outbound communications</div>
          {emailHref ? <a href={emailHref} style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 14px", borderRadius: 9, background: "#188a4b", color: "#fff", fontWeight: 900, textDecoration: "none" }}>Email {firstName}</a> : <button type="button" disabled style={{ minHeight: 40, padding: "0 14px", borderRadius: 9, border: 0, opacity: .45 }}>No email address</button>}
          {row.customer_email ? <div style={{ marginTop: 7, color: "#7a8490", fontSize: 11 }}>{row.customer_email}</div> : null}
        </div>
        {textComposer}
      </div> : null}

      {filter === "all" && timelineRange ? <div className={styles.communicationTimeline} aria-label="Communication timeline">
        <div className={styles.communicationTrack}>
          {timelineEvents.map((event) => {
            const timestamp = new Date(event.at as string).getTime();
            const left = timelineEvents.length === 1 ? 50 : ((timestamp - timelineRange.first) / timelineRange.span) * 100;
            return <a key={event.id} href={`#comm-${event.id}`} title={`${timelineLabel(event)} · ${event.title} · ${formatDateTime(event.at as string)}`} className={`${styles.communicationMark} ${event.kind === "call" ? styles.communicationMarkCall : event.kind === "text" ? styles.communicationMarkText : styles.communicationMarkEmail}`} style={{ left: `${left}%` }}>{timelineLabel(event)}</a>;
          })}
        </div>
        <div className={styles.communicationDates}>{timelineDays.map((day) => <span key={`${day.label}-${day.left}`} style={{ left: `${day.left}%` }}>{day.label}</span>)}</div>
        <div className={styles.communicationLegend}><span className={styles.legendCall}>Calls</span><span className={styles.legendText}>Texts</span><span className={styles.legendEmail}>Emails</span></div>
      </div> : null}

      {filter !== "outbound" ? <div className={`${styles.timeline} ${filter === "all" ? styles.timelineAll : ""}`}>
        {visible.map((event) => {
          if (filter === "email" && event.kind === "email") {
            const tone = statusTone(event.status);
            const inbound = event.direction === "inbound";
            return <article id={`comm-${event.id}`} className={`${styles.event} ${styles.event_email}`} key={event.id} style={{ padding: "10px 14px 10px 18px" }}>
              <div className={styles.eventTop}>
                <div className={styles.eventTitle} style={{ fontSize: 14 }}>{event.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={{ padding: "4px 8px", borderRadius: 999, background: tone.background, color: tone.color, fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".05em" }}>{inbound ? "received" : event.status || "sent"}</span>
                  {!inbound && event.openCount ? <span style={{ padding: "4px 8px", borderRadius: 999, background: "#eef4ff", color: "#2457a6", fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".05em" }}>Opened {event.openCount}X</span> : null}
                </div>
              </div>
              <div className={styles.eventMeta} style={{ marginTop: 5 }}>{inbound ? "Reply to Hello" : event.label || "Email"} · {event.at ? formatDateTime(event.at) : "Unknown time"}</div>
              {inbound && event.sender ? <div className={styles.eventMeta} style={{ marginTop: 4 }}>From {event.sender}</div> : null}
              {!inbound && event.recipient ? <div className={styles.eventMeta} style={{ marginTop: 4 }}>Delivered to {event.recipient}</div> : null}
              {!inbound && event.openCount && event.lastOpenedAt ? <div className={styles.eventMeta} style={{ marginTop: 4 }}>Last opened {formatDateTime(event.lastOpenedAt)}{event.openCount > 1 && event.firstOpenedAt ? ` · First opened ${formatDateTime(event.firstOpenedAt)}` : ""}</div> : null}
              {inbound && event.body ? <div className={styles.eventBody} style={{ marginTop: 9 }}>{event.body}</div> : null}
            </article>;
          }
          return <article id={`comm-${event.id}`} className={`${styles.event} ${styles[`event_${event.kind}`] || ""} ${event.kind === "text" && event.direction ? styles[`event_text_${event.direction}`] || "" : ""} ${filter === "all" ? styles.eventCompact : ""}`} key={event.id}>
            <div className={styles.eventTop}><div className={styles.eventTitle}>{event.title}</div><span className={`${styles.eventKind} ${styles[`kind_${event.kind}`] || ""}`}>{timelineLabel(event)}</span></div>
            <div className={styles.eventMeta}>{event.at ? formatDateTime(event.at) : "Current state"}{event.meta ? ` · ${event.meta}` : ""}{event.kind === "email" && event.openCount ? <> · <strong style={{ fontWeight: 800 }}>Opened {event.openCount}X</strong></> : null}</div>
            {event.body ? <div className={styles.eventBody}>{event.body}</div> : null}
            {event.href ? <a className={styles.eventLink} href={event.href} target="_blank" rel="noreferrer">Listen to recording ↗</a> : null}
          </article>;
        })}
      </div> : null}

      {!visible.length && !loading && filter !== "outbound" ? <div className={styles.placeholder}>No {filter === "all" ? "communication" : filter} activity is linked yet.</div> : null}
      {filter === "text" ? textComposer : null}

      {manageTemplatesOpen ? <div className={styles.templateManagerBackdrop} onMouseDown={() => setManageTemplatesOpen(false)}>
        <section className={styles.templateManager} onMouseDown={(event) => event.stopPropagation()}>
          <header><div><strong>Text Templates</strong><span>Admin and Manager can add or edit templates.</span></div><button type="button" onClick={() => setManageTemplatesOpen(false)}>×</button></header>
          <div className={styles.templateManagerBody}>
            <div className={styles.templateList}>{templates.map((template) => <div className={styles.templateListRow} key={template.template_id}><button type="button" onClick={() => startEditTemplate(template)}><strong>{template.name}</strong><span>{template.message_body}</span></button><button type="button" className={styles.templateDelete} onClick={() => archiveTemplate(template)}>Remove</button></div>)}</div>
            <div className={styles.templateEditor}>
              <h4>{editingTemplate ? "Edit template" : "Add template"}</h4>
              <label>Name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" /></label>
              <label>Message<textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="Template message" rows={7} /></label>
              <div className={styles.templateHelp}>Available placeholders: {'{{first_name}}'}, {'{{guest_name}}'}, {'{{activity}}'}, {'{{time}}'}, {'{{confirmation}}'}, {'{{portal_url}}'}</div>
              <div className={styles.templateEditorActions}><button type="button" onClick={startAddTemplate}>New</button><button type="button" className={styles.templateSave} onClick={saveTemplate}>Save template</button></div>
              {templateStatus ? <div className={styles.templateStatus}>{templateStatus}</div> : null}
            </div>
          </div>
        </section>
      </div> : null}
    </section>
  );
}