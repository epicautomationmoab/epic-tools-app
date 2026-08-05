"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./Agreement.module.css";

type Agreement = {
  confirmation_code: string;
  customer_name: string;
  visit_summary: string;
  amount_due_cents: number | null;
  tripsafe_status: "declined" | "purchased";
  policy_title: string;
  policy_summary: string;
  policy_paragraphs: string[];
  acceptance_statement: string;
  status: string;
  accepted_at: string | null;
};

function SignaturePad({ onChange }: { onChange: (value: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.getBoundingClientRect().width;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(145 * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.strokeStyle = "#171717";
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.beginPath();
    context.moveTo(next.x, next.y);
    drawing.current = true;
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
    hasInk.current = true;
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current) onChange(event.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange(null);
  }

  return (
    <div>
      <div className={styles.signatureHeading}>
        <label htmlFor="signature">Sign with your finger</label>
        <button type="button" onClick={clear}>Clear</button>
      </div>
      <canvas
        id="signature"
        ref={canvasRef}
        className={styles.signaturePad}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label="Signature pad"
      />
    </div>
  );
}

export default function AgreementPage() {
  const token = useParams<{ token: string }>()?.token;
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/agreements/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { agreement?: Agreement; error?: string };
        if (!response.ok || !data.agreement) throw new Error(data.error || "Unable to open agreement.");
        setAgreement(data.agreement);
        setSignerName(data.agreement.customer_name);
        if (data.agreement.status === "accepted") setComplete(true);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to open agreement."))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (!agreed) return setError("Please check I agree.");
    if (!signature) return setError("Please sign in the signature box.");
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/agreements/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName, signatureDataUrl: signature, agreed }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to record acceptance.");
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record acceptance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" />
        </header>

        {loading ? <div className={styles.message}>Opening your agreement…</div> : null}
        {!loading && error && !agreement ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}

        {!loading && agreement && complete ? (
          <div className={styles.complete}>
            <span aria-hidden="true">✓</span>
            <h1>Agreement accepted</h1>
            <p>Your acceptance for reservation <strong>{agreement.confirmation_code}</strong> has been recorded.</p>
            <small>You may close this page.</small>
          </div>
        ) : null}

        {!loading && agreement && !complete ? (
          <form className={styles.form} onSubmit={submit}>
            <p className={styles.eyebrow}>Reservation {agreement.confirmation_code}</p>
            <h1>{agreement.policy_title}</h1>
            <div className={styles.reservation}>
              <strong>{agreement.visit_summary}</strong>
              <span>{agreement.policy_summary}</span>
            </div>

            <div className={styles.policy}>
              {agreement.policy_paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>

            <label className={styles.agreementCheck}>
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
              <span>{agreement.acceptance_statement}</span>
            </label>

            <label className={styles.nameField}>
              <span>Your full name</span>
              <input value={signerName} onChange={(event) => setSignerName(event.target.value)} autoComplete="name" />
            </label>

            <SignaturePad onChange={setSignature} />
            {error ? <p className={styles.formError}>{error}</p> : null}
            <button className={styles.submit} type="submit" disabled={submitting}>
              {submitting ? "Recording…" : "Accept & Finish"}
            </button>
            <p className={styles.privacy}>Your signature, acceptance time, IP address, and device information are recorded with this reservation.</p>
          </form>
        ) : null}
      </section>
    </main>
  );
}
