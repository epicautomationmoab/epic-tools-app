# EPIC COMMAND CENTER - CANONICAL CONTINUATION / HANDOFF
Updated: 2026-10-21

## Read this first after any ChatGPT thread/context reset
User's explicit objective: ONE modern and maintainable employee team app, ONE coherent codebase and login, with native Sales/C360, Readiness, Booking/Iron Jack, Fleet, Employee Work, and Management sections, using existing Epic Operations Supabase as operational data foundation. **NOT** a decorative dashboard linking to legacy C360/EpicTools, NOT iframe composition, and NOT a thinner replacement. EpicTools repository is the target application. Original polished Command Center V1 design is the visual baseline. Clean up/refactor duplicated old code only after real functionality parity and regression verification. User doesn't code and does not want minute-by-minute supervision or a new assistant turn per small step.

## Canonical repository, branch and progress
- Target repo: epicautomationmoab/epic-tools-app
- Target development branch: architecture/unified-team-app-20261021 (unmerged, isolated)
- Binding decision: docs/unified-team-app-architecture-decision-2026-10-21.md
- Detailed C360 port plan: docs/command-center-c360-native-port-plan.md
- Implemented pure customer context: lib/command-center/customer-context.ts
- Implemented native search API: app/api/team/command-center/customers/route.ts. Ported from epic-sales, avoids embedded fallback publishable credential; honors team profile and rejects workstation.
- Implemented native search UI: app/team/command-center/NativeCustomerSearch.tsx.
- Implemented native page: app/team/command-center/page.tsx. Uses existing employee-login path.
- Last commit checked: 2d74870caca94ea3379ab1994d99f0fc066b5d6d. Vercel preview for this SHA READY at epic-tools-kn54sm2gj-automation-4515s-projects.vercel.app. This is a successful build, **NOT** confirmation of authenticated runtime, browser parity or complete C360. The customer page is search-only and explicitly incomplete.

## What we must preserve
- Full real C360: Inbox across calls/SMS/Email/Meta social, attachments, outgoing provider-specific delivery and errors, call popup, Lead Sheets, Sales Opportunities, My Catch-Up/mentions, follow-up ownership, Quotes and Book It helper, Customer 360 history, identity links, phone reports.
- Full Readiness: actual ReadinessTable and all its enhancers, refresh, cancellation notices, no-show, last-sync, payment, MPWR finance, documents, signed waivers, OHV, guest portal, Arrival Board and kiosk as separate guest-facing screens.
- Rhett MPWR booking code (agent.js, Dockerfile, worker gateway, normal booking flow) must **NOT** be changed; Epic has not suffered duplicate MPWR reservations. Existing customer Guest Portal must NOT change.
- Bob/Patti/other agents and existing booking/communications providers continue doing what works. 2027 Iron Jack uses separate sandbox today; do not assume database consolidation already completed.
- Source of original parity findings: epicautomationmoab/epic-reztech branch audit/unified-command-center-auth-20261021, especially docs/command-center-no-feature-loss-gate-2026-10-21.md, docs/command-center-c360-action-parity-2026-10-21.md, docs/command-center-readiness-page-parity-2026-10-21.md, docs/command-center-collaboration-parity-2026-10-21.md. The initial Epic Sales prototype branch prototype/command-center-real-c360-20261021 is only a historical reference and is **not** the target.

## Immediate engineering sequence
1. Verify current native branch build and runtime. Vercel READY for last commit 2d74870, but browser/authenticated functional tests are not yet done; don't claim more.
2. Map dependency tree of epic-sales/app/customer-360/Customer360Modal.tsx and its child modules (CallTranscript, GuidedLeadSheet, InternalConversation, LeadWorkspaceAccess, ReservationReadiness, ScheduleFollowUp, CustomerFollowUps, PossibleCustomerMatches, SocialIdentityLink, ContactIdentityEditor, Customer360.module.css), and CustomersClient/Customers.module.css. Map their API endpoints and ownership.
3. Port actual C360 *customer detail*, in a staged **native** module under epic-tools-app. Avoid temporary external C360 links as the product. Ensure complete dependencies and actual API handlers compile before exposing functional UI. Don't copy credentials or accidentally duplicate message sending. Do not fake missing features.
4. Then native Inbox/Lead Sheet, Sales, Quotes, call/notifications. Build/test step-by-step in isolated EpicTools branch.
5. Preserve actual Readiness full page, independently test exact readiness_id selection for multi-visit confirmations, and migrate clean components with regressions.
6. Integrate Iron Jack booking and fleet workspaces only with controlled business logic ownership/cutover approvals.
7. No production deploy, merge, DB migrations, privilege changes, real outbound sends, booking changes or guest portal changes without explicit approval.

