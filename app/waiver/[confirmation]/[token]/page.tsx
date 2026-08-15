"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Session = {
  confirmation_code: string;
  customer_name: string | null;
  customer_phone: string | null;
  start_time: string | null;
  experience_name: string | null;
  experience_internal_name: string | null;
  participant_agreement_html: string | null;
  headgear_warning_html: string | null;
  driver_agreement_html: string | null;
  minor_indemnification_html: string | null;
  adult_signature_count: number;
  minor_covered_count: number;
  covered_participant_count: number;
};

type Minor = { first_name: string; last_name: string; dob: string };

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

export default function WaiverPage() {
  const params = useParams<{ confirmation: string; token: string }>();
  const confirmation = decodeURIComponent(params.confirmation);
  const token = decodeURIComponent(params.token);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [risk, setRisk] = useState("");
  const [helmet, setHelmet] = useState("");
  const [willDrive, setWillDrive] = useState<boolean | null>(null);
  const [driver, setDriver] = useState("");
  const [hasMinors, setHasMinors] = useState(false);
  const [minorInitials, setMinorInitials] = useState("");
  const [minors, setMinors] = useState<Minor[]>([{ first_name: "", last_name: "", dob: "" }]);
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState<"drawn" | "typed">("drawn");
  const [typed, setTyped] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const legalName = [firstName.trim(), middleInitial.trim(), lastName.trim()].filter(Boolean).join(" ");

  useEffect(() => {
    fetch(`/api/waiver/${encodeURIComponent(confirmation)}/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Unable to load waiver.");
        setSession(json.session);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [confirmation, token]);

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

  function up() {
    setDrawing(false);
  }

  function clear() {
    const c = canvas.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
  }

  function addMinor() {
    setMinors((v) => [...v, { first_name: "", last_name: "", dob: "" }]);
  }

  function updateMinor(i: number, k: keyof Minor, v: string) {
    setMinors((m) => m.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  }

  function validate() {
    if (!firstName.trim()) return "Enter the participant's first name.";
    if (!lastName.trim()) return "Enter the participant's last name.";
    if (middleInitial.trim().length > 1) return "Middle initial must be one letter.";
    if (!email.trim()) return "Enter the participant's email.";
    if (!dob) return "Enter the participant's date of birth.";
    if (!risk.trim()) return "Participant Agreement initials are required.";
    if (!helmet.trim()) return "Headgear Warning initials are required.";
    if (willDrive === null) return "Please indicate whether you will be driving.";
    if (willDrive && !driver.trim()) return "Driver Agreement initials are required for drivers.";
    if (hasMinors && (!minorInitials.trim() || minors.some((m) => !m.first_name.trim() || !m.last_name.trim() || !m.dob))) {
      return "Complete the parent/guardian acknowledgement and each child's information.";
    }
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
      p_risk_initials: risk,
      p_helmet_initials: helmet,
      p_will_drive: willDrive,
      p_driver_terms_initials: willDrive ? driver : null,
      p_has_minors: hasMinors,
      p_minor_authority_initials: hasMinors ? minorInitials : null,
      p_signature_method: method,
      p_typed_signature_name: method === "typed" ? typed.trim() : null,
      p_drawn_signature_storage_path: null,
      p_electronic_signature_consent: true,
      p_signer_user_agent: navigator.userAgent,
      p_minors: hasMinors ? minors : [],
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
        setError(json.error || "Unable to submit waiver.");
        return;
      }
      setSuccess("Waiver submitted successfully. A copy has been emailed to you for your records. You may now close this browser window.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit waiver.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="waiver-page"><div className="waiver-shell waiver-status">Loading waiver…</div></main>;
  if (!session) return <main className="waiver-page"><div className="waiver-shell waiver-status">{error || "Waiver not found."}</div></main>;

  const activity = session.experience_name || session.experience_internal_name || "Epic 4X4 Adventure";
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

  return <main className="waiver-page"><div className="waiver-shell"><div className="waiver-brand">Epic 4X4 Adventures</div><h1 className="waiver-title">Participant Waiver</h1><p className="waiver-subtitle">Please review each section carefully and complete all required acknowledgements.</p><div className="waiver-rule"/><article className="waiver-doc"><div className="waiver-reservation"><div><small>Reservation</small><h2>{session.confirmation_code}</h2></div><span className="waiver-pill">Active</span></div><div className="waiver-details"><div className="waiver-detail"><small>Reserving Party</small><strong>{session.customer_name || "—"}</strong>{reservingPartyPhone ? <span>{reservingPartyPhone}</span> : null}</div><div className="waiver-detail"><small>Activity</small><strong>{activity}</strong></div><div className="waiver-detail"><small>Start Time</small><strong>{start}</strong></div></div>
  <section className="waiver-section"><div className="waiver-eyebrow">01 · Participant Information</div><h3>Adult Participant</h3><div className="waiver-name-grid"><label className="waiver-field">First name<input className="waiver-input" value={firstName} onChange={e => setFirstName(e.target.value)}/></label><label className="waiver-field waiver-mi-field">MI<input className="waiver-input" maxLength={1} value={middleInitial} onChange={e => setMiddleInitial(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase())}/></label><label className="waiver-field">Last name<input className="waiver-input" value={lastName} onChange={e => setLastName(e.target.value)}/></label></div><div className="waiver-grid waiver-contact-grid"><label className="waiver-field">Email<input className="waiver-input" type="email" value={email} onChange={e => setEmail(e.target.value)}/></label><label className="waiver-field">Phone<input className="waiver-input" value={phone} onChange={e => setPhone(e.target.value)}/></label><label className="waiver-field">Date of birth<input className="waiver-input" type="date" value={dob} onChange={e => setDob(e.target.value)}/></label></div></section>
  <section className="waiver-section"><div className="waiver-eyebrow">02 · Participant Agreement</div><div className="waiver-legal" dangerouslySetInnerHTML={{__html: session.participant_agreement_html || ""}}/><label className="waiver-initial"><span>I have read and agree to the Participant Agreement.</span><input className="waiver-input" placeholder="Initials" maxLength={8} value={risk} onChange={e => setRisk(e.target.value)}/></label></section>
  <section className="waiver-section"><div className="waiver-eyebrow">03 · Headgear Warning</div><div className="waiver-legal" dangerouslySetInnerHTML={{__html: session.headgear_warning_html || ""}}/><label className="waiver-initial"><span>I have read and understand the Headgear Warning.</span><input className="waiver-input" placeholder="Initials" maxLength={8} value={helmet} onChange={e => setHelmet(e.target.value)}/></label></section>
  <section className="waiver-section"><div className="waiver-eyebrow">04 · Driver Agreement</div><h3>Will you be driving?</h3><label className="waiver-choice"><input type="radio" checked={willDrive === true} onChange={() => setWillDrive(true)}/>Yes, I will be driving.</label><label className="waiver-choice"><input type="radio" checked={willDrive === false} onChange={() => {setWillDrive(false); setDriver("")}}/>I am a passenger only. I will not be driving.</label>{willDrive === true && <><div className="waiver-legal" dangerouslySetInnerHTML={{__html: session.driver_agreement_html || ""}}/><label className="waiver-initial"><span>I have read and agree to the Driver Agreement and driving requirements stated above.</span><input className="waiver-input" placeholder="Initials" maxLength={8} value={driver} onChange={e => setDriver(e.target.value)}/></label></>}</section>
  <section className="waiver-section"><div className="waiver-eyebrow">05 · Minor Children</div><h3>Are any children under 18 participating with you?</h3><label className="waiver-choice"><input type="radio" name="hasMinors" checked={!hasMinors} onChange={() => {setHasMinors(false); setMinorInitials("")}}/>No children under 18 are participating with me.</label><label className="waiver-choice"><input type="radio" name="hasMinors" checked={hasMinors} onChange={() => setHasMinors(true)}/>Yes, children under 18 are participating with me.</label>{hasMinors && <div className="waiver-minor"><div className="waiver-minor-ack"><div className="waiver-minor-heading">PARENT / LEGAL GUARDIAN ACKNOWLEDGEMENT</div><p>I am the parent or legal guardian of the minor participant(s) identified below. I understand that participation in this activity involves inherent and potentially serious risks, including the risk of property damage, serious bodily injury, or death.</p><p>Epic 4X4 Adventures cannot independently know or assess every factor affecting whether participation is appropriate for my child, including my child's maturity, judgment, physical condition, emotional readiness, abilities, limitations, or comfort with the activity. I understand that Epic 4X4 Adventures is relying on my knowledge of my child and on my sound judgment in deciding whether my child should participate.</p><p><strong>After considering the nature of the activity and the risks described in this Agreement, I knowingly and voluntarily choose to permit the minor participant(s) identified below to participate. I understand that the decision to allow my child to participate is mine as their parent or legal guardian.</strong></p><p><strong>To the fullest extent permitted by Utah law, I knowingly and voluntarily waive, release, and relinquish any claims or rights that I, individually and in my capacity as parent or legal guardian, may lawfully waive or release arising from or related to my decision to permit the minor participant(s) identified below to participate in this activity.</strong> Nothing in this Agreement is intended to waive or release any claim or legal right belonging exclusively to a minor that Utah law does not permit a parent or guardian to waive.</p></div><label className="waiver-initial"><span>I have read and understand the Parent / Legal Guardian Acknowledgement above.</span><input className="waiver-input" placeholder="Initials" maxLength={8} value={minorInitials} onChange={e => setMinorInitials(e.target.value)}/></label><div className="waiver-minor-heading waiver-minor-list-heading">MINOR PARTICIPANT(S)</div>{minors.map((m, i) => <div className="waiver-minor-row" key={i}><label className="waiver-field">Child first name<input className="waiver-input" value={m.first_name} onChange={e => updateMinor(i, "first_name", e.target.value)}/></label><label className="waiver-field">Child last name<input className="waiver-input" value={m.last_name} onChange={e => updateMinor(i, "last_name", e.target.value)}/></label><label className="waiver-field">Child date of birth<input className="waiver-input" type="date" value={m.dob} onChange={e => updateMinor(i, "dob", e.target.value)}/></label></div>)}<button className="waiver-button waiver-secondary" type="button" onClick={addMinor}>Add another child</button></div>}</section>
  <section className="waiver-section"><div className="waiver-eyebrow">06 · Electronic Signature</div><h3>Sign & Complete</h3><p>Review the electronic signature consent below, then sign using your finger, mouse, trackpad, or typed legal name.</p><div className="waiver-consent-card"><label className="waiver-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span><strong>I AGREE TO CONDUCT THIS TRANSACTION ELECTRONICALLY.</strong><span className="waiver-consent-text">By checking this box and signing electronically below, I expressly consent to conduct this transaction electronically. I agree that my electronic signature, whether created by touchscreen signature or typed name, is intended by me to have the same legal validity, enforceability, and binding effect as my handwritten signature on a paper agreement.</span></span></label></div><div className="waiver-signature-panel">{method === "drawn" ? <><div className="waiver-signature-head"><div><strong>Sign Here</strong><p>Use your finger, mouse, or trackpad.</p></div>{drawn && <span className="waiver-signature-ready">Signature captured</span>}</div><div className="waiver-canvas-wrap"><canvas ref={canvas} width={900} height={220} className="waiver-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/></div><div className="waiver-signature-actions"><button className="waiver-button waiver-secondary" type="button" onClick={clear}>Clear Signature</button><button className="waiver-link-button" type="button" onClick={() => {clear(); setMethod("typed")}}>Prefer to type your signature instead?</button></div></> : <><label className="waiver-field">Type your full legal name exactly as entered above<input className="waiver-input" value={typed} onChange={e => setTyped(e.target.value)}/></label><p>Must match: <strong>{legalName || "your participant name above"}</strong></p><button className="waiver-link-button" type="button" onClick={() => {setTyped(""); setMethod("drawn")}}>Prefer to draw your signature instead?</button></>}</div><label className="waiver-field waiver-date">Date<input className="waiver-input" type="date" value={dateValue()} readOnly/></label></section>
  {error && <div className="waiver-alert">{error}</div>}{success && <div className="waiver-success">{success}</div>}<section className="waiver-section"><button className="waiver-button waiver-submit" type="button" onClick={submit} disabled={Boolean(success) || submitting}>{submitting ? "Submitting Waiver…" : "Complete Waiver"}</button></section></article></div></main>;
}
