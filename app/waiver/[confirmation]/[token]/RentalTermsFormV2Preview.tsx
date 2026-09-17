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

export default function RentalTermsFormV2Preview({ session }: { session: RentalSession }) {
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
                <div className="waiver-minor-ack">
                  <div className="waiver-minor-heading">DRIVER AGREEMENT — V2 DRAFT</div>
                  <p><strong>Driver</strong> means any person who operates an Epic vehicle during the rental. By signing as a Driver, I accept the operating, financial, and contractual responsibilities that apply to any Epic vehicle I operate during the rental.</p>
                  <p>My responsibility as a Driver is based on my actual operation of an Epic vehicle and is not limited or eliminated because another person is listed as the checkout driver in Epic's or Polaris's systems.</p>
                  <p>I understand that off-highway vehicle use in Moab is inherently risky. I am responsible for operating within my own skill and experience, selecting routes and terrain appropriate to my ability, observing current and changing conditions, maintaining control of the vehicle, and deciding whether to proceed on any road, trail, obstacle, or area.</p>
                </div>
                <div className="waiver-legal" dangerouslySetInnerHTML={{ __html: session.rental_terms_html || "" }} />
                <p><small><strong>Preview note:</strong> The current master rental terms are shown below for drafting reference. Before launch, Responsible Party language and any terms that should apply only to Drivers will be rewritten into the V2 Driver agreement and reviewed by counsel.</small></p>
              </> : <>
                <div className="waiver-minor-ack">
                  <div className="waiver-minor-heading">PASSENGER AGREEMENT — V2 DRAFT</div>
                  <p>I will participate in this rental as a Passenger and will not operate an Epic vehicle.</p>
                  <p>I understand that riding in an off-highway vehicle in Moab is an inherently risky recreational activity. Terrain may include steep grades, ledges, rocks, technical obstacles, exposure, loose surfaces, changing trail conditions, limited visibility, other trail users, and other hazards capable of causing serious bodily injury or death.</p>
                  <p>I acknowledge Epic's information regarding Prohibited Terrain and High-Consequence Terrain. I understand that High-Consequence designations are not an exhaustive list of hazardous terrain and that the absence of a road, trail, obstacle, or area from a warning or restricted-use list does not mean Epic represents that location as safe, easy, suitable, or appropriate.</p>
                  <p>I understand that route selection, terrain decisions, and vehicle operation are the responsibility of the Driver. By signing as a Passenger, I am not accepting the Driver's vehicle-operation or financial obligations solely because I am participating in the rental.</p>
                </div>
                <p><small><strong>Preview note:</strong> This is the first substantive Passenger draft. Final release/waiver language and interaction with the Polaris passenger waiver will be reviewed before launch.</small></p>
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
              <div className="waiver-eyebrow">05 · Acknowledgment & Signature</div>
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
