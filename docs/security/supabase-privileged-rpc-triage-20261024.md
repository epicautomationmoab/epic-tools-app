# Supabase privileged RPC exposure triage — 2026-10-24

Status: read-only audit. **Do not bulk revoke function grants** until callers and guest-token flows are tested.

## Verified production permission counts

- Public schema SECURITY DEFINER routines: **310**
- Of those, executable as `anon`: **231**
- Of those, executable as `authenticated`: **297**

These numbers reflect Postgres effective privileges, not proven external exploitation. The Data API exposed-schema setting and routine-specific access guards must still be checked. Trigger-only routines may be granted EXECUTE without being directly callable via PostgREST.

## Priority review queue

**P0 candidate — direct operational mutations (check definitions and client callers before any revoke):**
- `set_rental_damage_deposit_hold`, `set_rental_damage_deposit_basis`
- `set_readiness_no_show`, `set_readiness_people_override`, `set_readiness_adventure_assure_override`
- `set_epic_operational_handoff`, `set_tour_manifest_guide`
- `epic_sales_add_note`, `epic_sales_edit_note`, `epic_sales_claim_lead`
- `c360_employee_update_link_primary`
- `save_guest_readiness_note`

**P0 candidate — operational agents / ingestion:**
- `claim_next_mpwr_agent_create_job`, `build_mpwr_create_queue_jobs`
- `process_tripworks_waiver_event_by_id`, `ingest_tripworks_waiver`
- `replace_scout_mpwr_waiver_snapshot`

**Guest-authenticated RPCs — preserve guest function subject to token validation:**
- `resolve_epic_waiver_session`, `resolve_epic_waiver_session_v2`
- `submit_epic_tour_waiver`, `submit_epic_tour_waiver_v2`, `submit_epic_tour_waiver_v3`

## Required validation

1. Inspect `pg_get_functiondef` for authorization checks, `search_path`, and the actual modifications / exposed values.
2. Determine whether each routine is callable from the Data API versus trigger-only, and whether the app uses an anonymous, logged-in employee, guest session, or a service credential.
3. Migrate legitimate server callers, enforce per-actor authorization, write allow/deny negative tests.
4. Stage precise `REVOKE EXECUTE` statements for particular signatures only, with matching rollback `GRANT EXECUTE` statements; never revoke across all functions blindly.
5. Run functional regression tests on bookings, waivers, tours, checkout/check-in, C360, Scout, Bob, Rhett, and Cassie.
6. Verify Postgres grants + redacted API denial tests after deployment.

This review is part of Epic's UUI unified-security and employee-attribution architecture. Record staff actor IDs in durable audit events; server-side service credentials alone must not become the attributed actor.
