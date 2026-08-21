"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import styles from "./GuestForm.module.css";

type Field = { key: string; label: string; type: string; required?: boolean };
type FormPayload = {
  task: { confirmation_code: string; task_status: string; assigned_guest_name: string | null };
  template: { template_key: string; form_title: string; form_description: string | null; agreement_html: string; fields_schema: Field[]; requires_signature: boolean };
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
    canvas.height = Math.round(150 * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.strokeStyle = "#1f2937";
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const p = point(event);
    context.beginPath();
    context.moveTo(p.x, p.y);
    drawing.current = true;
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const p = point(event);
    context.lineTo(p.x, p.y);
    context.stroke();
    hasInk.current = true;
  };
  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current) onChange(event.currentTarget.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange(null);
  };
  return <div className={styles.signatureBlock}>
    <div className={styles.signatureHeading}><strong>Signature</strong><button type="button" onClick={clear}>Clear</button></div>
    <canvas ref={canvasRef} className={styles.signaturePad} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
  </div>;
}

export default function GuestFormPage() {
  const token = useParams<{ token: string }>()?.token;
  const searchParams = useSearchParams();
  const returnPath = searchParams.get("return");
  const safeReturnPath = returnPath?.startsWith("/guest/") ? returnPath : null;
  const [payload, setPayload] = useState<FormPayload | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/guest-forms/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json() as FormPayload & { error?: string };
        if (!response.ok || !data.template) throw new Error(data.error || "Unable to open form.");
        setPayload(data);
        if (data.task.task_status === "completed") setComplete(true);
      })
      .catch(caught => setError(caught instanceof Error ? caught.message : "Unable to open form."))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !payload) return;
    setSubmitting(true);
    setError("");
    try {
      const signerName = payload.template.template_key === "pet_acknowledgment"
        ? values.renter_full_name
        : `${values.guardian_first_name || ""} ${values.guardian_last_name || ""}`.trim();
      const response = await fetch(`/api/guest-forms/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: values, signerName, signatureDataUrl: signature, agreed }),
      });
      const data = await response.json() as { error?: string; documentId?: string };
      if (!response.ok) throw new Error(data.error || "Unable to submit form.");
      setDocumentId(data.documentId || "");
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit form.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={styles.page}><section className={styles.card}>
    <header className={styles.header}><img src="/epic-logo-black.png" alt="Epic 4X4 Adventures" /></header>
    {loading ? <div className={styles.message}>Opening your form…</div> : null}
    {!loading && error && !payload ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
    {!loading && payload && complete ? <div className={styles.complete}>
      <div className={styles.check}>✓</div><h1>Thank you</h1><p>Your {payload.template.form_title} has been recorded.</p>
      <p>Reservation <strong>{payload.task.confirmation_code}</strong></p>{documentId ? <small>Document ID: {documentId}</small> : null}
      {safeReturnPath ? <a className={styles.submit} href={safeReturnPath}>Return to My Epic Reservation</a> : <small>You may close this page.</small>}
    </div> : null}
    {!loading && payload && !complete ? <form className={styles.form} onSubmit={submit}>
      <p className={styles.eyebrow}>Reservation {payload.task.confirmation_code}</p>
      <h1>{payload.template.form_title}</h1>{payload.template.form_description ? <p className={styles.description}>{payload.template.form_description}</p> : null}
      <div className={styles.fields}>{payload.template.fields_schema.map(field => <label key={field.key}>
        <span>{field.label}{field.required ? " *" : ""}</span>
        <input type={field.type === "date" ? "date" : "text"} value={values[field.key] || ""} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} required={field.required} />
      </label>)}</div>
      <div className={styles.agreement} dangerouslySetInnerHTML={{ __html: payload.template.agreement_html }} />
      <label className={styles.agree}><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} /><span>I have read and understand this agreement and voluntarily accept its terms.</span></label>
      {payload.template.requires_signature ? <SignaturePad onChange={setSignature} /> : null}
      {error ? <p className={styles.formError}>{error}</p> : null}
      <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Sign & Submit"}</button>
      <p className={styles.privacy}>Your signature, submission time, IP address, and device information are recorded with your reservation.</p>
    </form> : null}
  </section></main>;
}
