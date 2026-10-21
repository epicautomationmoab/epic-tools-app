# Native C360 port: dependency map and phased acceptance
Date: 2026-10-21 | Branch: architecture/unified-team-app-20261021

## Source facts
epic-sales/app/customers/page.tsx renders actual CustomersClient, which imports Customer360Modal and Customers.module.css. The modal is a 290-line component with multiple child modules handling identity editing/matching, notes, lead sheets, follow-ups, quoted products, drafts, call/text/email/social history and attachments. CustomersClient itself provides employee-specific recent history and search behavior.

epic-sales/app/api/customers/route.ts authenticates using team profile and access cookie, rejects workstation, calls search_epic_customers and search_epic_inbound_only_customers, then c360_employee_search_phone_links. It groups results by confirmed link information; **do not rewrite it as fuzzy email/phone guessing**. Unlike EpicTools's existing server REST helpers it embeds fallback connection configuration. The native port must inject validated EpicTools environment configuration without copying credentials or changing production grants.

## Actual native integration approach
1. Keep source page and API routes in epic-sales as comparison baseline. Create **native** team app route modules and their direct API handlers in epic-tools-app, retaining the exact auth semantics and endpoint data shapes. Never iframe, proxy to Epic Sales, or route staff to another login as the finished product.
2. Port the C360 component dependency tree into an isolated team-app module group, including styles, child UI modules, media handlers, internal notes, lead sheets and follow-up APIs, and correct shared authentication. Avoid importing a single modal until all its dependencies are known and compile.
3. Share canonical customer context with source-specific IDs. New pure helper in lib/command-center/customer-context.ts treats a confirmation as ambiguous and requires a visit choice. Do not silently collapse TripWorks / Store Visit / MPWR unit data.
4. Port message send routes with no second live consumer, no duplicate sends, idempotency and provider failure tests, staff permissions and per-provider formatting. Keep C360 production app live until verified parity and explicit cutover.
5. Retain all Readiness/guest functions as native EpicTools components, refactor enhancer wrappers only under functional tests. Iron Jack stays sandbox/development until approved launch.

## Hard gates
No partial port is marketed as a functioning C360 replacement. Test anonymous, agent, manager, workstation and preview boundaries; same guest with multiple visits, confirmed linked phones and social-only identities; full inbox, Lead Sheet, draft and quote details, attachments and outbound delivery failure handling. Synthetic data only for mutation tests. Verify production C360 behavior is unchanged.

Current status: binding architecture decision and native **data-context helper** only. Actual Sales UI/API port, build, browser QA, deployment and migration cutover remain outstanding. No production change or operational deployment authorized.
