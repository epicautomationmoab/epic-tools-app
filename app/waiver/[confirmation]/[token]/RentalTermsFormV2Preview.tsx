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


const DRIVER_AGREEMENT_V2_HTML = `
  <p><strong>Driver Agreement.</strong> Driver means any person who operates an Epic vehicle during the rental. By signing as a Driver, you accept the operating, financial, and contractual responsibilities that apply to any Epic vehicle you operate during the rental, regardless of which individual is listed as the checkout driver in Epic's or Polaris's systems.</p>

  <p>Off-highway vehicle use in Moab is an inherently risky recreational activity. Terrain may include steep grades, ledges, rocks, technical obstacles, exposure, loose surfaces, changing trail conditions, limited visibility, other trail users, and other hazards capable of causing vehicle damage, serious bodily injury, or death.</p>

  <p>Epic provides operating requirements, safety information, trail information, and vehicle-use restrictions so Drivers can make informed decisions during the rental. Epic does not determine whether a particular road, trail, obstacle, or area is appropriate for an individual Driver.</p>

  <p>Each Driver is responsible for operating within their own skill and experience, selecting routes and terrain appropriate to their ability, observing current and changing conditions, maintaining control of the vehicle, and deciding whether to proceed on any road, trail, obstacle, or area. Each Driver is also responsible for knowing their location, route, direction of travel, and the terrain ahead.</p>

  <p>The absence of a road, trail, obstacle, or area from any warning, High-Consequence, or restricted-use list does not mean Epic represents that location as safe, easy, suitable, or appropriate for any particular Driver. Hazards capable of causing serious injury, death, vehicle damage, or difficult recovery may exist anywhere within Moab's trail system.</p>

  <h4>1. Driver Requirements and Vehicle Use</h4>
  <p>You are expected to operate only within your skill and experience and in compliance with applicable laws, trail regulations, land-use requirements, vehicle operating requirements, and the terms of this Agreement. You must follow vehicle operating instructions and use required safety equipment. Reckless, careless, unlawful, abusive, negligent, or unauthorized use, or operation outside your skill and experience, may affect available damage protection and may result in full financial responsibility where permitted by the applicable agreements and law.</p>
  <p>Do not race, tow, intentionally use the vehicle for recreational mudding, water play, or sand play, tamper with tracking or vehicle systems, operate while impaired, or intentionally misuse the vehicle. Open alcoholic beverages are not permitted in the vehicle during the rental period. Overnight rentals must be parked by 10:00 PM unless Epic has specifically provided different operating instructions.</p>
  <p>Navigation tools and route information may be incomplete or inaccurate. You remain responsible for navigation, route selection, and the terrain ahead.</p>

  <h4>2. Geographic Boundaries and Terrain</h4>
  <p>Vehicles must remain within Epic's authorized operating area and applicable public-land rules. Highway 191 is prohibited north of the Highway 279/Potash intersection and south of Red Desert RV Park, except that southbound Highway 191 may be used to return from trail access north of the Potash intersection. Highway 128 is prohibited beyond the Onion Creek intersection.</p>
  <p><strong>Prohibited Trails:</strong> Pritchett Canyon, Cliffhanger Trail, and Moab Rim Trail.</p>
  <p><strong>Prohibited Obstacles:</strong> Hell's Gate, Escalator, Staircase, Tip Over Challenge, Mickey's Hot Tub, and Devil's Hot Tub.</p>
  <p><strong>High-Consequence Terrain:</strong> Golden Spike, Gold Bar Rim, Behind the Rocks, Steel Bender, Rusty Nail, Flat Iron Mesa, Kane Creek, and Top of the World. Epic recommends avoiding High-Consequence Terrain. This list is not exhaustive and does not imply that unlisted terrain is safe, easy, suitable, or appropriate.</p>

  <h4>3. Cleaning and Condition</h4>
  <p>Do not wash, rinse, pressure wash, or otherwise clean the vehicle during the rental. Standard post-rental cleaning is included. Excessive contamination, mud, debris, staining, or other extraordinary cleaning needs may result in cleaning charges starting at $250.</p>

  <h4>4. Financial Responsibility and Charges</h4>
  <p>Each Driver is financially and contractually responsible for properly due charges associated with any Epic vehicle they operate, including damage, loss, administrative charges, shop costs, excessive cleaning, towing, recovery, extraction, transportation, Loss of Use where recoverable, prohibited-use charges, and other amounts properly due under this Agreement and applicable Polaris Adventures agreements.</p>
  <p>Epic may rely on photographs, incident reports, repair documentation, invoices, GPS or telemetry data, inspection findings, video, staff observations, and other relevant evidence when evaluating amounts due. A payment dispute or chargeback does not eliminate amounts that are otherwise properly due.</p>

  <h4>5. Recovery</h4>
  <p>Recovery, extraction, towing, or transport of a stuck, disabled, abandoned, or otherwise unrecoverable vehicle is separate from vehicle damage and from any damage-protection product. Except for a purely mechanical failure not caused or contributed to by the Driver, recovery costs are the responsibility of the Driver whose operation resulted in the need for recovery.</p>
  <p>Recovery from Prohibited Terrain or High-Consequence Terrain starts at $2,500 and may increase based on the actual resources required, including personnel, equipment, vehicles, time, operational disruption, technical difficulty, risk, and third-party costs. Recovery may be performed by Epic, a third party, or both. Recovery timing is not guaranteed.</p>

  <h4>6. Damage Protection Review</h4>
  <p>Epic reviews and evaluates damage incidents and applies the applicable damage-protection terms to vehicles rented through Epic. Damage protection may be limited or void where permitted by the applicable agreement for violations including reckless operation, operation outside skill and experience, intentional or willful disregard of operating requirements or warnings, Prohibited Terrain use, failure to report or cooperate, fraud or misrepresentation, or other conduct excluded by the applicable protection terms.</p>
  <p>Any uncovered amounts remain the responsibility of the Driver or Drivers legally and contractually responsible for the loss.</p>

  <h4>7. Security Deposit and Payment Authorization</h4>
  <p>Epic may require a security deposit or card authorization. Any deposit or authorization is not a cap on liability. By signing, you authorize Epic to apply available funds or charge the payment method on file for amounts properly due under this Agreement, subject to applicable law and payment-network rules.</p>

  <h4>8. Evidence, Enforcement, and Remedies</h4>
  <p>Violations of this Agreement may result in termination of the rental without refund, additional charges, recovery costs, and limitations on available damage protection where permitted by the applicable agreements. Epic may use GPS, telemetry, inspections, photographs, video, reports, and staff observations to determine compliance and document incidents.</p>

  <h4>9. Supplemental Agreement</h4>
  <p>This Agreement is separate from and supplemental to applicable Polaris Adventures agreements. By signing as a Driver, you acknowledge that you have reviewed this Agreement and accept the operating, financial, and contractual responsibilities that apply to any Epic vehicle you operate during the rental.</p>
`;

