# UUI quote persistence checkpoint — 2026-11-04

## Scope
Existing EpicTools + imported Sales/C360 in protected UUI Preview. No Readiness rebuild. Production and separate EXC release/database remain untouched.

## Completed
- Quote catalog and saved quote reads go through named-employee server routes. Legacy quote readers remain inaccessible to anonymous/authenticated direct RPC clients because they lack their own employee guard.
- Restored the reviewed save-v6 and recalculation RPC grants for authenticated employees in Epic UUI Development only; both reject workstations.
- Exact Preview write allowance for POST /api/sales/quotes; email and booking paths remain blocked.
- Saved Quotes button exposes the existing saved-quote list inside the unified shell.
- Standalone quotes stay in the builder after saving, with a confirmation and reopenable URL; contact-linked quotes retain C360 navigation.
- Selecting a saved quote updates its URL so reload restores the selected quote.

## Verification
- Production build passed locally; quote reader mocked transport checks and 32 internal-write boundary checks passed.
- Transactional development-database tests passed create, update same ID, recalculation, quantity persistence, employee attribution, workstation denial, anonymous denial, and server-only readers. Fixtures rolled back.
- Actual signed-in Preview browser created synthetic quote 18c3cadd-52fa-4bc7-b414-e6726b9febba as Jennifer Test: quantity 1 / $226.41.
- Browser edited same quote to quantity 2 / $452.82; reopened through Saved Quotes with quantity and total intact.
- Database independently confirmed the same ID, quantity 2, total 45282 cents, Jennifer attribution, draft status, no opportunity, no email sent.
- Corrected standalone save flow displayed success in the builder rather than an empty C360 search.
- Synthetic browser fixture deliberately retained for review, not a real customer.

## Remaining integration work (not complete)
- Shared Readiness/C360 notes: authenticated RPC access is currently denied; review read/write permissions and required audit coverage before enabling writes. Original Readiness note routes exist but Preview mutation boundary blocks them. Do not replace Readiness.
- C360 introduction-history GET still uses a direct user-token gmail_messages read and can show a permission error. Outbound introduction email remains blocked.
- EXC code exists in this branch but UUI flags are absent. Validate UUI guest-token/session data, video configuration and existing qualification tests before enabling the copied flow. Do not touch EXC staging.
- Live availability/Chrome extension compatibility, outbound integrations and production release are not verified by this checkpoint.
- Existing audit view covers its existing event sources, not a claim of complete note/change audit coverage.
