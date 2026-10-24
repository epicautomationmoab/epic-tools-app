# Future UUI / Incident Case Management (ICM) requirements
Captured 2026-10-23. Scope: approved architectural requirements for the future native module, **not** current implementation priority or authority for production changes.

## Product boundaries
- ICM is a native module within the single Epic Unified UI (UUI) team application, not a separate team app or a link to Jotform.
- Exactly **one incident case per incident event**, with a stable case identifier; multiple associated vehicle damage records, injured participants, calls, reports, recovery actions, notes and documents may belong to that case. Do not automatically create duplicate cases from duplicate form submissions, reminders, or multiple guests.
- A **single conditional guest incident report** replaces both existing Jotforms: the ordinary return-with-damage flow and the more serious incident/injury/recovery flow. Questions and requirements adapt to incident type/severity; retain the current safety-first intake sequence and incident details.
- Integration points: Readiness, current guest reservation and participant identities, the existing Guest Portal for secure guest completion, vehicle/fleet information and GPS/beacon signals when available, and the UUI.
- Support team-led **rental incident call intake** inside UUI, with context from existing C360, reservation and readiness records; do not make injury/recovery details mandatory for minor damage.
- For actionable recovery, capture location, immediate safety/injury urgency, drivable/stranded state, vehicle, guest contact, trail/hazard conditions, dispatch decision and status. Send appropriately structured Slack recovery notifications using approved channels and verified workflow; do not send test or live dispatch in this phase.
- The incident can originate from a guest returning with damage, call intake while out riding, or a guest form initiated from Readiness. Staff can attach the conditional form to a reservation, send it via Guest Portal, and create/link the ICM case without extra duplicate cases.
- Preserve evidence, audit history, incident status, and human review of safety-critical decisions. Guest-facing text and internal dispatch details require separate access controls.

## Release gate
Document the exact fields of both existing forms and their branching before replacement. Define idempotent case identity, secure guest token flow, role permissions, Slack message schema and failure/retry behavior, privacy of health details, and return-to-service/vehicle damage linkage. Test with synthetic cases and verify Readiness/Guest Portal semantics before any live Jotform retirement or auto-dispatch.

## Priority / current status
**Future requirement only.** Do not divert from the current native C360/UUI migration. No ICM API, case schema, Slack dispatch automation, Jotform cancellation or guest portal changes are being implemented by this document. Do not claim otherwise.