## Technical findings / caveats
- C360 & EpicTools share Supabase Auth/team_profiles, but current sites have different cookie scopes and refresh behavior. One native employee host is the target, without broadening workstation privileges.
- Certain customer-search RPCs have SECURITY DEFINER/anon EXECUTE metadata. Their internal auth guards are not fully characterized; avoid premature grant changes.
- Confirmation codes are not unique enough to guarantee one exact Visit or MPWR unit; preserve exact IDs and avoid guessed merges. C360's current customer-modal context sometimes selects first active reservation; don't reuse as canonical source without explicit selection.
- Existing C360 sends through EpicTools server endpoints already in many cases. The migration must avoid two parallel live sending paths.

## Communication / autonomy contract
User wants substantial task execution without constant 'keep going' prompts; engage only when a true decision, blocker, or meaningful tested milestone requires it. Be precise: distinguish committed code, Vercel build READY, browser testing, integration completeness, deployment authorization. Continue on the same branch. Do not suggest a preview is complete when it is a search-only slice.

## 2026-10-21 next progress: native customer detail (read-only)
- Native API added: app/api/team/command-center/customer-detail/route.ts, commit 1f65af0. It authenticates active staff, rejects workstation, and calls the existing get_epic_customer_360 Supabase RPC directly under employee token; no Epic Sales app proxy and no mutation handler.
- NativeCustomerSearch now offers selecting a search result and expanding read-only reservation, opportunities, drafts, quotes, calls, texts, emails and notes, commit b9e32f3. This is deliberately a **partial, simple inspector**, NOT the full Customer360Modal, call merging/enrichment, complex lifecycle, or permissions/action parity.
- Latest Vercel deployment for b9e32f3 was INITIALIZING on last inspection; do not claim build or runtime success until verified. Earlier dependency-document-only SHA f1630fd was READY.
- Important: preserve Colorado/Denver time normalization from legacy C360; its TripWorks wall-clock timestamps are not safely represented by naive Date parsing. Preserve confirmation-to-visit ambiguity and linked phone identity rules. Current native detail RPC lacks original C360's additional PBX call enrichment, cross-linked contacts, social activities and readiness extras; must not be treated as equivalent.
- No merge, schema change or production action was performed. Continue building native detail UI and adapter parity under tests, not dashboard links.

## 2026-10-22 incremental accuracy fixes
- Confirmed Vercel READY for prior native read-only Customer 360 branch build d45758d (not authenticated browser QA).
- Added lib/command-center/customer-display.ts with separate Moab wall-clock reservation formatting versus America/Denver timestamp event rendering, commit 32511df.
- Updated NativeCustomerSearch to clear previously selected customer as the search changes, reducing risk of acting on stale selected identity; history date fields now use dedicated display helpers, commit 25dc1dc.
- Latest build for 25dc1dc not yet verified at handoff update. No outbound actions enabled, no production merged or altered.
- Important follow-up: This helper assumes raw RPC reservation timestamps have the documented TripWorks wall-clock format; before release, test 2026 daylight-saving boundaries against the original C360 normalization. The legacy C360 source performs extra enrichment for PBX, linked contacts, social and readiness that the read-only prototype still lacks.

## 2026-10-22 native read-only customer detail component
- Created app/team/command-center/NativeCustomerDetail.tsx (9078ac0) and wired NativeCustomerSearch to use it (2705a66). Displays identity, record counts, grouped existing C360 RPC data and explicit reservation identifiers. Duplicate confirmation codes across reservations are flagged for manual exact-visit choice before any future action. This is a read-only native UI, NOT complete C360 parity.
- No communication writes, booking/payment actions, worker changes, or database mutations. Avoid treating missing native enrichments as absence of records; source C360 still has PBX merge, linked phone, social, readiness and other enrichers.
- Latest Vercel preview build for 2705a66 not yet observed as READY; confirm before testing. Browser authenticated tests still outstanding.