const PASSENGER_AGREEMENT_V2_HTML = `
  <p><strong>Passenger Agreement.</strong> By signing as a Passenger, you confirm that you will participate in the rental as a passenger and will not operate an Epic vehicle.</p>

  <p>Riding in an off-highway vehicle in Moab is an inherently risky recreational activity. Terrain may include steep grades, ledges, rocks, technical obstacles, exposure, loose surfaces, changing trail conditions, limited visibility, other trail users, and other hazards capable of causing serious bodily injury or death.</p>

  <p>Epic provides safety information, trail information, and terrain warnings so participants can make informed decisions. Epic does not determine whether a particular road, trail, obstacle, or area is appropriate for an individual participant.</p>

  <p><strong>Prohibited Terrain</strong> includes Pritchett Canyon, Cliffhanger Trail, Moab Rim Trail, Hell's Gate, Escalator, Staircase, Tip Over Challenge, Mickey's Hot Tub, and Devil's Hot Tub.</p>

  <p><strong>High-Consequence Terrain</strong> includes Golden Spike, Gold Bar Rim, Behind the Rocks, Steel Bender, Rusty Nail, Flat Iron Mesa, Kane Creek, and Top of the World. Epic recommends avoiding High-Consequence Terrain. This list is not exhaustive, and the absence of a road, trail, obstacle, or area from any warning or restricted-use list does not mean Epic represents that location as safe, easy, suitable, or appropriate.</p>

  <p>You understand that route selection, terrain decisions, and vehicle operation are the responsibility of the Driver. By signing as a Passenger, you are not accepting the Driver's vehicle-operation, damage, recovery, or other financial obligations solely because you are participating in the rental.</p>

  <p>This Passenger Agreement is separate from and supplemental to applicable Polaris Adventures participant or passenger agreements. Final release and waiver language will be reviewed by counsel before production launch.</p>
`;

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
                <div className="waiver-legal" dangerouslySetInnerHTML={{ __html: DRIVER_AGREEMENT_V2_HTML }} />
                <p><small><strong>Preview note:</strong> This is Epic's V2 Driver agreement language for internal review and attorney review. Production remains unchanged.</small></p>
              </> : <>
                <div className="waiver-legal" dangerouslySetInnerHTML={{ __html: PASSENGER_AGREEMENT_V2_HTML }} />
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
