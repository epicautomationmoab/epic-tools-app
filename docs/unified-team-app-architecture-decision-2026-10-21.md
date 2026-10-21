# Epic unified team application: binding architecture decision
Date: 2026-10-21 | Branch: architecture/unified-team-app-20261021
Status: design decision accepted in conversation; no production changes or cutover authorized.

## Target
ONE actual employee/team Next.js application and ONE coherent employee navigation under the Epic Command Center visual design, built on epic-tools-app. Functional sections include C360 & Sales; Guest Readiness & Operations; Reservations & Iron Jack; Fleet & Incidents; Management & Reporting; Staff Work. No long-term collection of separate employee-facing apps and links masquerading as integration. No iframe shell or cosmetic dashboard over the old C360.

## Data and service boundaries
Use the existing Epic Operations Supabase shared operational records and team_profiles/Auth as the common employee and customer foundation. Existing Iron Jack 2027 sandbox is not a production single-database consolidation; its schema, owner and migration/cutover need explicit design. A coherent single employee codebase does NOT mean merging external APIs, vehicle workers, customer portal delivery or regulated secrets into one process. Existing Rhett booking code, Bob/Patti and Guest Portal are protected from changes.

## Migration architecture
Build native route groups and shared code/modules INSIDE epic-tools-app:
- /team/command-center: real employee landing.
- Native Sales and C360 pages + API handlers extracted/refactored from epic-sales; retain functional behaviors, not old app's navigation.
- Existing Readiness, arrival, kiosk and operations services remain native; progressively refactor enhancer layers with regression tests, not wholesale rewrites.
- Shared employee identity and authorization helpers; customer context with exact contact, reservation, visit/readiness and MPWR unit identifiers.
- Future native Iron Jack booking and resource/fleet management workspaces, behind explicit release flags and capacity/availability guarantees.

During migration, old C360 remains live for staff, but it is a temporary operational fallback and **not** the intended steady-state UI. Retire old app only after complete role/action parity, performance/security and owner-authorized release.

## Sequencing
0. Inventory current code paths, imports, API calls, helpers, feature flags, assets, and side effects. Determine native porting order and dependency graph. No speculative content-only clones.
1. Put the approved Command Center visual design system and navigation foundations into an **isolated epic-tools-app branch**, without changing its live routes or sidebar. Do NOT create an app that merely links to C360.
2. Native C360 and Sales vertical migration with reusable actual components and API handlers; preserve source-owned messages, calls, drafts, lead sheets, quotes, notes, identity resolution and follow-ups. Add synthetic tests preventing double sends and inaccurate identity joins.
3. Consolidate Readiness UI components and reusable documents/actions without breaking guest portal/waivers/payment or arrival/kiosk guest-facing surface.
4. Add 2027 booking and fleet verticals only after separate readiness/cutover approval.
5. Gradually retire duplicate code/surfaces only once all existing workflows are covered by automated and manual acceptance tests, with rollback.

## Mandatory exit criteria
- One employee host/login/workspace layout; server/API-level staff permissions and workstation exceptions.
- Every existing page, button, drawer, incoming call popup, unread counter, collaborator mention, timer and follow-up preserved or explicitly replaced with tested equivalent.
- No duplicate CRM data stores, worker queue consumers, payment writers, communication transports or incompatible Supabase identities.
- Mobile and desktop operational parity; all real customer and guest journeys tested against staging fixtures.
- Reversible rollout, parallel run and formal owner sign-off before production replacement.

## Non-negotiable limitations
This document and branch do NOT claim a functioning combined application, parity tests, build validation, or approved code/deploy changes. No changes to main, production, hosted guest flows, auth domains, worker booking services or database schema. Experimental Command Center branch in epic-sales is a reference, not target architecture.
