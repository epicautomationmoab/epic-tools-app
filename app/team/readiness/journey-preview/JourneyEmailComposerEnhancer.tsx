"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";

type EmailTemplate = {
  template_id: string;
  name: string;
  subject_template: string | null;
  message_body: string;
  category: string | null;
  active: boolean;
  sort_order: number;
};

const GUEST_PORTAL_BASE_URL = "https://team.myepicreservation.com";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" }).format(date);
}

function portalUrl(row: ReadinessRow) {
  return row.guest_portal_token ? `${GUEST_PORTAL_BASE_URL}/guest/${encodeURIComponent(row.guest_portal_token)}` : "";
}

function applyTemplate(value: string, row: ReadinessRow) {
  const firstName = row.customer_name.trim().split(/\s+/)[0] || "Guest";
  return value
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{guest_name}}", row.customer_name)
    .replaceAll("{{activity}}", row.product_display_name)
    .replaceAll("{{time}}", formatTime(row.visit_start_time))
    .replaceAll("{{confirmation}}", row.confirmation_code)
    .replaceAll("{{portal_url}}", portalUrl(row));
}

export default function JourneyEmailComposerEnhancer({ row }: { row: ReadinessRow }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [canManageTemplates, setCanManageTemplates] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");

  const recipient = useMemo(() => row.customer_email?.trim() || "", [row.customer_email]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/team/readiness/message-templates?channel=email", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load email templates.");
      setTemplates(payload.templates || []);
      setCanManageTemplates(payload.can_manage === true);
    } catch (error) {
      setTemplateStatus(error instanceof Error ? error.message : "Unable to load email templates.");
    }
  }, []);

  useEffect(() => {
    setOpen(false);
    setSubject("");
    setBody("");
    setStatus("");
    setTemplatesOpen(false);
    setManageOpen(false);
  }, [row.confirmation_code]);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    function interceptMailto(event: MouseEvent) {
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href^="mailto:"]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const journeyPane = anchor.closest('[aria-label="Customer communications"]');
      if (!journeyPane) return;
      event.preventDefault();
      event.stopPropagation();
      setStatus("");
      setOpen(true);
      void loadTemplates();
    }

    document.addEventListener("click", interceptMailto, true);
    return () => document.removeEventListener("click", interceptMailto, true);
  }, [loadTemplates]);

  function resetTemplateEditor() {
    setEditing(null);
    setTemplateName("");
    setTemplateCategory("");
    setTemplateSubject("");
    setTemplateBody("");
    setTemplateStatus("");
  }

  function editTemplate(template: EmailTemplate) {
    setEditing(template);
    setTemplateName(template.name);
    setTemplateCategory(template.category || "");
    setTemplateSubject(template.subject_template || "");
    setTemplateBody(template.message_body);
    setTemplateStatus("");
  }

  async function saveTemplate() {
    const name = templateName.trim();
    const subjectTemplate = templateSubject.trim();
    const messageBody = templateBody.trim();
    if (!name || !subjectTemplate || !messageBody) {
      setTemplateStatus("Template name, subject, and message are required.");
      return;
    }
    setTemplateStatus("Saving…");
    try {
      const response = await fetch("/api/team/readiness/message-templates", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? {
          template_id: editing.template_id,
          name,
          subject_template: subjectTemplate,
          message_body: messageBody,
          category: templateCategory.trim(),
        } : {
          channel: "email",
          name,
          subject_template: subjectTemplate,
          message_body: messageBody,
          category: templateCategory.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save email template.");
      resetTemplateEditor();
      await loadTemplates();
    } catch (error) {
      setTemplateStatus(error instanceof Error ? error.message : "Unable to save email template.");
    }
  }

  async function archiveTemplate(template: EmailTemplate) {
    if (!window.confirm(`Remove the template “${template.name}”?`)) return;
    try {
      const response = await fetch("/api/team/readiness/message-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: template.template_id, active: false }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to remove email template.");
      await loadTemplates();
    } catch (error) {
      setTemplateStatus(error instanceof Error ? error.message : "Unable to remove email template.");
    }
  }

  async function send() {
    if (!subject.trim() || !body.trim() || sending) return;
    setSending(true);
    setStatus("");
    try {
      const response = await fetch("/api/team/readiness/gmail-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: row.confirmation_code,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to send email.");
      setStatus("Sent ✓");
      setSubject("");
      setBody("");
      window.setTimeout(() => {
        setOpen(false);
        setStatus("");
      }, 900);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send email.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div role="presentation" onMouseDown={() => !sending && setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 180, background: "rgba(11,18,28,.34)", display: "grid", placeItems: "center", padding: 24 }}>
      <section role="dialog" aria-modal="true" aria-label={`Email ${row.customer_name}`} onMouseDown={(event) => event.stopPropagation()} style={{ width: "min(760px, calc(100vw - 48px))", maxHeight: "calc(100vh - 48px)", background: "#fff", borderRadius: 18, boxShadow: "0 28px 80px rgba(8,16,28,.30)", overflow: "auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "22px 24px 18px", borderBottom: "1px solid #e4e8ec" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em", color: "#e9531d", marginBottom: 5 }}>Email Guest</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#1c2430" }}>{row.customer_name}</div>
            <div style={{ marginTop: 5, fontSize: 13, color: "#6f7a88" }}>From: hello@epic4x4adventures.com</div>
            <div style={{ marginTop: 2, fontSize: 13, color: "#6f7a88" }}>To: {recipient || "No customer email"}</div>
          </div>
          <button type="button" onClick={() => !sending && setOpen(false)} aria-label="Close email composer" style={{ border: 0, background: "#f1f3f5", width: 38, height: 38, borderRadius: 999, fontSize: 25, lineHeight: "38px", cursor: "pointer" }}>×</button>
        </header>

        <div style={{ display: "grid", gap: 14, padding: 24 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", position: "relative" }}>
            <button type="button" onClick={() => setTemplatesOpen((value) => !value)} style={{ minHeight: 38, padding: "0 12px", border: "1px solid #cfd7df", borderRadius: 9, background: "#fff", fontWeight: 800, color: "#2c3440", cursor: "pointer" }}>Templates ▾</button>
            {canManageTemplates ? <button type="button" onClick={() => { setManageOpen(true); resetTemplateEditor(); }} style={{ minHeight: 38, padding: "0 12px", border: "1px solid #cfd7df", borderRadius: 9, background: "#fff", fontWeight: 800, color: "#e9531d", cursor: "pointer" }}>Manage templates</button> : null}
            {templatesOpen ? <div style={{ position: "absolute", top: 44, left: 0, zIndex: 5, width: 320, maxHeight: 280, overflow: "auto", background: "#fff", border: "1px solid #d8dee5", borderRadius: 10, boxShadow: "0 12px 30px rgba(8,16,28,.15)", padding: 6 }}>
              {templates.length ? templates.map((template) => <button key={template.template_id} type="button" onClick={() => { setSubject(applyTemplate(template.subject_template || "", row)); setBody(applyTemplate(template.message_body, row)); setTemplatesOpen(false); setStatus(""); }} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: "10px 11px", borderRadius: 7, cursor: "pointer" }}><strong style={{ display: "block", color: "#202733" }}>{template.name}</strong>{template.category ? <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "#7a8490" }}>{template.category}</span> : null}</button>) : <div style={{ padding: 10, fontSize: 12, color: "#7a8490" }}>No email templates yet.</div>}
            </div> : null}
          </div>

          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "#2c3440" }}>Subject<input value={subject} onChange={(event) => { setSubject(event.target.value); setStatus(""); }} placeholder="Email subject" maxLength={250} disabled={sending || !recipient} style={{ width: "100%", minHeight: 44, border: "1px solid #cfd7df", borderRadius: 10, padding: "0 12px", font: "inherit", fontSize: 14 }} /></label>

          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "#2c3440" }}>Message<textarea value={body} onChange={(event) => { setBody(event.target.value); setStatus(""); }} placeholder="Write your email…" rows={10} maxLength={20000} disabled={sending || !recipient} style={{ width: "100%", resize: "vertical", border: "1px solid #cfd7df", borderRadius: 10, padding: 12, font: "inherit", fontSize: 14, lineHeight: 1.45 }} /></label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><div style={{ fontSize: 12, color: status === "Sent ✓" ? "#188a4b" : "#b42318", minHeight: 18 }}>{status}</div><button type="button" onClick={send} disabled={sending || !recipient || !subject.trim() || !body.trim()} style={{ minWidth: 112, minHeight: 44, border: 0, borderRadius: 10, background: "#188a4b", color: "#fff", fontWeight: 900, fontSize: 14, cursor: sending ? "wait" : "pointer", opacity: sending || !recipient || !subject.trim() || !body.trim() ? .45 : 1 }}>{sending ? "Sending…" : "Send Email"}</button></div>
        </div>

        {manageOpen ? <div style={{ borderTop: "1px solid #e4e8ec", padding: 24, background: "#fbfcfd" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><strong style={{ fontSize: 16 }}>Email Templates</strong><div style={{ fontSize: 12, color: "#6f7a88", marginTop: 2 }}>Admin and Manager can add or edit templates.</div></div><button type="button" onClick={() => setManageOpen(false)} style={{ border: 0, background: "transparent", fontSize: 24, cursor: "pointer" }}>×</button></div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, .8fr) minmax(320px, 1.2fr)", gap: 18 }}>
            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>{templates.map((template) => <div key={template.template_id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}><button type="button" onClick={() => editTemplate(template)} style={{ textAlign: "left", border: "1px solid #d8dee5", background: "#fff", borderRadius: 9, padding: 10, cursor: "pointer" }}><strong style={{ display: "block", color: "#202733" }}>{template.name}</strong><span style={{ display: "block", marginTop: 3, fontSize: 11, color: "#7a8490" }}>{template.subject_template}</span></button><button type="button" onClick={() => archiveTemplate(template)} style={{ border: 0, background: "transparent", color: "#b42318", fontSize: 12, cursor: "pointer", paddingTop: 8 }}>Remove</button></div>)}{!templates.length ? <div style={{ fontSize: 12, color: "#7a8490" }}>No email templates yet.</div> : null}</div>
            <div style={{ display: "grid", gap: 10 }}>
              <strong>{editing ? "Edit template" : "Add template"}</strong>
              <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" style={{ minHeight: 40, border: "1px solid #cfd7df", borderRadius: 9, padding: "0 10px" }} />
              <input value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)} placeholder="Category (optional)" style={{ minHeight: 40, border: "1px solid #cfd7df", borderRadius: 9, padding: "0 10px" }} />
              <input value={templateSubject} onChange={(event) => setTemplateSubject(event.target.value)} placeholder="Subject template" style={{ minHeight: 40, border: "1px solid #cfd7df", borderRadius: 9, padding: "0 10px" }} />
              <textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="Email body template" rows={7} style={{ border: "1px solid #cfd7df", borderRadius: 9, padding: 10, resize: "vertical" }} />
              <div style={{ fontSize: 11, color: "#6f7a88" }}>Available placeholders: {'{{first_name}}'}, {'{{guest_name}}'}, {'{{activity}}'}, {'{{time}}'}, {'{{confirmation}}'}, {'{{portal_url}}'}</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div style={{ fontSize: 12, color: templateStatus === "Saving…" ? "#6f7a88" : "#b42318" }}>{templateStatus}</div><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={resetTemplateEditor} style={{ minHeight: 38, padding: "0 12px", border: "1px solid #cfd7df", borderRadius: 9, background: "#fff", cursor: "pointer" }}>New</button><button type="button" onClick={saveTemplate} style={{ minHeight: 38, padding: "0 12px", border: 0, borderRadius: 9, background: "#188a4b", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Save template</button></div></div>
            </div>
          </div>
        </div> : null}
      </section>
    </div>
  );
}
