# Kiosk on-site orientation — November 5, 2026

Owner chose guest acknowledgement for drivers who already watched the full safety/orientation video at the location. Each selected driver draws initials beside the explicit statement. This is distinct from tracked portal playback; no watched seconds, end event or duration are fabricated.

Kiosk actions:
- Open My Guest Portal / Complete Forms: existing portal.
- Knowledge Assessment / Select After Watching Safety/Orientation Video: driver selection, individual on-site acknowledgements, existing knowledge assessment.

Existing unfinished online sessions can receive fresh on-site acknowledgements for the exact original roster. Resuming acknowledged sessions retains assessment progress. Passing still requires the normal assessment policy; qualification retains signed driver agreements, guardians, waivers, OHV and staff checkout boundaries. Completed and checked-out records remain read-only. Staff Readiness identifies the on-site source.

Evidence:
- TypeScript passed.
- 12 isolated route integration checks passed: persistence/resume, no fabricated playback, online video still required, initials/roster validation, foreign booking and checkout denial, concurrent update rejection and completed-session immutability.
- 20 readiness/result checks passed, including six on-site cases and existing online full-video requirements.
- Existing assessment policy (12), booking isolation and batched readiness checks passed.
- These are isolated automated checks; live browser acknowledgement-to-completion acceptance remains to be recorded.

Scope is the existing combined UUI Preview. No production deployment, external sends, new database schema, or changes to the original EXC project.

## Deployed verification
- Code commit: `1e5923823ca9a1160b8ed571d7293cc99f157e4c`.
- Protected UUI Preview deployment `dpl_5w9r74kjPjWys5C2FFyjVLGppfGL` is READY.
- Browser: four-digit entry enables both buttons; Knowledge Assessment preserves its destination through reservation selection and reaches the same Preview portal with `#assessment`.
- Browser: returned rental keeps completed orientation visible and offers no new assessment. This is the expected checkout lock, not a completed on-site happy-path test.
- Full live on-site acknowledgement/assessment test remains open: the sole synthetic rental booking is already returned and its driver already completed orientation. Temporary reset confirmation expired without executing. Read-only verification confirmed original session complete, 702 watched seconds and rental_returned unchanged. Do not describe this gate as passed.
- No production, outbound messages or database records changed in this pass.
