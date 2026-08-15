"use client";

import { useRef, useState } from "react";

type RentalSession = {
  confirmation_code: string;
  customer_name: string | null;
  customer_phone: string | null;
  start_time: string | null;
  experience_name: string | null;
  experience_internal_name: string | null;
  rental_terms_html: string | null;
  total_vehicle_count: number;
};

type ResponsibilityScope = "all_reservation_vehicles" | "assigned_vehicle_only";

function normalize(value: string) {
  return value.trim().replace(/\./g, "").replace(/\s+/g, " ").toLowerCase();
}

function dateValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatPhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return value.trim();
}

export default function RentalTermsForm({
  session,
  confirmation,
  token,
}: {
  session: RentalSession;
  confirmation: string;
  token: string;
}) {
  const vehicleCount = Math.max(1, Number(session.total_vehicle_count) || 1);
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [scope, setScope] = useState<ResponsibilityScope>(
    vehicleCount > 1 ? "all_reservation_vehicles" : "assigned_vehicle_only",
  );
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState<"drawn" | "typed">("drawn");
  const [typed, setTyped] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const legalName = [firstName.trim(), middleInitial.trim(), lastName.trim()].filter(Boolean).join(" ");
  const reservingPartyPhone = formatPhone(session.customer_phone);
  const activity = session.experience_name || session.experience_internal_name || "Epic 4X4 UTV Rental";
  const start = session.start_time
    ? new Date(session.start_time).toLocaleString("en-US", {
        timeZone: "America/Denver",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    c.setPointerCapture(e.pointerId);
    const p = pos(e);
    const x = c.getContext("2d")!;
    x.beginPath();
    x.moveTo(p.x, p.y);
    setDrawing(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const p = pos(e);
    const x = canvas.current!.getContext("2d")!;
    x.lineWidth = 3;
    x.lineCap = "round";
    x.strokeStyle = "#25292f";
    x.lineTo(p.x, p.y);
    x.stroke();
    setDrawn(true);
  }

  function clear() {
    const c = canvas.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
  }

  function validate() {
    if (!firstName.trim()) return "Enter the renter's first name.";
    if (!lastName.trim()) return "Enter the renter's last name.";
    if (middleInitial.trim().length > 1) return "Middle initial must be one letter.";
    if (!email.trim()) return "Enter the renter's email.";
    if (!dob) return "Enter the renter's date of birth.";
    if (!consent) return "Please consent to electronic records and signatures.";
    if (method === "typed" && (!typed.trim() || normalize(typed) !== normalize(legalName))) {
      return "Your typed signature must match the full legal name entered above.";
    }
    if (method === "drawn" && !drawn) return "Please sign in the signature box.";
    return null;
  }

  async function submit() {
    setError("");
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    const drawnPng = method === "drawn" ? canvas.current?.toDataURL("image/png") : undefined;
    const payload = {
      p_confirmation_code: confirmation,
      p_public_token: token,
      p_signer_first_name: firstName.trim(),
      p_signer_middle_initial: middleInitial.trim() || null,
      p_signer_last_name: lastName.trim(),
      p_signer_email: email.trim(),
      p_signer_phone: phone.trim(),
      p_signer_dob: dob,
      p_signature_method: method,
      p_typed_signature_name: method === "typed" ? typed.trim() : null,
      p_drawn_signature_storage_path: null,
      p_electronic_signature_consent: true,
      p_signer_user_agent: navigator.userAgent,
      p_rental_responsibility_scope: scope,
      drawn_signature_png: drawnPng,
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/waiver/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Unable to submit rental agreement.");
        return;
      }
      setSuccess("Rental Terms & Conditions submitted successfully. A copy has been emailed to you for your records. You may now close this browser window.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit rental agreement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="waiver-page">
      <div className="waiver-shell">
        <div className="waiver-brand">Epic 4X4 Adventures</div>
        <h1 className="waiver-title">UTV Rental Terms & Conditions</h1>
        <p className="waiver-subtitle">Please review the full rental agreement carefully before signing.</p>
        <div className="waiver-rule" />
        <article className="waiver-doc">
          <div className="waiver-reservation">
            <div><small>Reservation</small><h2>{session.confirmation_code}</h2></div>
            <span className="waiver-pill">Active</span>
          </div>
          <div className="waiver-details">
            <div className="waiver-detail"><small>Reserving Party</small><strong>{session.customer_name || "—"}</strong>{reservingPartyPhone ? <span>{reservingPartyPhone}</span> : null}</div>
            <div className="waiver-detail"><small>Rental</small><strong>{activity}</strong></div>
            <div className="waiver-detail"><small>Start Time</small><strong>{start}</strong></div>
          </div>

          <section className="waiver-section">
            <div className="waiver-eyebrow">01 · Renter Information</div>
            <h3>Responsible Renter</h3>
            <div className="waiver-name-grid">
              <label className="waiver-field">First name<input className="waiver-input" value={firstName} onChange={e => setFirstName(e.target.value)} /></label>
              <label className="waiver-field waiver-mi-field">MI<input className="waiver-input" maxLength={1} value={middleInitial} onChange={e => setMiddleInitial(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase())} /></label>
              <label className="waiver-field">Last name<input className="waiver-input" value={lastName} onChange={e => setLastName(e.target.value)} /></label>
            </div>
            <div className="waiver-grid waiver-contact-grid">
              <label className="waiver-field">Email<input className="waiver-input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
              <label className="waiver-field">Phone<input className="waiver-input" value={phone} onChange={e => setPhone(e.target.value)} /></label>
              <label className="waiver-field">Date of birth<input className="waiver-input" type="date" value={dob} onChange={e => setDob(e.target.value)} /></label>
            </div>
          </section>

          <section className="waiver-section">
            <div className="waiver-eyebrow">02 · Rental Terms & Conditions</div>
            <div className="waiver-legal" dangerouslySetInnerHTML={{ __html: session.rental_terms_html || "" }} />
          </section>

          {vehicleCount > 1 ? (
            <section className="waiver-section">
              <div className="waiver-eyebrow">03 · Financial Responsibility</div>
              <h3>This reservation includes {vehicleCount} vehicles.</h3>
              <p>Select the responsibility that applies to this signed agreement.</p>
              <label className="waiver-choice">
                <input type="radio" name="rentalScope" checked={scope === "all_reservation_vehicles"} onChange={() => setScope("all_reservation_vehicles")} />
                I accept full financial responsibility for all {vehicleCount} vehicles associated with this reservation unless separate signed Rental Terms & Conditions are completed by another responsible renter for a specific vehicle.
              </label>
              <label className="waiver-choice">
                <input type="radio" name="rentalScope" checked={scope === "assigned_vehicle_only"} onChange={() => setScope("assigned_vehicle_only")} />
                I am accepting financial responsibility only for the vehicle assigned to me at check-out.
              </label>
            </section>
          ) : null}

          <section className="waiver-section">
            <div className="waiver-eyebrow">{vehicleCount > 1 ? "04" : "03"} · Electronic Signature</div>
            <h3>Sign & Complete</h3>
            <p>Your signature applies to the complete UTV Rental Terms & Conditions above.</p>
            <div className="waiver-consent-card">
              <label className="waiver-consent">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
                <span><strong>I AGREE TO CONDUCT THIS TRANSACTION ELECTRONICALLY.</strong><span className="waiver-consent-text">By checking this box and signing electronically below, I expressly consent to conduct this transaction electronically. I agree that my electronic signature, whether created by touchscreen signature or typed name, is intended by me to have the same legal validity, enforceability, and binding effect as my handwritten signature on a paper agreement.</span></span>
              </label>
            </div>
            <div className="waiver-signature-panel">
              {method === "drawn" ? <>
                <div className="waiver-signature-head"><div><strong>Sign Here</strong><p>Use your finger, mouse, or trackpad.</p></div>{drawn && <span className="waiver-signature-ready">Signature captured</span>}</div>
                <div className="waiver-canvas-wrap"><canvas ref={canvas} width={900} height={220} className="waiver-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={() => setDrawing(false)} onPointerCancel={() => setDrawing(false)} /></div>
                <div className="waiver-signature-actions"><button className="waiver-button waiver-secondary" type="button" onClick={clear}>Clear Signature</button><button className="waiver-link-button" type="button" onClick={() => { clear(); setMethod("typed"); }}>Prefer to type your signature instead?</button></div>
              </> : <>
                <label className="waiver-field">Type your full legal name exactly as entered above<input className="waiver-input" value={typed} onChange={e => setTyped(e.target.value)} /></label>
                <p>Must match: <strong>{legalName || "your renter name above"}</strong></p>
                <button className="waiver-link-button" type="button" onClick={() => { setTyped(""); setMethod("drawn"); }}>Prefer to draw your signature instead?</button>
              </>}
            </div>
            <label className="waiver-field waiver-date">Date<input className="waiver-input" type="date" value={dateValue()} readOnly /></label>
          </section>

          {error && <div className="waiver-alert">{error}</div>}
          {success && <div className="waiver-success">{success}</div>}
          <section className="waiver-section">
            <button className="waiver-button waiver-submit" type="button" onClick={submit} disabled={Boolean(success) || submitting}>{submitting ? "Submitting Agreement…" : "Complete Rental Agreement"}</button>
          </section>
        </article>
      </div>
    </main>
  );
}
