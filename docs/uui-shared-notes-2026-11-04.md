# Shared reservation notes — UUI Preview checkpoint, 2026-11-04

## Implemented
Existing epic_unified_notes and existing C360 RPCs reused. Named active employees can read/create reservation notes and change Show in Readiness. Workstations and anonymous users remain denied. Preview allows only POST/PATCH on /api/sales/unified-notes; Readiness text edit/archive endpoints remain blocked pending their separate attribution/concurrency checks.

Added epic_unified_note_audit trigger: every successful note insert/update/delete stores before/after and the authenticated employee identity in the same transaction. Service operations without an employee JWT remain explicitly Unknown / system. Existing records were not backfilled or assigned invented actors. Failed actions are not captured by this trigger.

Audit table has RLS and no anonymous/authenticated table privileges. Existing Jennifer/Joe-only server audit page now reads this source and offers Notes filtering. No general owner/manager access was added.

C360 shared-note load failures now show an error and Retry notes rather than silently appearing empty. Old reservation notes clear when switching customer reservation sets; polling results are ignored after unmount/change.

## Verification
- Actual UUI database rollback test passed create, author identity, C360 reader, visibility change, atomic INSERT+UPDATE audit, before/after booleans, workstation denial, direct table write denial, audit table denial and anonymous RPC denial.
- 48 Preview write-boundary checks passed.
- Local Next.js build/typecheck passed.
- Security advisor reviewed. RLS-with-no-policies on the audit table is intentional server-only access; authenticated SECURITY DEFINER warnings correspond to reviewed existing employee-guarded RPCs. Existing unrelated advisor findings remain.
- Browser sign-in restored by the user. Actual C360 Reservation Note saved initially hidden, then Show in Readiness enabled. Existing Readiness drawer displayed the exact text with Jennifer Test attribution; table note indicator present. Owner audit page displayed both INSERT and UPDATE with false-to-true before/after visibility.\n- Retained synthetic fixture: bdab4e46-81af-4c0d-ba09-d2ac9094518b on PREVIEW-HISTORY-312.\n- Fixed existing drawer note enhancer to read explicit data-confirmation-code instead of relying only on short confirmation formatting. Enabled the existing read-only POST note-flags endpoint in the exact Preview boundary and accepted the existing longer synthetic confirmation format.

## Deployment
Code commit fe03322d37d5a01840f32f2785847039db6cbeb6, existing integration/epic-tools-unified branch / PR111.
Vercel Preview deployment dpl_J1p4m8oY31C3mNUFiCUoesfX7oz7 (READY).
Supabase applied migration version 20261104194747 uui_shared_note_audit only to jgpihdpcdlqugmqanzfj.
No production or separate EXC changes; no guest/staff outbound messages.

## Next
Browser shared-note creation/visibility/readback and Jennifer audit verified. Next finish Readiness note edit/archive identity and concurrency safeguards and copied EXC acceptance. Do not rebuild Readiness or expand into live sending.
