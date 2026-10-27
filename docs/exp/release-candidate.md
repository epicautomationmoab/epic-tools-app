# EXP release candidate — October 27, 2026

Production is held at the user's direction. PR #107 remains draft and unmerged.

## Review environment

- Fixed address: https://epic-tools-exp-staging.vercel.app/staging
- Supabase: cchsrkhpvvrvcuepkqdu; Vercel: epic-tools-exp-staging.
- The hub links to prepared completed/incomplete parties, quiz design, staff Readiness, sample Arrival Board, kiosk, and the unpublished reminder preview.
- Sample rentals are October 28. They are synthetic snapshots, not a continuously refreshed production copy. The date viewer is staging-only. No real guests should be imported or contacted.
- Keep the fixed hostname: Vimeo permits playback only on approved origins.

## Verification

The earlier real browser test completed Vimeo playback, three drawn initials, saved/resumed answers, ordinary retry and successful server grading. Critical rewatch and multi-driver failures also passed synthetic checkpoint/state tests. Files were uploaded through actual staging APIs and retrieved byte-for-byte. A signed rental PDF was generated and retrieved.

After the morning styling change, 22 staging regression checks passed again; completed party remained 3/3 EXP Ready and incomplete party remained blocked. The later batch loader must pass those checks again on its exact deployment before sign-off.

Staff and board now receive one server determination. Batch evidence reads replace per-reservation polling and the 75/60-row browser caps. The evidence-isolated regression covers 101 parties/303 drivers, pagination beyond 500 observations, a newer failed attempt, one missing certificate, and a passenger waiver incorrectly offered for a signed driver. This is correctness coverage, not a production load benchmark.

## Reminder

Separate Resend draft: 5213803b-05d2-4827-9462-324644e73ecf. Never published or sent. It preserves the existing Adventure Tomorrow arrival details and adds optional rental EXP preparation. `RESEND_RENTAL_REMINDER_TEMPLATE_ID` selects it only for rental-only itineraries when explicitly configured; tours, mixed itineraries, and absent config retain the existing template. Six routing cases passed. No production configuration was changed.

## Release gates

1. User reviews the staged guest design and reminder wording.
2. Review and apply the EXP foundation migration to production only with release authorization. A read-only October 27 check confirms production has no exp_sessions/exp_participants tables. Its existing OHV, signature and PDF storage buckets are private.
3. Confirm production credentials/grants, EXP flags, stable public origin and Vimeo allowlist, generated-PDF function, and rollback procedure. Never copy staging fixtures or outbound-disabled trigger state into production.
4. Publish and configure the rental reminder only with explicit approval. No live messages are authorized by this document.
5. Resolve or explicitly assess the previously observed baseline security advisories and staging/production function differences. Those are not blanket certification of production security.
6. Run a release smoke test at the approved time and monitor errors. Production load testing has not been performed.

A read-only check confirms the existing Polaris observation feed is populated, with explicit adult-driver/passenger classification and recent verification. Staging Polaris observations remain synthetic; no live operational integration was activated by this work. Production has not been tested end-to-end or released.
