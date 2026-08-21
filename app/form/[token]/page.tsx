"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import styles from "./GuestForm.module.css";

type Field = { key: string; label: string; type: string; required?: boolean; options?: string[] };
type ReservationContext = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  visit_start_time: string;
  product_display_name: string;
  adventure_assure_level: string | null;
  vehicle_breakdown: Array<{ model?: string; quantity?: number }> | null;
};
type FormPayload = {
  task: { confirmation_code: string; task_status: string; assigned_guest_name: string | null };
  template: { template_key: string; form_title: string; form_description: string | null; agreement_html: string; fields_schema: Field[]; requires_signature: boolean };
  reservation?: ReservationContext | null;
};

type Attachment = { id: string; original_filename: string | null; content_type: string | null; byte_size: number | null };

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

function formatVisit(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

async function readJsonResponse<T extends { error?: string }>(response: Response, fallback: string) {
  const text = await response.text();
  let data: T | null = null;
  try {
    data = text ? JSON.parse(text) as T : null;
  } catch {
    if (!response.ok) {
      if (response.status === 413 || /request entity too large/i.test(text)) {
        throw new Error("That photo is too large to upload. Please choose a smaller photo.");
      }
      throw new Error(fallback);
    }
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(data?.error || fallback);
  return data ?? ({} as T);
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
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [complete, setComplete] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/guest-forms/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async response => {
        const data = await readJsonResponse<FormPayload & { error?: string }>(response, "Unable to open form.");
        if (!data.template) throw new Error("Unable to open form.");
        setPayload(data);
        if (data.task.task_status === "completed") setComplete(true);
      })
      .catch(caught => setError(caught instanceof Error ? caught.message : "Unable to open form."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || payload?.template.template_key !== "damage_acknowledgment") return;
    fetch(`/api/guest-forms/${encodeURIComponent(token)}/attachments`, { cache: "no-store" })
      .then(async response => {
        const data = await readJsonResponse<{ attachments?: Attachment[]; error?: string }>(response, "Unable to load photos.");
        setAttachments(data.attachments ?? []);
      })
      .catch(() => undefined);
  }, [token, payload?.template.template_key]);

  function setMultiValue(fieldKey: string, option: string, checked: boolean) {
    setValues(current => {
      const selected = new Set((current[fieldKey] || "").split(" | ").filter(Boolean));
      if (checked) selected.add(option); else selected.delete(option);
      return { ...current, [fieldKey]: Array.from(selected).join(" | ") };
    });
  }

  async function uploadPhotos(files: FileList | null) {
    if (!token || !files?.length) return;
    const selected = Array.from(files);
    if (attachments.length + selected.length > 10) {
      setError(`You may attach up to 10 photos. ${10 - attachments.length} more can be added.`);
      return;
    }

    setUploadingPhotos(true);
    setPhotoUploadProgress({ done: 0, total: selected.length });
    setError("");
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        const body = new FormData();
        body.append("photos", file);
        const response = await fetch(`/api/guest-forms/${encodeURIComponent(token)}/attachments`, { method: "POST", body });
        const data = await readJsonResponse<{ attachments?: Attachment[]; error?: string }>(response, `Unable to upload ${file.name || "photo"}.`);
        setAttachments(current => [...current, ...(data.attachments ?? [])]);
        setPhotoUploadProgress({ done: index + 1, total: selected.length });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload photos.");
    } finally {
      setUploadingPhotos(false);
      setPhotoUploadProgress(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !payload) return;
    setSubmitting(true);
    setError("");
    try {
      const signerName = payload.template.template_key === "minor_driver_authorization"
        ? `${values.guardian_first_name || ""} ${values.guardian_last_name || ""}`.trim()
        : payload.reservation?.customer_name || payload.task.assigned_guest_name || values.renter_full_name;
      const response = await fetch(`/api/guest-forms/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: values, signerName, signatureDataUrl: signature, agreed }),
      });
      const data = await readJsonResponse<{ error?: string; documentId?: string }>(response, "Unable to submit form.");
      setDocumentId(data.documentId || "");
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit form.");
    } finally {
      setSubmitting(false);
    }
  }

  const isDamageAcknowledgment = payload?.template.template_key === "damage_acknowledgment";
  const reservation = payload?.reservation;

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

      {isDamageAcknowledgment && reservation ? <section style={{ margin: "18px 0 22px", padding: 14, border: "1px solid #d9dee4", borderRadius: 12, background: "#f8fafc" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <div><small style={{ color: "#6b7280", fontWeight: 800 }}>RENTER</small><div style={{ fontWeight: 800 }}>{reservation.customer_name}</div></div>
          <div><small style={{ color: "#6b7280", fontWeight: 800 }}>RESERVATION</small><div style={{ fontWeight: 800 }}>{payload.task.confirmation_code}</div></div>
          <div><small style={{ color: "#6b7280", fontWeight: 800 }}>RENTAL</small><div style={{ fontWeight: 800 }}>{reservation.product_display_name}</div></div>
          <div><small style={{ color: "#6b7280", fontWeight: 800 }}>DATE / TIME</small><div style={{ fontWeight: 800 }}>{formatVisit(reservation.visit_start_time)}</div></div>
          <div><small style={{ color: "#6b7280", fontWeight: 800 }}>ADVENTURE ASSURE</small><div style={{ fontWeight: 900, color: "#9a431f" }}>{reservation.adventure_assure_level || "Not listed"}</div></div>
        </div>
      </section> : null}

      <div className={styles.fields}>{payload.template.fields_schema.map(field => {
        const value = values[field.key] || "";
        if (field.type === "textarea") return <label key={field.key}>
          <span>{field.label}{field.required ? " *" : ""}</span>
          <textarea value={value} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} required={field.required} rows={4} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cfd6de", borderRadius: 9, padding: 12, font: "inherit", resize: "vertical" }} />
        </label>;
        if (field.type === "select") return <label key={field.key}>
          <span>{field.label}{field.required ? " *" : ""}</span>
          <select value={value} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} required={field.required} style={{ width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 10px", font: "inherit", background: "#fff" }}>
            <option value="">Select…</option>{(field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>;
        if (field.type === "multicheck") {
          const selected = new Set(value.split(" | ").filter(Boolean));
          return <fieldset key={field.key} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, marginBottom: 8 }}>{field.label}{field.required ? " *" : ""}</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 7 }}>{(field.options ?? []).map(option => <label key={option} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36, padding: "6px 9px", border: "1px solid #d9dee4", borderRadius: 8, background: selected.has(option) ? "#f2fbf5" : "#fff", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(option)} onChange={event => setMultiValue(field.key, option, event.target.checked)} style={{ width: 16, height: 16, margin: 0, flex: "0 0 16px" }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{option}</span>
            </label>)}</div>
            {field.required ? <input tabIndex={-1} aria-hidden="true" value={value} onChange={() => undefined} required style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} /> : null}
          </fieldset>;
        }
        return <label key={field.key}>
          <span>{field.label}{field.required ? " *" : ""}</span>
          <input type={field.type === "date" ? "date" : "text"} value={value} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} required={field.required} />
        </label>;
      })}</div>

      {isDamageAcknowledgment ? <section style={{ marginTop: 22, padding: 16, border: "1px solid #d9dee4", borderRadius: 12, background: "#fafbfc" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Photos <span style={{ fontWeight: 500, color: "#6b7280" }}>(optional)</span></h2>
        <p style={{ margin: "6px 0 14px", color: "#5d6670", lineHeight: 1.45 }}>You may upload or take photos you would like included with this acknowledgment. Epic will separately document the vehicle damage.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "0 14px", border: "1px solid #c8d0d7", borderRadius: 9, background: "#fff", fontWeight: 800, cursor: uploadingPhotos ? "wait" : "pointer" }}>
            Choose Photos<input type="file" accept="image/*" multiple disabled={uploadingPhotos} onChange={event => { void uploadPhotos(event.target.files); event.currentTarget.value = ""; }} style={{ display: "none" }} />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "0 14px", border: "1px solid #c8d0d7", borderRadius: 9, background: "#fff", fontWeight: 800, cursor: uploadingPhotos ? "wait" : "pointer" }}>
            Take Photo<input type="file" accept="image/*" capture="environment" disabled={uploadingPhotos} onChange={event => { void uploadPhotos(event.target.files); event.currentTarget.value = ""; }} style={{ display: "none" }} />
          </label>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: attachments.length ? "#18713b" : "#6b7280", fontWeight: attachments.length ? 700 : 500 }}>
          {uploadingPhotos && photoUploadProgress
            ? `Uploading photo ${Math.min(photoUploadProgress.done + 1, photoUploadProgress.total)} of ${photoUploadProgress.total}…`
            : attachments.length
              ? `${attachments.length} photo${attachments.length === 1 ? "" : "s"} attached`
              : "No photos attached"}
        </p>
      </section> : null}

      <div className={styles.agreement} dangerouslySetInnerHTML={{ __html: payload.template.agreement_html }} />
      <label className={styles.agree}><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} /><span>{isDamageAcknowledgment ? "I have read and understand this acknowledgment and the next steps described above." : "I have read and understand this agreement and voluntarily accept its terms."}</span></label>
      {payload.template.requires_signature ? <SignaturePad onChange={setSignature} /> : null}
      {error ? <p className={styles.formError}>{error}</p> : null}
      <button className={styles.submit} type="submit" disabled={submitting || uploadingPhotos}>{submitting ? "Submitting…" : uploadingPhotos ? "Uploading Photo…" : "Sign & Submit"}</button>
      <p className={styles.privacy}>Your signature, submission time, IP address, and device information are recorded with your reservation.</p>
    </form> : null}
  </section></main>;
}