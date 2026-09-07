"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";

export default function JourneyEmailComposerEnhancer({ row }: { row: ReadinessRow }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const recipient = useMemo(() => row.customer_email?.trim() || "", [row.customer_email]);

  useEffect(() => {
    setOpen(false);
    setSubject("");
    setBody("");
    setStatus("");
  }, [row.confirmation_code]);

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
    }

    document.addEventListener("click", interceptMailto, true);
    return () => document.removeEventListener("click", interceptMailto, true);
  }, []);

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
    <div
      role="presentation"
      onMouseDown={() => !sending && setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 180,
        background: "rgba(11,18,28,.34)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Email ${row.customer_name}`}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: "min(760px, calc(100vw - 48px))",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 28px 80px rgba(8,16,28,.30)",
          overflow: "hidden",
        }}
      >
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
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "#2c3440" }}>
            Subject
            <input
              value={subject}
              onChange={(event) => { setSubject(event.target.value); setStatus(""); }}
              placeholder="Email subject"
              maxLength={250}
              disabled={sending || !recipient}
              style={{ width: "100%", minHeight: 44, border: "1px solid #cfd7df", borderRadius: 10, padding: "0 12px", font: "inherit", fontSize: 14 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "#2c3440" }}>
            Message
            <textarea
              value={body}
              onChange={(event) => { setBody(event.target.value); setStatus(""); }}
              placeholder="Write your email…"
              rows={10}
              maxLength={20000}
              disabled={sending || !recipient}
              style={{ width: "100%", resize: "vertical", border: "1px solid #cfd7df", borderRadius: 10, padding: 12, font: "inherit", fontSize: 14, lineHeight: 1.45 }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: status === "Sent ✓" ? "#188a4b" : "#b42318", minHeight: 18 }}>{status}</div>
            <button
              type="button"
              onClick={send}
              disabled={sending || !recipient || !subject.trim() || !body.trim()}
              style={{ minWidth: 112, minHeight: 44, border: 0, borderRadius: 10, background: "#188a4b", color: "#fff", fontWeight: 900, fontSize: 14, cursor: sending ? "wait" : "pointer", opacity: sending || !recipient || !subject.trim() || !body.trim() ? .45 : 1 }}
            >
              {sending ? "Sending…" : "Send Email"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
