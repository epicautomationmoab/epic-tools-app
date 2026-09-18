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
  <p>As a <strong>Driver</strong>, you are entering into a binding agreement with Epic 4X4 Adventures, Inc. (“Epic”). You accept financial and contractual responsibility for the Epic vehicle or vehicles you operate during the rental and for compliance with these Terms &amp; Conditions. These Terms &amp; Conditions are separate from and supplemental to any agreements entered into through Polaris Adventures and form part of your rental agreement with Epic.</p>

  <p><strong>Driver</strong> means any person who operates an Epic vehicle during the rental. Each Driver is individually responsible for the operating, financial, and contractual obligations applicable to any Epic vehicle they operate, regardless of which individual is listed as the vehicle’s checkout driver in Epic’s or Polaris’s systems.</p>

  <p>Off-highway vehicle use in Moab is an inherently risky recreational activity. Terrain may include steep grades, ledges, rocks, technical obstacles, exposure, loose surfaces, changing trail conditions, limited visibility, other trail users, and other hazards capable of causing vehicle damage, serious bodily injury, or death.</p>

  <p>Epic provides operating requirements, safety information, trail information, and vehicle-use restrictions to help renters and Drivers make informed decisions during the rental. Epic does not determine whether a particular road, trail, obstacle, or area is appropriate for an individual Driver.</p>

  <p>Each Driver is responsible for operating within their own skill and experience, selecting routes and terrain appropriate to their ability, observing current and changing conditions, maintaining control of the vehicle, and deciding whether to proceed on any road, trail, obstacle, or area.</p>

  <p>The absence of a road, trail, obstacle, or area from any warning, High-Consequence, or restricted-use list does not mean Epic represents that location as safe, easy, suitable, or appropriate for any particular Driver. Hazards capable of causing serious injury, death, vehicle damage, or difficult recovery may exist anywhere within Moab’s trail system.</p>

  <p>You are expected to comply with all applicable laws, trail regulations, land-use requirements, vehicle operating requirements, and the terms of this agreement while using the vehicle. Responsible operation helps protect Epic’s vehicles, other trail users, and Moab’s public lands.</p>

  <h4>1. SAFETY &amp; EQUIPMENT USE</h4>
  <p>Epic vehicles may be operated only on designated routes within Grand County and San Juan County, Utah. Vehicles may not be operated recklessly, carelessly, unlawfully, or beyond the Driver’s skill and experience.</p>

  <p>All Drivers must comply with posted trail regulations, speed limits, applicable laws, vehicle operating requirements, and Epic operating requirements provided for the rental.</p>

  <p>Utah law requires each Driver to complete the Utah OHV Education Course and carry a valid certificate while operating an off-highway vehicle. Proof of certification is required at check-out.</p>

  <p>Damage resulting from abuse, reckless or negligent operation, unauthorized use, or operation beyond the Driver’s skill or experience may result in loss of damage protection and full financial responsibility.</p>

  <h4>2. OPERATING BOUNDARIES, PROHIBITED &amp; HIGH-CONSEQUENCE TERRAIN</h4>
  <p><strong>Operating Boundaries</strong></p>
  <p>Epic vehicles may be operated only within the authorized rental area and may not be driven beyond the following roadway boundaries:</p>
  <ul>
    <li>Highway 191 northbound beyond the Highway 279 / Potash Road intersection</li>
    <li>Highway 191 southbound beyond Red Desert RV Park</li>
    <li>Highway 128 beyond the Onion Creek Road intersection</li>
  </ul>
  <p>Travel on Highway 191 southbound from trail access points north of the Highway 279 / Potash Road intersection is permitted when returning toward Moab.</p>

  <p><strong>Prohibited Terrain</strong></p>
  <p>Epic vehicles may not be operated on or used to attempt the following trails and obstacles:</p>
  <p><strong>Trails</strong></p>
  <ul>
    <li>Pritchett Canyon</li>
    <li>Cliffhanger Trail</li>
    <li>Moab Rim Trail</li>
  </ul>
  <p><strong>Obstacles</strong></p>
  <ul>
    <li>Hell’s Gate</li>
    <li>Escalator</li>
    <li>Staircase</li>
    <li>Tip Over Challenge</li>
    <li>Mickey’s Hot Tub</li>
    <li>Devil’s Hot Tub</li>
  </ul>

  <p>Entering Prohibited Terrain or attempting a prohibited obstacle is a violation of this agreement and may void applicable damage protection. The Driver whose operation results in the violation may be held fully responsible for resulting vehicle damage, recovery, Loss of Use, and other related costs.</p>

  <p><strong>High-Consequence Terrain</strong></p>
  <p>Epic identifies certain additional trails and obstacles as High-Consequence Terrain because errors, changing conditions, or loss of vehicle control may result in serious injury or death, significant vehicle damage, and difficult recovery. Epic recommends avoiding High-Consequence Terrain.</p>

  <p>High-Consequence Terrain includes, but is not limited to:</p>
  <ul>
    <li>Golden Spike</li>
    <li>Gold Bar Rim</li>
    <li>Behind the Rocks</li>
    <li>Steel Bender</li>
    <li>Rusty Nail</li>
    <li>Flat Iron Mesa</li>
    <li>Kane Creek</li>
    <li>Top Of The World</li>
  </ul>

  <p>High-Consequence designations are provided as additional information and are not an exhaustive list of hazardous terrain. The absence of a trail or obstacle from this designation does not mean Epic represents it as safe, easy, suitable, or appropriate for any Driver.</p>

  <p>You are responsible for knowing your location, route, and direction of travel and for determining whether the terrain ahead is within your skill and experience.</p>

  <p>You are expected to operate only within your skill and experience. If you choose to include High-Consequence Terrain in your experience, you accept the increased risks and consequences associated with that choice.</p>

  <p>Damage occurring in High-Consequence Terrain may be evaluated in determining whether the vehicle was operated outside the Driver’s skill or experience, recklessly, or with intentional or willful disregard for the risk of damage, which may affect or void applicable damage protection.</p>

  <p>Recovery from High-Consequence Terrain is subject to substantially increased recovery fees as described in this agreement.</p>

  <h4>3. CLEANING &amp; WASHING</h4>
  <p>Do not wash, rinse, pressure wash, or otherwise clean the vehicle during the rental. Improper water exposure can damage mechanical and electrical components. Standard cleaning is included with your rental.</p>

  <p>Excessive mud, debris, interior contamination, roof buildup, or other cleaning beyond normal recreational use may result in a cleaning fee starting at $250.</p>

  <h4>4. CHARGES, DISPUTES &amp; COLLECTION</h4>
  <p>Each Driver authorizes charges arising from any Epic vehicle they operate during the rental, including damage or loss, administrative and shop fees, cleaning, towing, recovery, extraction, transport, Loss of Use, prohibited-use charges, and other amounts due under these Terms &amp; Conditions.</p>

  <p>Epic may provide supporting documentation including photographs, incident records, repair documentation, invoices, and other available evidence.</p>

  <p>A payment dispute or chargeback does not eliminate amounts properly due under this agreement. Epic may pursue unpaid amounts and any remedies available under Utah law, including applicable collection costs, attorney fees, and court costs.</p>

  <h4>5. OPERATING RULES AND PROHIBITED CONDUCT</h4>
  <p>All Drivers must operate Epic vehicles responsibly, within their skill and experience, and in compliance with applicable laws, trail regulations, and these Terms &amp; Conditions.</p>

  <p>The following requirements apply:</p>
  <ul>
    <li>No racing, contests of speed, or performance driving</li>
    <li>Remain on designated OHV routes and obey posted signs and trail regulations</li>
    <li>Do not intentionally use the vehicle for recreational mudding, water play, or sand play</li>
    <li>UTVs may be driven on public roads only as reasonably necessary to access or return from trailheads</li>
    <li>Overnight rentals must be parked by 10:00 PM</li>
    <li>No towing or being towed</li>
    <li>Do not alter, disable, or tamper with the vehicle or any installed equipment</li>
  </ul>

  <p>Navigation tools, maps, GPS systems, suggested routes, overlays, and other visual indicators are provided for convenience only. They may be incomplete, inaccurate, delayed, unavailable, or affected by loss of cellular or satellite signal. You remain responsible for knowing your location, selecting your route, assessing the terrain ahead, and making your own driving decisions.</p>

  <p><strong>Prohibited Conduct — Zero Tolerance</strong></p>
  <p>The following conduct is strictly prohibited:</p>
  <ul>
    <li>Operating the vehicle under the influence of alcohol, drugs, or any impairing substance</li>
    <li>Possessing open containers of alcohol in the vehicle during the rental period</li>
    <li>Intentional misuse, reckless operation, or use clearly inconsistent with normal recreational operation</li>
    <li>Entering Prohibited Terrain or attempting prohibited obstacles</li>
    <li>Tampering with or disabling vehicle tracking, telemetry, or safety equipment</li>
  </ul>

  <p>Prohibited conduct may result in immediate termination of the rental without refund and may void applicable damage protection or coverage limitations. The Driver whose operation or conduct caused the violation may be held fully responsible for resulting damage, recovery, Loss of Use, and other related costs.</p>

  <p>Epic may rely on GPS records, vehicle telemetry, inspection findings, photographs, video, incident reports, and staff observations when determining compliance with these Terms &amp; Conditions.</p>

  <h4>6. SECURITY DEPOSIT</h4>
  <p>A security deposit or credit card authorization may be required before vehicle release. Each Driver authorizes Epic to apply available deposit funds or payment authorization toward amounts properly due from that Driver under these Terms &amp; Conditions, including damage, recovery, cleaning, Loss of Use, prohibited-use charges, and other rental-related costs.</p>

  <p>Any deposit or authorization does not limit a Driver’s financial obligations under this agreement.</p>

  <h4>7. VEHICLE RECOVERY</h4>
  <p>If a vehicle becomes stuck, disabled, abandoned, inoperable, or otherwise cannot be returned under its own power, recovery may be required.</p>

  <p>Recovery may include dispatch, labor, towing, extraction, winching, transport, specialized equipment, coordination, and third-party recovery services. Recovery charges are separate from vehicle damage charges and are not included in any damage-protection plan.</p>

  <p>The Driver whose operation results in the need for recovery is responsible for recovery charges arising from that vehicle, except when recovery is required solely because of a mechanical failure not caused or contributed to by the renter or Driver.</p>

  <p>Recovery from Prohibited or High-Consequence Terrain starts at $2,500 and may increase based on location, terrain, technical difficulty, personnel and equipment required, time involved, operational disruption, risk, and third-party recovery costs. Recovery may be performed by Epic personnel, third-party recovery providers, or both.</p>

  <p>Recovery timing depends on location, terrain, weather, safety conditions, and resource availability. Immediate recovery is not guaranteed.</p>

  <h4>8. DAMAGE PROTECTION REVIEW</h4>
  <p>Epic reviews and evaluates damage incidents and applies applicable damage-protection terms to vehicles rented through Epic.</p>

  <p>Following an incident, Epic may review vehicle condition, GPS and telemetry data, photographs, incident reports, Driver statements, trail location, operating behavior, and other available information to determine whether the vehicle was operated in compliance with these Terms &amp; Conditions and applicable damage-protection requirements.</p>

  <p>Epic may determine that damage protection is limited or void when the circumstances establish a violation of applicable rental or protection terms, including reckless operation, operation outside the Driver’s skill or experience, intentional misuse, willful disregard for the risk of damage, or other prohibited conduct.</p>

  <p>Any amounts not covered by applicable damage protection remain the responsibility of the Driver or Drivers responsible under these Terms &amp; Conditions.</p>

  <h4>9. AGREEMENT ACKNOWLEDGMENT</h4>
  <p>By signing this agreement, each Driver:</p>
  <ul>
    <li>Acknowledges that these Terms &amp; Conditions are separate from and supplemental to applicable Polaris Adventures agreements</li>
    <li>Accepts financial and contractual responsibility for any Epic vehicle they operate during the rental as provided in these Terms &amp; Conditions</li>
    <li>Understands that violations may result in termination of the rental, loss or limitation of damage protection, additional charges, or other remedies</li>
    <li>Authorizes Epic to charge amounts properly due from that Driver under these Terms &amp; Conditions, including damage, recovery, cleaning, Loss of Use, prohibited-use charges, and other rental-related costs</li>
  </ul>
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
