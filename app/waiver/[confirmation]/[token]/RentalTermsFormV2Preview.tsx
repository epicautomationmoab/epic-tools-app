"use client";

import { useMemo, useRef, useState } from "react";
import {
  RENTAL_V2_DRIVER_HTML,
  RENTAL_V2_MINOR_ACK_HTML,
  RENTAL_V2_PASSENGER_HTML,
} from "@/lib/rental-agreement-v2-content";

type RentalSession = {
  confirmation_code: string;
  customer_name: string | null;
  customer_phone: string | null;
  start_time: string | null;
  experience_name: string | null;
  experience_internal_name: string | null;
  rental_terms_html: string | null;
  total_vehicle_count: number;
  guest_portal_token?: string | null;
};

type Role = "driver" | "passenger";
type Minor = { firstName: string; lastName: string; dob: string; relationship: string };


function formatPhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  return value.trim();
}

function emptyMinor(): Minor {
  return { firstName: "", lastName: "", dob: "", relationship: "" };
}

export default function RentalTermsFormV2Preview({
  session,
  confirmation,
  token,
  writeEnabled = false,
}: {
  session: RentalSession;
  confirmation: string;
  token: string;
  writeEnabled?: boolean;
}) {
  const vehicleCount = Math.max(1, Number(session.total_vehicle_count) || 1);
  const [role, setRole] = useState<Role | null>(null);
  const [hasMinors, setHasMinors] = useState<boolean | null>(null);
  const [minors, setMinors] = useState<Minor[]>([emptyMinor()]);
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState<"drawn" | "typed">("drawn");
  const [typedSignature, setTypedSignature] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [signatureError, setSignatureError] = useState("");
  const [signatureSuccess, setSignatureSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const signatureCanvas = useRef<HTMLCanvasElement | null>(null);

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
  const reservingPartyPhone = formatPhone(session.customer_phone);
  const signerLabel = role === "driver" ? "Driver" : "Passenger";

  const summary = useMemo(() => {
    if (!role) return "Choose Driver or Passenger to preview the agreement flow.";
    const parts = [signerLabel];
    if (hasMinors) parts.push(`${minors.length} minor participant${minors.length === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }, [role, signerLabel, hasMinors, minors.length]);

  function chooseRole(nextRole: Role) {
    setRole(nextRole);
  }

  function addMinor() {
    setMinors((current) => [...current, emptyMinor()]);
  }

  function removeMinor(index: number) {
    setMinors((current) => current.length === 1 ? current : current.filter((_, i) => i !== index));
  }

  function updateMinor(index: number, key: keyof Minor, value: string) {
    setMinors((current) => current.map((minor, i) => i === index ? { ...minor, [key]: value } : minor));
  }

  const legalName = [firstName.trim(), middleInitial.trim(), lastName.trim()].filter(Boolean).join(" ");

  function normalizeSignature(value: string) {
    return value.trim().replace(/\./g, "").replace(/\s+/g, " ").toLowerCase();
  }

  function signaturePosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvas.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function beginSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvas.current!;
    canvas.setPointerCapture(event.pointerId);
    const point = signaturePosition(event);
    const context = canvas.getContext("2d")!;
    context.beginPath();
    context.moveTo(point.x, point.y);
    setDrawing(true);
    setSignatureError("");
    setSignatureSuccess("");
  }

  function drawSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const point = signaturePosition(event);
    const context = signatureCanvas.current!.getContext("2d")!;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#25292f";
    context.lineTo(point.x, point.y);
    context.stroke();
    setDrawn(true);
  }

  function endSignature(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event && signatureCanvas.current?.hasPointerCapture(event.pointerId)) {
      signatureCanvas.current.releasePointerCapture(event.pointerId);
    }
    setDrawing(false);
  }

  function clearSignature() {
    const canvas = signatureCanvas.current;
    setDrawing(false);
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.beginPath();
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDrawn(false);
    setSignatureError("");
    setSignatureSuccess("");
  }

  function validateSignature() {
    setSignatureError("");
    setSignatureSuccess("");
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !dob) {
      setSignatureError("Complete the participant information before signing.");
      return false;
    }
    if (hasMinors === null) {
      setSignatureError("Please answer the Minor Participants question.");
      return false;
    }
    if (hasMinors && minors.some((minor) => !minor.firstName.trim() || !minor.lastName.trim() || !minor.dob || !minor.relationship.trim())) {
      setSignatureError("Complete all information for each minor participant.");
      return false;
    }
    if (!acknowledged) {
      setSignatureError("Please acknowledge the agreement before signing.");
      return false;
    }
    if (signatureMethod === "drawn" && !drawn) {
      setSignatureError("Please sign in the signature box.");
      return false;
    }
    if (signatureMethod === "typed" && normalizeSignature(typedSignature) !== normalizeSignature(legalName)) {
      setSignatureError("Your typed signature must match the full legal name entered above.");
      return false;
    }
    return true;
  }

  async function handleSignatureAction() {
    if (!validateSignature()) return;

    if (!writeEnabled) {
      setSignatureSuccess("Signature captured and V2 form validation passed. Preview mode does not record or submit this agreement.");
      return;
    }

    setSubmitting(true);
    setSignatureError("");
    setSignatureSuccess("");

    try {
      const drawnSignaturePng =
        signatureMethod === "drawn"
          ? signatureCanvas.current?.toDataURL("image/png") ?? null
          : null;

      const response = await fetch("/api/waiver/submit-rental-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_confirmation_code: confirmation,
          p_public_token: token,
          p_signer_first_name: firstName.trim(),
          p_signer_middle_initial: middleInitial.trim() || null,
          p_signer_last_name: lastName.trim(),
          p_signer_email: email.trim(),
          p_signer_phone: phone.trim() || null,
          p_signer_dob: dob,
          p_rental_role: role,
          p_has_minors: hasMinors === true,
          p_minors: hasMinors ? minors : [],
          p_signature_method: signatureMethod,
          p_typed_signature_name:
            signatureMethod === "typed" ? typedSignature.trim() : null,
          drawn_signature_png: drawnSignaturePng,
          p_electronic_signature_consent: acknowledged,
          p_preview_write: true,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to submit the V2 test agreement.");
      }

      const pdfStatus = result?.pdfGenerated
        ? " Signed PDF generated."
        : result?.pdfError
          ? ` Agreement saved, but PDF generation needs review: ${result.pdfError}`
          : "";
      const emailStatus =
        result?.copyEmailStatus === "sent"
          ? " Signed copy emailed."
          : result?.copyEmailStatus === "failed"
            ? ` Email delivery needs review: ${result.copyEmailError || "unknown error"}`
            : "";

      const successMessage =
        `V2 test agreement recorded successfully.${pdfStatus}${emailStatus}`;
      setSignatureSuccess(successMessage);

      if (session.guest_portal_token) {
        setSignatureSuccess(
          "Agreement submitted successfully. A signed copy has been emailed to you. Returning you to your Guest Portal…",
        );
        window.setTimeout(() => {
          window.location.assign(
            `/guest/${encodeURIComponent(session.guest_portal_token!)}`,
          );
        }, 1200);
        return;
      }

      setSignatureSuccess(
        `${successMessage} You may now close this browser window.`,
      );
    } catch (error) {
      setSignatureError(
        error instanceof Error
          ? error.message
          : "Unable to submit the V2 test agreement.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="waiver-page">
      <div className="waiver-shell">
        <div className="waiver-brand">Epic 4X4 Adventures</div>
        <h1 className="waiver-title">UTV Rental Agreement V2</h1>
        <p className="waiver-subtitle">
          {writeEnabled
            ? "CONTROLLED V2 TEST — this submission will be recorded in Epic's production legal-document system for testing."
            : "PREVIEW ONLY — this version does not replace the current live rental agreement and cannot be submitted."}
        </p>
        <div className="waiver-rule" />
        <article className="waiver-doc">
          <div className="waiver-reservation">
            <div><small>Reservation</small><h2>{session.confirmation_code}</h2></div>
            <span className="waiver-pill">V2 Preview</span>
          </div>
          <div className="waiver-details">
            <div className="waiver-detail"><small>Booking Contact</small><strong>{session.customer_name || "—"}</strong>{reservingPartyPhone ? <span>{reservingPartyPhone}</span> : null}</div>
            <div className="waiver-detail"><small>Rental</small><strong>{activity}</strong></div>
            <div className="waiver-detail"><small>Start Time</small><strong>{start}</strong></div>
          </div>

          <section className="waiver-section">
            <div className="waiver-eyebrow">01 · Your Role</div>
            <h3>How are you participating in this rental?</h3>
            <label className="waiver-choice">
              <input type="radio" name="role" checked={role === "driver"} onChange={() => chooseRole("driver")} />
              <span><strong>Driver</strong><br />I will operate an Epic vehicle during this rental.</span>
            </label>
            <label className="waiver-choice">
              <input type="radio" name="role" checked={role === "passenger"} onChange={() => chooseRole("passenger")} />
              <span><strong>Passenger</strong><br />I will participate as a passenger and will not operate an Epic vehicle during this rental.</span>
            </label>
            <p><small>This reservation includes {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"}. Readiness will require at least {vehicleCount} signed Driver{vehicleCount === 1 ? "" : "s"} before the rental is ready.</small></p>
          </section>

          {role ? <>
            <section className="waiver-section">
              <div className="waiver-eyebrow">02 · Participant Information</div>
              <h3>{signerLabel}</h3>
              <div className="waiver-name-grid">
                <label className="waiver-field">First name<input className="waiver-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
                <label className="waiver-field waiver-mi-field">MI<input className="waiver-input" maxLength={1} value={middleInitial} onChange={(e) => setMiddleInitial(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase())} /></label>
                <label className="waiver-field">Last name<input className="waiver-input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
              </div>
              <div className="waiver-grid waiver-contact-grid">
                <label className="waiver-field">Email<input className="waiver-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                <label className="waiver-field">Phone<input className="waiver-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
                <label className="waiver-field">Date of birth<input className="waiver-input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></label>
              </div>
            </section>

            <section className="waiver-section">
              <div className="waiver-eyebrow">03 · Rental Agreement</div>

              {role === "driver" ? <>
                <div className="waiver-legal" dangerouslySetInnerHTML={{ __html: RENTAL_V2_DRIVER_HTML }} />
                <p><small><strong>Preview note:</strong> This is Epic's V2 Driver agreement language for internal review and attorney review. Production remains unchanged.</small></p>
              </> : <>
                <div className="waiver-legal" dangerouslySetInnerHTML={{ __html: RENTAL_V2_PASSENGER_HTML }} />
                <p><small><strong>Preview note:</strong> This is Epic's V2 Passenger agreement language for internal review and attorney review. Production remains unchanged.</small></p>
              </>}
            </section>

            <section className="waiver-section">
              <div className="waiver-eyebrow">04 · Minor Participants</div>
              <h3>Are you the parent or legal guardian of any minor participant(s) on this reservation?</h3>
              <label className="waiver-choice"><input type="radio" name="minors" checked={hasMinors === false} onChange={() => setHasMinors(false)} />No.</label>
              <label className="waiver-choice"><input type="radio" name="minors" checked={hasMinors === true} onChange={() => setHasMinors(true)} />Yes.</label>

              {hasMinors ? <div className="waiver-minor">
                <div className="waiver-minor-ack">
                  <div className="waiver-minor-heading">PARENT / LEGAL GUARDIAN ACKNOWLEDGMENT</div>
                  <div dangerouslySetInnerHTML={{ __html: RENTAL_V2_MINOR_ACK_HTML }} />
                </div>
                {minors.map((minor, index) => <div key={index} className="waiver-section">
                  <div className="waiver-minor-heading">Minor Participant {index + 1}</div>
                  <div className="waiver-grid waiver-contact-grid">
                    <label className="waiver-field">First name<input className="waiver-input" value={minor.firstName} onChange={(e) => updateMinor(index, "firstName", e.target.value)} /></label>
                    <label className="waiver-field">Last name<input className="waiver-input" value={minor.lastName} onChange={(e) => updateMinor(index, "lastName", e.target.value)} /></label>
                    <label className="waiver-field">Date of birth<input className="waiver-input" type="date" value={minor.dob} onChange={(e) => updateMinor(index, "dob", e.target.value)} /></label>
                    <label className="waiver-field">Relationship<input className="waiver-input" value={minor.relationship} onChange={(e) => updateMinor(index, "relationship", e.target.value)} /></label>
                  </div>
                  {minors.length > 1 ? <button type="button" className="waiver-link-button" onClick={() => removeMinor(index)}>Remove this minor</button> : null}
                </div>)}
                <button type="button" className="waiver-button waiver-secondary" onClick={addMinor}>Add Another Minor</button>
              </div> : null}
            </section>

            <section className="waiver-section">
              <div className="waiver-eyebrow">05 · Acknowledgment & Signature</div>
              <label className="waiver-consent">
                <input type="checkbox" checked={acknowledged} onChange={(e) => { setAcknowledged(e.target.checked); setSignatureError(""); setSignatureSuccess(""); }} />
                <span>
                  <strong>I AGREE TO CONDUCT THIS TRANSACTION ELECTRONICALLY.</strong>
                  <span className="waiver-consent-text"> By checking this box and signing electronically below, I confirm that I have reviewed the agreement applicable to my selected role and intend my electronic signature to have the same legal validity and binding effect as my handwritten signature.</span>
                </span>
              </label>
              <div className="waiver-consent-card"><strong>{summary}</strong></div>

              <div className="waiver-signature-panel">
                {signatureMethod === "drawn" ? <>
                  <div className="waiver-signature-head">
                    <div><strong>Sign Here</strong><p>Use your finger, mouse, or trackpad.</p></div>
                    {drawn ? <span className="waiver-signature-ready">Signature captured</span> : null}
                  </div>
                  <div className="waiver-canvas-wrap">
                    <canvas
                      ref={signatureCanvas}
                      width={900}
                      height={220}
                      className="waiver-canvas"
                      onPointerDown={beginSignature}
                      onPointerMove={drawSignature}
                      onPointerUp={endSignature}
                      onPointerCancel={endSignature}
                      onPointerLeave={endSignature}
                    />
                  </div>
                  <div className="waiver-signature-actions">
                    <button className="waiver-button waiver-secondary" type="button" onClick={clearSignature}>Clear Signature</button>
                    <button className="waiver-link-button" type="button" onClick={() => { clearSignature(); setSignatureMethod("typed"); }}>Prefer to type your signature instead?</button>
                  </div>
                </> : <>
                  <label className="waiver-field">Type your full legal name exactly as entered above
                    <input className="waiver-input" value={typedSignature} onChange={(e) => { setTypedSignature(e.target.value); setSignatureError(""); setSignatureSuccess(""); }} />
                  </label>
                  <p>Must match: <strong>{legalName || "your participant name above"}</strong></p>
                  <button className="waiver-link-button" type="button" onClick={() => { setTypedSignature(""); setSignatureMethod("drawn"); setSignatureError(""); setSignatureSuccess(""); }}>Prefer to draw your signature instead?</button>
                </>}
              </div>

              {signatureError ? <div className="waiver-alert">{signatureError}</div> : null}
              {signatureSuccess ? <div className="waiver-success">{signatureSuccess}</div> : null}
              <p>
                <strong>{writeEnabled ? "Controlled test:" : "Preview safety:"}</strong>{" "}
                {writeEnabled
                  ? "This test path records the agreement, generates the V2 PDF, emails the signer copy, and feeds the V2 readiness counts."
                  : "The signature experience is wired in and validated, but this preview does not write a signature to the database, generate a legal PDF, email a copy, or affect Guest Readiness."}
              </p>
              <button
                type="button"
                className="waiver-button waiver-submit"
                onClick={handleSignatureAction}
                disabled={submitting}
              >
                {submitting
                  ? "Submitting V2 Test..."
                  : writeEnabled
                    ? "Submit V2 Test Agreement"
                    : "Validate Signature — Preview Only"}
              </button>
            </section>
          </> : null}
        </article>
      </div>
    </main>
  );
}
