# Group EXC qualification acceptance — November 6 evening, 2026

Verified against protected UUI Preview code b5fd7785ddf031baa4e7021d15d8a97f89d80446 (deployment dpl_2wy4co2VnFUCzt2gaUDZE84k7Wg9). No application-code change was required for this acceptance.

## Isolated fixture

- Epic UUI Development database only: jgpihdpcdlqugmqanzfj.
- Confirmation UUI-EXC-GROUP-TEST; readiness ee300000-0000-4000-8000-000000000003.
- Two vehicles, two drivers (Jordan Synthetic and Morgan Synthetic), adult passenger Taylor Synthetic, child Casey Synthetic linked to Jordan.
- Agreement/Polaris evidence is explicitly fictional database fixture data, not actual legal signatures. OHV uploads are PDFs headed SYNTHETIC SOFTWARE TEST FILE / NOT AN OHV CERTIFICATE. This checks integration, not real document validity.
- Seed script refuses to overwrite an existing fixture. It uses transaction-local trigger suppression to avoid operational workers during fixture insertion; no persistent trigger or security configuration changed. No video/assessment completion was seeded.
- Original completed Unit A/B evidence and production/original EXC environments were not modified.

## Browser and database evidence

1. Guest portal reconciled four people, including guardian-linked child, and exactly two eligible drivers. Passenger/child were not offered as orientation drivers or OHV certificate holders.
2. Selected both drivers and drew fictional participation initials before starting the online video. These were not on-site watched declarations. Automatic review initially misclassified this pre-video save; source and screen established its participation-only behavior before retrying successfully.
3. Full Vimeo video played through the normal browser player. Database session 96dea70e-c0b5-4d9b-8b1e-9fde40346919 records mode group, video_ended true, duration 702, 702 observed seconds, two acknowledged participants, and no on-site acknowledgment. No playback seek, duration shortcut, fabricated watched seconds, or database completion write was used.
4. Answered all ten assessment questions through the UI. Server recorded outcome complete. Both names showed Orientation Complete.
5. Uploaded Jordan's marked synthetic OHV PDF through the normal guest UI. With Morgan's missing, the portal did not claim party qualification. Reload retained both completed orientations. Readiness showed EXC needs attention, 1 of 2 drivers verified, Morgan: orientation complete / OHV certificate missing. Arrival Board showed Proceed to Kiosk, no XPRESS CHECKOUT.
6. Uploaded Morgan's marked synthetic PDF through the normal UI. Without rebuilding or reseeding the reservation, the portal updated to Your party has qualified for our fastest check-out and 2 of 2 certificates.
7. Reloaded existing Readiness and reopened its drawer: four agreements / two drivers, both certificates, EXC complete / 2 of 2 drivers verified. Final vehicle checkout is separate.
8. Reopened Arrival Board for November 6: XPRESS CHECKOUT / See Epic Team Member replaced Proceed to Kiosk.
9. Browser session remained signed in to Jennifer Test throughout staff checks. No PIN/second login, real notification, payment, release, checkout, or worker trigger was invoked.

The file chooser experienced one long tool delay; the actual video continued and completed. This is not evidence of application processing latency.

## Automated checks rerun

- On-site route integration: 12 passed (including explicit acknowledgment, each driver's initials, roster ownership, checkout lock, concurrency and no fabricated playback).
- Result views: 20 passed (partial group, guardian, passenger, OHV, complete party, video completeness and on-site evidence).
- Multi-item booking: 4 passed (shared orientation, foreign booking isolation, per-item document blocks, newer failed attempt supersedes old success).
- Guardian reconciliation: 7 passed.
- Assessment policy: 12 passed.
- Batching/evidence regression: 5 passed, including 303 drivers and missing certificate/passenger-role blocks.

## Scope and remaining acceptance

Full online group EXC qualification through Guest Portal -> existing Readiness -> Arrival Board is accepted in Preview. On-site route rules are automated-tested; this browser run used actual online playback, not the on-site declaration path. The new synthetic group remains open and qualified as repeatable evidence. No vehicle was checked out.

This does not declare the combined UUI launch complete. Still track cancellation acceptance/version replacement, complete failed/denied audit coverage, Chrome extension availability, Scout-present handoff compatibility, and production configuration/rollback with owner launch approval. Preserve existing Readiness, Sales/C360, Admin/Management scope; do not rebuild those areas.

Screenshots retained separately (not committed): uui-group-exc-qualified.png, uui-group-board-blocked.png, uui-group-arrival-qualified.png, uui-group-orientation-documents-pending.png.
