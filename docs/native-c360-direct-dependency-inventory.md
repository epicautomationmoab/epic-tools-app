# Native Customer 360 migration: verified direct dependency graph
Updated 2026-10-21. Inspected original epic-sales source files; no operational code changed in source app.

## Component dependency tree
- CustomersClient.tsx -> Customer360Modal.tsx + Customers.module.css.
- Customer360Modal.tsx -> Customer360.module.css, CallTranscript.tsx, GuidedLeadSheet.tsx, InternalConversation.tsx, LeadWorkspaceAccess.tsx, ReservationReadiness.tsx, ScheduleFollowUp.tsx, CustomerFollowUps.tsx, PossibleCustomerMatches.tsx, SocialIdentityLink.tsx, ContactIdentityEditor.tsx.
- InternalConversation -> QuickFollowUp and ScheduleFollowUp; its backend uses /api/unified-notes, /api/inbox, /api/epic-ping. Must preserve customer-vs-reservation notes, @mentions, follow-up and acknowledgement actions.
- LeadWorkspaceAccess -> LeadWorkModal and LeadsClient type; /api/lead-workspace and /api/sales-introduction-email.
- ReservationReadiness -> CancellationAgreementPanel; /api/customer-360/resend-confirmation, /api/customer-readiness, /api/team/ohv/view/*.
- ScheduleFollowUp and CustomerFollowUps -> /api/followups.
- PossibleCustomerMatches -> /api/customer-360 and /api/customer-360/possible-matches.
- SocialIdentityLink -> IdentityActions.module.css; /api/customers and /api/customer-360/social-link.
- ContactIdentityEditor -> /api/customer-360/contact-methods.
- CallTranscript has no other direct local imports.

## Modal API surface beyond child imports
GET /api/customer-360 (initial and refresh), GET /api/lead-sheets, /api/message-media, POST /api/podium-text, /api/telnyx-text or /api/customer-communications, and original /quote and /staff-booking actions. These routes are deeply coupled to the existing employee auth and EpicTools mail/SMS services. Don't copy just modal JSX into EpicTools without complete API compatibility.

## Implementation gates
1. Native search route (already built), authenticated real-run and query validation.
2. Port/read-only C360 details and full dependency closure. Add native endpoints within EpicTools with no proxy to Epic Sales. Keep old active UI until parity passes.
3. Add mutations only after deduplicated transport and role tests; don't create a second SMS/email writer or run real sends as tests.
4. Functional parity: existing contact match/link, alternate phones, ReservationReadiness cancellation/documents, photos, quote, Book It, lead work and follow-ups, customer/reservation notes and social.
5. Ensure proper customer and reservation identity on multi-unit confirmations; existing original modal sometimes uses first reservation as action context and shouldn't silently become canonical.

## Target
Repository epicautomationmoab/epic-tools-app, branch architecture/unified-team-app-20261021. Read START-HERE-command-center-handoff.md before resuming. Original Epic Sales preview branch is not target. No merge/deployment or production changes.
