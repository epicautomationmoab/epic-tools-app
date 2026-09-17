# Rental Agreement V2 Launch Plan

Status: PREVIEW BUILD ONLY. Production rental forms and readiness remain unchanged.

## Goal
Launch one Epic rental agreement flow that can be completed once by each adult signer while supporting these roles and combinations:

- Responsible Party
- Other Adult Participant
- Authorized Driver or Passenger Only
- Parent / Legal Guardian covering one or more minor participants
- Responsible Party scope: all reservation vehicles or assigned vehicle only
- Multiple Responsible Parties on the same reservation

## Production Safety Rules

- Do not modify the current live rental agreement behavior until launch approval.
- Do not change current readiness completion rules until launch approval.
- V2 preview must not submit or create legally operative V2 signatures before approval.
- V2 work remains isolated on the `rental-agreement-v2-preview` branch until approved.
- Keep a rollback path to the current V1 rental agreement.

## V2 Form Logic

### Adult role
Signer chooses exactly one:

1. Responsible Party
2. Other Adult Participant

### Responsible Party scope
If the signer chooses Responsible Party:

- Single-vehicle reservation: responsibility applies to the assigned rental vehicle.
- Multi-vehicle reservation: signer chooses either:
  - all vehicles on the reservation, or
  - only the vehicle assigned to that signer at checkout.

More than one signer may choose Responsible Party.

### Driver status
Every adult signer answers:

- Yes - Authorized Driver
- No - Passenger Only

A Responsible Party who is also a driver signs only once.

### Minor participants
Every adult signer answers whether they are the parent/legal guardian of any minor participants on the reservation.

If yes, the signer may add one or more minors to the same agreement. Each minor record should capture:

- first name
- last name
- date of birth
- relationship to signer

The same adult signature covers that adult's own role plus the parent/legal guardian acknowledgment for the listed minors.

## Existing Data Structures We Intend to Reuse

- `epic_waiver_sessions`
- `epic_waiver_signatures`
- `epic_waiver_minors`
- `epic_waiver_templates`
- `will_drive`
- `rental_responsibility_scope`
- `rental_vehicle_count_at_signing`
- `rental_vehicle_coverage_count`

## Data Additions / Changes To Evaluate Before Launch

- explicit signer role (`responsible_party` vs `adult_participant`)
- relationship-to-signer collection for minors in the V2 UI
- durable link between an `assigned_vehicle_only` Responsible Party and the actual vehicle assigned at checkout
- readiness-level representation of participant coverage by person, not only aggregate counts
- readiness rule that every rental vehicle has at least one Responsible Party before checkout
- PDF output that reflects role, driver status, responsibility scope, and listed minors

## Readiness V2 Requirements

V2 readiness should eventually answer all of the following without staff interpretation:

1. Are all adult participants accounted for by an Epic agreement?
2. Are all minor participants covered by a parent/legal guardian acknowledgment?
3. Are all expected Polaris waivers complete?
4. Are all Authorized Drivers identified?
5. Does every rental vehicle have at least one Responsible Party?
6. If a Responsible Party selected assigned-vehicle-only, which actual vehicle are they responsible for after checkout assignment?
7. Are there any unmatched people, duplicate people, or role conflicts requiring staff review?

Current V1 readiness remains the production source until launch approval.

## Preview Test Matrix

Before launch, test at minimum:

- 1 vehicle / 1 Responsible Party driver / no minors
- 1 vehicle / Responsible Party passenger / additional adult driver
- 1 vehicle / Responsible Party driver + parent of 2 minors
- 2 vehicles / one Responsible Party for all vehicles
- 2 vehicles / two Responsible Parties, each assigned-vehicle-only
- 2 vehicles / one Responsible Party all vehicles + another Responsible Party assigned-vehicle-only
- 3 vehicles / multiple adult drivers / adult passengers / minors
- adult participant who is a driver and a parent
- adult participant who is passenger-only and a parent
- signer starts as one role, changes selection before signature, and submits correctly
- vehicle count changes before launch-day signature
- vehicle assignment changes at checkout

## Customer-Facing Content Still Needed Before Launch

- final Responsible Party opening / acknowledgment language
- final Other Adult Participant opening / acknowledgment language
- final minor parent/legal guardian acknowledgment
- confirmation that adult participant view of the master T&C does not accidentally impose Responsible Party financial obligations
- attorney review of final V2 agreement

## Operational Training Still Needed Before Launch

### Sales
- explain who must sign Epic and Polaris documents
- explain Responsible Party options for multi-vehicle reservations
- explain that multiple Responsible Parties are allowed
- explain High-Consequence vs Prohibited Terrain without gatekeeping

### Adventure Tech
- verify all adults/minors are accounted for
- verify Authorized Drivers
- verify vehicle-level Responsible Party coverage before checkout
- handle assigned-vehicle-only responsibility when vehicles are assigned or changed
- explain High-Consequence information without authorizing or forbidding non-prohibited terrain

### Customer Education
- explain why every adult signs Epic's agreement
- explain parent/legal guardian completion for minors
- explain that Responsible Party financial obligations are role-specific
- explain that the same adult signs once even if they are Responsible Party + driver + parent

## Launch Gate

Do not launch until all are true:

- [ ] Final agreement text approved internally
- [ ] Attorney review complete
- [ ] V2 form UI complete
- [ ] V2 signed PDF verified
- [ ] V2 database writes verified
- [ ] V2 readiness logic verified
- [ ] Vehicle-level Responsible Party coverage verified
- [ ] Polaris waiver flow remains intact
- [ ] Guest Portal communication updated
- [ ] Sales training complete
- [ ] Adventure Tech training complete
- [ ] Customer education copy complete
- [ ] Test matrix passes
- [ ] Rollback to V1 tested
- [ ] Jennifer explicitly approves production cutover
