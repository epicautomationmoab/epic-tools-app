# Rental Agreement V2 Launch Plan

Status: PREVIEW BUILD ONLY. Production rental forms and readiness remain unchanged.

## Goal
Launch one Epic rental agreement flow completed once by each adult signer with two simple adult roles:

- Driver
- Passenger

Either adult role may also include a Parent / Legal Guardian acknowledgment covering one or more minor participants.

## Core Business Rule

A Driver is any person who operates an Epic vehicle during the rental. By signing the Driver agreement, that person accepts the operating, financial, and contractual responsibilities applicable to any Epic vehicle they operate during the rental, regardless of which individual is listed as the checkout driver in Epic's or Polaris's systems.

There is no separate Responsible Party customer-facing role in V2.

There is no election to accept responsibility for all vehicles on the reservation.

Each rental vehicle requires at least one signed Driver before the reservation is ready for checkout.

## Production Safety Rules

- Do not modify the current live rental agreement behavior until launch approval.
- Do not change current readiness completion rules until launch approval.
- V2 preview must not submit or create legally operative V2 signatures before approval.
- V2 work remains isolated on the `rental-agreement-v2-preview` branch until approved.
- Keep a rollback path to the current V1 rental agreement.

## V2 Form Logic

### Adult role
Signer chooses exactly one:

1. Driver
2. Passenger

### Driver
A Driver will operate an Epic vehicle during the rental and signs the full Driver version of the Epic rental agreement.

The final agreement must make clear that Driver obligations follow actual operation of an Epic vehicle and do not depend on MPWR or another system listing that person as the checkout driver.

### Passenger
A Passenger will not operate an Epic vehicle during the rental.

The Passenger path should include applicable participation, inherent-risk, terrain, and parent/minor acknowledgments without imposing Driver operating or financial obligations.

### Minor participants
Every adult signer answers whether they are the parent/legal guardian of any minor participants on the reservation.

If yes, the signer may add one or more minors to the same agreement. Each minor record should capture:

- first name
- last name
- date of birth
- relationship to signer

The same adult signature covers that adult's own role plus the parent/legal guardian acknowledgment for the listed minors.

Each listed minor counts toward the reservation's expected participant count but never toward the Driver count.

## Existing Data Structures We Intend to Reuse

- `epic_waiver_sessions`
- `epic_waiver_signatures`
- `epic_waiver_minors`
- `epic_waiver_templates`
- existing driver-status / `will_drive` concepts where useful
- `total_vehicle_count` from readiness data

Legacy Responsible Party scope fields may remain in the database for historical V1 records but should not drive V2 behavior.

## Data Additions / Changes To Evaluate Before Launch

- explicit V2 signer role (`driver` vs `passenger`)
- relationship-to-signer collection for minors in the V2 UI
- participant-count readiness that includes signed adults plus listed minors
- driver-count readiness derived from signed adult Drivers
- versioned PDF output that reflects Driver/Passenger role and listed minors
- preservation of exact signed agreement text for the role selected at signing

## Readiness V2 Requirements

V2 readiness should answer these questions without staff interpretation:

1. Are all expected people accounted for by Epic agreements or listed minor acknowledgments?
2. How many signed Drivers are present?
3. Does signed Driver count meet or exceed the reservation vehicle count?
4. Are all expected Polaris waivers complete?
5. Are there unmatched people, duplicate people, or role conflicts requiring staff review?

### Proposed Readiness Display

Show two related counts:

- `Agreements 4/4`
- `Drivers 2/2`

The first count means four expected participants are accounted for. Adults count through their own signed Epic agreement; minors count when listed under a signing parent/legal guardian.

The second count is Driver coverage. The denominator is `total_vehicle_count`.

Examples:

- 1 vehicle / 4 people / 1 Driver: `Agreements 4/4 · Drivers 1/1`
- 2 vehicles / 4 people / 2 Drivers: `Agreements 4/4 · Drivers 2/2`
- 2 vehicles / 4 people / 1 Driver: `Agreements 4/4 · Drivers 1/2` and the reservation is not ready
- 4 vehicles / 4 people / 4 Drivers: `Agreements 4/4 · Drivers 4/4`

Current V1 readiness remains the production source until launch approval.

## Preview Test Matrix

Before launch, test at minimum:

- 1 vehicle / 1 Driver / no minors
- 1 vehicle / 1 Driver + adult Passenger
- 1 vehicle / 1 Driver + adult Passenger + 2 minors
- 1 vehicle / 2 Drivers
- 2 vehicles / 2 Drivers
- 2 vehicles / 2 Drivers + adult Passengers + minors
- 2 vehicles / only 1 Driver -> not ready
- 3 vehicles / 3 Drivers / mixed Passengers / minors
- Driver who is also parent/legal guardian of minors
- Passenger who is also parent/legal guardian of minors
- signer changes Driver/Passenger selection before signature and submits correctly
- vehicle count changes before signing/readiness evaluation
- duplicate or unmatched signer handling

## Customer-Facing Content Still Needed Before Launch

- final Driver definition and opening language
- final Driver financial/contractual acknowledgment
- final Passenger agreement language
- final parent/legal guardian acknowledgment
- confirmation that Passenger content does not accidentally impose Driver obligations
- attorney review of final V2 agreement

## Operational Training Still Needed Before Launch

### Sales
- explain that every adult signs as Driver or Passenger
- explain that every actual Driver must sign as Driver
- explain that each vehicle requires at least one signed Driver
- explain High-Consequence vs Prohibited Terrain without gatekeeping

### Adventure Tech
- verify total participant coverage
- verify Driver count meets vehicle count
- verify minors are listed under a parent/legal guardian
- do not treat the MPWR checkout-driver field as the legal limit of Driver responsibility
- explain High-Consequence information without authorizing or forbidding non-prohibited terrain

### Customer Education
- explain why every adult signs Epic's agreement
- explain Driver vs Passenger selection
- explain parent/legal guardian completion for minors
- explain that one adult signs once even if they are also covering minor participants

## Launch Gate

Do not launch until all are true:

- [ ] Final agreement text approved internally
- [ ] Attorney review complete
- [ ] V2 form UI complete
- [ ] V2 signed PDF verified
- [ ] V2 database writes verified
- [ ] V2 readiness participant-count logic verified
- [ ] V2 Driver-count logic verified against vehicle count
- [ ] Minor participant counting verified
- [ ] Polaris waiver flow remains intact
- [ ] Guest Portal communication updated
- [ ] Sales training complete
- [ ] Adventure Tech training complete
- [ ] Customer education copy complete
- [ ] Test matrix passes
- [ ] Rollback to V1 tested
- [ ] Jennifer explicitly approves production cutover
