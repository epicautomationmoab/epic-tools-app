# Shared reservation notes — UUI Preview checkpoint, 2026-11-04

## Implemented
Existing epic_unified_notes and existing C360 RPCs reused. Named active employees can read/create reservation notes and change Show in Readiness. Workstations and anonymous users remain denied. Preview allows only POST/PATCH on /api/sales/unified-notes; Readiness text edit/archive endpoints remain blocked pending their separate attribution/concurrency checks.

Added epic_unified_note_audit trigger: every successful note insert/update/delete stores before/after and the authenticated employee identity in the same transaction. Service operations without an employee JWT remain explicitly Unknown / system. Existing records were not backfilled or assigned invented actors. Failed actions are not captured by this trigger.

Audit table has RLS and no anonymous/authenticated table privileges. Existing Jennifer/Joe-only server audit page now reads this source and offers Notes filtering. No general owner/manager access was added.

C360 shared-note load failures now show an error and Retry notes rather than silently appearing empty. Old reservation notes clear when switching customer reservation sets; polling results are ignored after unmount/change.

## Verification
- Actual UUI database rollback test passed create, author identity, C360 reader, visibility change, atomic INSERT+UPDATE audit, before/after booleans, workstation denial, direct table write denial, audit table denial and anonymous RPC denial.
- 41 Preview write-boundary checks passed.
- Local Next.js build/typecheck passed.
- Security advisor reviewed. RLS-with-no-policies on the audit table is intentional server-only access; authenticated SECURITY DEFINER warnings correspond to reviewed existing employee-guarded RPCs. Existing unrelated advisor findings remain.
- Browser end-to-end check pending: previous tab disappeared; available browser reaches Employee sign-in. Do not claim visual note-save/Readiness/audit verification complete.

## Deployment
Code commit 36b3ad4fe00cf5026ab754ab0c7df1ef2b0369ea, existing integration/epic-tools-unified branch / PR111.
Vercel Preview deployment dpl_GwAAWjxR4ykdTwNrKoNKJfhv4KZc.
Supabase applied migration version 20261104194747 uui_shared_note_audit only to jgpihdpcdlqugmqanzfj.
No production or separate EXC changes; no guest/staff outbound messages.

## Next
Signed-in browser: synthetic lifetime customer -> Reservation Note -> save hidden -> Show in Readiness -> verify existing Readiness drawer -> Jennifer/Joe audit. Then finish Readiness note edit/archive identity and concurrency safeguards and copied EXC acceptance. Do not rebuild Readiness or expand into live sending.
