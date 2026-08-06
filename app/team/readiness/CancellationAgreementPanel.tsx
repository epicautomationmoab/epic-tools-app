"use client";

import { useEffect, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import styles from "./CancellationAgreementPanel.module.css";

type AgreementStatus = {
  id: string;
  status: "created" | "sent" | "opened" | "accepted" | "failed" | "expired";
  tripsafe_status: "declined" | "purchased" | "confirmed_within_48";
  delivery_mode: "sms" | "email" | "both" | "copy";
  sent_by: string;
  sent_at: string | null;
  opened_at: string | null;
  accepted_at: string | null;
  signer_name: string | null;
  last_error: string | null;
};

const TEAM = ["Alex", "Cody", "Jenna", "Kim", "Lonnie", "Maggie", "Price", "Randy", "Taylin"];

function statusLabel(status: AgreementStatus["status"]) {
  if (status === "created") return "Link created";
  if (status === "sent") return "Agreement sent";
  if (status === "opened") return "Guest is reviewing";
  if (status === "accepted") return "Accepted";
  if (status === "expired") return "Expired";
  return "Send failed";
}

export default function CancellationAgreementPanel({ row }: { row: ReadinessRow }) {
  const [agreement, setAgreement] = useState<AgreementStatus | null>(null);
  const [tripSafeStatus, setTripSafeStatus] = useState<"declined" | "purchased" | "confirmed_within_48">("declined");
  const [sentBy, setSentBy] = useState("");
  const [phone, setPhone] = useState(row.customer_phone || "");
  const [email, setEmail] = useState(row.customer_email || "");
  const [deliveryMode, setDeliveryMode] = useState<"sms" | "email" | "both">("email");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [podiumConfigured, setPodiumConfigured] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [error, setError] = useState("");

  async function loadStatus(quiet = false) {
    if (!row.readiness_id) return;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/team/cancellation-agreements?readinessId=${encodeURIComponent(row.readiness_id)}`, { cache: "no-store" });
      const data = (await response.json()) as {
        agreement?: AgreementStatus | null;
        podiumConfigured?: boolean;
        emailConfigured?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Unable to load agreement status.");
      setAgreement(data.agreement ?? null);
      setPodiumConfigured(data.podiumConfigured === true);
      setEmailConfigured(data.emailConfigured === true);
      if (data.podiumConfigured === true && data.emailConfigured !== true) setDeliveryMode("sms");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load agreement status.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    setAgreement(null);
    setError("");
    setPhone(row.customer_phone || "");
    setEmail(row.customer_email || "");
    void loadStatus();
  }, [row.readiness_id, row.customer_phone, row.customer_email]);

  useEffect(() => {
    if (!agreement || !["created", "sent", "opened"].includes(agreement.status)) return;
    const timer = window.setInterval(() => void loadStatus(true), 2000);
    return () => window.clearInterval(timer);
  }, [agreement?.status, row.readiness_id]);

  async function createAgreement(mode: "sms" | "email" | "both" | "copy") {
    if (!row.readiness_id || !sentBy) {
      setError("Select the team member sending this agreement.");
      return;
    }
    if (mode === "copy") setCopying(true);
    else setSending(true);
    setCopied(false);
    setError("");
    try {
      const response = await fetch("/api/team/cancellation-agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readinessId: row.readiness_id, tripSafeStatus, sentBy, deliveryMode: mode, phone, email }),
      });
      const data = (await response.json()) as { error?: string; agreementUrl?: string };
      if (!response.ok) throw new Error(data.error || "Unable to send agreement.");
      if (mode === "copy" && data.agreementUrl) {
        await navigator.clipboard.writeText(data.agreementUrl);
        setCopied(true);
      }
      await loadStatus(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send agreement.");
    } finally {
      setSending(false);
      setCopying(false);
    }
  }

  const canSend = !agreement || ["failed", "expired"].includes(agreement.status);

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <h3>Cancellation Agreement</h3>
          <p>Send a 45-second policy acceptance by text, email, or both.</p>
        </div>
        {agreement ? <span className={`${styles.badge} ${styles[agreement.status]}`}>{statusLabel(agreement.status)}</span> : null}
      </div>

      {loading ? <p className={styles.muted}>Checking agreement status…</p> : null}

      {!loading && agreement ? (
        <div className={styles.statusCard}>
          <strong>{statusLabel(agreement.status)}</strong>
          <span>
            {agreement.status === "accepted"
              ? `${agreement.signer_name || row.customer_name} · ${agreement.accepted_at ? new Date(agreement.accepted_at).toLocaleString() : "recorded"}`
              : `${agreement.tripsafe_status === "purchased"
                ? "TripSafe purchased — 1-hour policy"
                : agreement.tripsafe_status === "confirmed_within_48"
                  ? "Confirmed within 48 hours — nonrefundable"
                  : "TripSafe declined — 48-hour policy"} · sent by ${agreement.sent_by}`}
          </span>
          {agreement.status === "opened" ? <small>Keep the guest on the phone—they have the agreement open.</small> : null}
          {agreement.last_error ? <small className={styles.error}>{agreement.last_error}</small> : null}
        </div>
      ) : null}

      {!loading && canSend ? (
        <div className={styles.controls}>
          <label className={styles.addressField}>
            <span>Mobile number</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="(435) 555-1234" />
          </label>
          <label className={styles.addressField}>
            <span>Email address</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" placeholder="guest@example.com" />
          </label>
          <label>
            <span>Agreement type</span>
            <select value={tripSafeStatus} onChange={(event) => setTripSafeStatus(event.target.value as "declined" | "purchased" | "confirmed_within_48")}>
              <option value="declined">TripSafe Declined — 48-Hour Policy</option>
              <option value="purchased">TripSafe Purchased — 1-Hour Policy</option>
              <option value="confirmed_within_48">Confirmed Within 48 Hours — Nonrefundable</option>
            </select>
          </label>
          <label>
            <span>Delivery</span>
            <select value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as "sms" | "email" | "both")}>
              {podiumConfigured ? <option value="sms">Text</option> : null}
              {emailConfigured ? <option value="email">Email</option> : null}
              {podiumConfigured && emailConfigured ? <option value="both">Text + Email</option> : null}
            </select>
          </label>
          <label>
            <span>Sent by</span>
            <select value={sentBy} onChange={(event) => setSentBy(event.target.value)}>
              <option value="">Select team member…</option>
              {TEAM.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          {podiumConfigured || emailConfigured ? (
            <button type="button" disabled={sending || copying} onClick={() => void createAgreement(deliveryMode)}>
              {sending ? "Sending…" : "Send Agreement"}
            </button>
          ) : null}
          <button type="button" className={styles.copyButton} disabled={sending || copying} onClick={() => void createAgreement("copy")}>
            {copying ? "Creating…" : copied ? "Link Copied" : "Copy Link"}
          </button>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
      {copied ? <p className={styles.copied}>Secure agreement link copied. Paste it into any text or email.</p> : null}
    </section>
  );
}
