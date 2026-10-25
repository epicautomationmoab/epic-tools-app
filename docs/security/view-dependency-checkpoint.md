## View dependency checkpoint

Read-only findings, 2026-10-24:

Scout source code in `epicautomationmoab/epic-scout-worker/scout.js` reads `scout_mpwr_waiver_work_v` and initializes Supabase using the `SUPABASE_SERVICE_ROLE_KEY` environment variable. Deployment environment variables were not independently inspected; this is a source-code finding only.

The repository-root `supabase.ts` calls `guest_readiness_dashboard_scan_document_links_v3` using the anonymous key. GitHub search found no imports referencing the root module; this suggests but does not prove that it is unused. Do not revoke the view solely on that inference.

Before deploying view revokes, check Scout runtime credentials and jobs, trace deployed callers of both document-link views, validate the service-role grants on an isolated staging database, and run Arrival Board and waiver functional tests. No production grants were changed.
