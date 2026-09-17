"use client";

import { useMemo, useState } from "react";

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

type Role = "responsible_party" | "adult_participant";
type ResponsibilityScope = "all_reservation_vehicles" | "assigned_vehicle_only";
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

export default function RentalTermsFormV2Preview({ session }: { session: RentalSession }) {
  const vehicleCount = Math.max(1, Number(session.total_vehicle_count) || 1);
  const [role, setRole] = useState<Role | null>(null);
  const [willDrive, setWillDrive] = useState<boolean | null>(null);
  const [scope, setScope] = useState<ResponsibilityScope>(vehicleCount > 1 ? "all_reservation_vehicles" : "assigned_vehicle_only");
  const [hasMinors, setHasMinors] = useState<boolean | null>(null);
  const [minors, setMinors] = useState<Minor[]>([emptyMinor()]);
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

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

  const signerLabel = role === "responsible_party" ? "Responsible Party" : "Adult Participant";
  const summary = useMemo(() => {
    if (!role) return "Choose a role to preview the agreement flow.";
    const parts = [signerLabel];
    if (willDrive === true) parts.push("Authorized Driver");
    if (willDrive === false) parts.push("Passenger Only");
    if (hasMinors) parts.push(`${minors.length} minor participant${minors.length === 1 ? "" : "s"}`);
    if (role === "responsible_party") {
      parts.push(scope === "all_reservation_vehicles" ? "Responsible for all reservation vehicles" : "Responsible for assigned vehicle only");
    }
    return parts.join(" · ");
  }, [role, signerLabel, willDrive, hasMinors, minors.length, scope]);

  function addMinor() {
    setMinors((current) => [...current, emptyMinor()]);
  }

  function removeMinor(index: number) {
    setMinors((current) => current.length === 1 ? current : current.filter((_, i) => i !== index));
  }

  function updateMinor(index: number, key: keyof Minor, value: string) {
    setMinors((current) => current.map((minor, i) => i === index ? { ...minor, [key]: value } : minor));
  }

  return (
    <main className="waiver-page">
      <div className="waiver-shell">
        <div className="waiver-brand">Epic 4X4 Adventures</div>
        <h1 className="waiver-title">UTV Rental Agreement V2</h1>
        <p className="waiver-subtitle">PREVIEW ONLY — this version does not replace the current live rental agreement and cannot be submitted.</p>
        <div className="waiver-rule" />
        <article className="waiver-doc">
          <div className="waiver-reservation">
            <div><small>Reservation</small><h2>{session.confirmation_code}</h2></div>
            <span className="waiver-pill">V2 Preview</span>
          </div>
          <div className="waiver-details">
            <div className="waiver-detail"><small>Reserving Party</small><strong>{session.customer_name || "—"}</strong>{reservingPartyPhone ? <span>{reservingPartyPhone}</span> : null}</div>
            <div className="waiver-detail"><small>Rental</small><strong>{activity}</strong></div>
            <div className="waiver-detail"><small>Start Time</small><strong>{start}</strong></div>
          </div>

          <section className="waiver-section">
            <div className="waiver-eyebrow">01 · Your Role</div>
            <h3>How are you participating in this rental?</h3>
            <label className="waiver-choice">
              <input type="radio" name="role" checked={role === "responsible_party"} onChange={() => setRole("responsible_party")} />
              <span><strong>Responsible Party</strong><br />I am accepting financial and contractual responsibility for one or more vehicles on this reservation.</span>
            </label>
            <label className="waiver-choice">
              <input type="radio" name="role" checked={role === "adult_participant"} onChange={() => setRole("adult_participant")} />
              <span><strong>Other Adult Participant</strong><br />I am participating as a driver or passenger but am not accepting Responsible Party financial obligations by signing this agreement.</span>
            </label>
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

            {role === "responsible_party" && vehicleCount > 1 ? (
              <section className="waiver-section">
                <div className="waiver-eyebrow">03 · Responsibility Scope</div>
                <h3>This reservation includes {vehicleCount} vehicles.</h3>
                <p>Choose the scope of financial and contractual responsibility you are accepting.</p>
                <label className="waiver-choice"><input type="radio" name="scope" checked={scope === "all_reservation_vehicles"} onChange={() => setScope("all_reservation_vehicles")} />I accept responsibility for <strong>all vehicles on this reservation</strong>.</label>
                <label className="waiver-choice"><input type="radio" name="scope" checked={scope === "assigned_vehicle_only"} onChange={() => setScope("assigned_vehicle_only")} />I accept responsibility <strong>only for the vehicle assigned to me at checkout</strong>.</label>
              </section>
            ) : null}

            <section className="waiver-section">
              <div className="waiver-eyebrow">{role === "responsible_party" && vehicleCount > 1 ? "04" : "03"} · Driver Status</div>
              <h3>Will you operate a vehicle?</h3>
              <label className="waiver-choice"><input type="radio" name="driver" checked={willDrive === true} onChange={() => setWillDrive(true)} />Yes — I will be an Authorized Driver.</label>
              <label className="waiver-choice"><input type="radio" name="driver" checked={willDrive === false} onChange={() => setWillDrive(false)} />No — I will participate as a passenger only.</label>
            </section>

            <section className="waiver-section">
              <div className="waiver-eyebrow">{role === "responsible_party" && vehicleCount > 1 ? "05" : "04"} · Minor Participants</div>
              <h3>Are you the parent or legal guardian of any minor participant(s) on this reservation?</h3>
              <label className="waiver-choice"><input type="radio" name="minors" checked={hasMinors === false} onChange={() => setHasMinors(false)} />No.</label>
              <label className="waiver-choice"><input type="radio" name="minors" checked={hasMinors === true} onChange={() => setHasMinors(true)} />Yes.</label>

              {hasMinors ? <div className="waiver-minor">
                <div className="waiver-minor-ack">
                  <div className="waiver-minor-heading">PARENT / LEGAL GUARDIAN ACKNOWLEDGMENT</div>
                  <p>As the parent or legal guardian of the minor participant(s) identified below, I acknowledge that I have reviewed Epic's information regarding the inherent risks of UTV riding in Moab, including the possibility of serious injury or death, Prohibited Terrain, and High-Consequence Terrain.</p>
                  <p>I understand that High-Consequence designations are not an exhaustive list of hazardous terrain and that Epic recommends avoiding High-Consequence Terrain. I authorize the minor participant(s) identified below to participate as passengers subject to applicable safety requirements.</p>
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
              <div className="waiver-eyebrow">{role === "responsible_party" && vehicleCount > 1 ? "06" : "05"} · Rental Agreement</div>
              {role === "adult_participant" ? <p><strong>V2 drafting note:</strong> The final launch version will display the Epic rental terms that apply to an adult participant without transferring Responsible Party financial obligations. The role-specific legal copy is intentionally not active yet.</p> : null}
              {role === "responsible_party" ? <div className="waiver-legal" dangerouslySetInnerHTML={{ __html: session.rental_terms_html || "" }} /> : <div className="waiver-legal"><p>Adult Participant agreement content will be inserted here after final legal wording is approved.</p></div>}
            </section>

            <section className="waiver-section">
              <div className="waiver-eyebrow">{role === "responsible_party" && vehicleCount > 1 ? "07" : "06"} · Acknowledgment & Signature</div>
              <label className="waiver-consent"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} /><span>I have reviewed the agreement sections applicable to my role and understand the selections shown below.</span></label>
              <div className="waiver-consent-card"><strong>{summary}</strong></div>
              <p><strong>Preview only:</strong> signature capture and submission are deliberately disabled on this branch so no V2 agreement can accidentally be recorded as a live agreement.</p>
              <button type="button" className="waiver-button waiver-submit" disabled>Complete Rental Agreement — Preview Disabled</button>
            </section>
          </> : null}
        </article>
      </div>
    </main>
  );
}
