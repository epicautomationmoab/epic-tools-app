# EpicTools unified integration

Scope: preserve existing Readiness; combine the current Sales/C360 application with approved login/Home, Administration, Management and Reports. Shared Ping and incoming calls. Existing EXC joins the isolated review candidate. Production release remains unauthorized.

## Sources
- EpicTools main: bd686f1a22e085d97df5684f32169bb8dd4e5e26
- Sales main: 6189226fd4c8e745fc2aeb86b858c90b8d176377
- Home styling and shared tools recovered from the saved integration checkpoint.
- TripWorks sales report recovered from feature/todays-tripworks-sales-report-20261023.
- Existing Team Activity audit reader recovered from feature/command-center-auth-foundation; access restricted to configured named owner profile IDs.

Sales source is under modules/sales with page and API entrypoints under /sales and /api/sales. Existing EpicTools authentication is reused. Original Readiness business logic, workers and cron schedules are preserved.

## Release gates
- Consolidated source must compile and build.
- Isolated Preview configuration must replace all live service fallbacks and ensure internal Sales relays stay inside this application.
- Test original full workflows against isolated services, including Admin, reports, shared calls/Ping and EXC. Type checking does not establish functional acceptance.
- Configure EPIC_AUDIT_OWNER_PROFILE_IDS for Jennifer and Joe only.
- Verify quote availability extension integration.
- Verify original Slack maintenance and Joe SMS routing without sending live test messages.
- No production merge, migration or release until owner approval.

Automatic Vercel Git deployment is disabled for this integration branch. Preserve existing projects and branches until their work is accounted for.

## Verified in this integration
- Existing EXC branch merged locally, resolving only Vercel branch-exclusion configuration.
- Combined Next.js production build passed after integration.
- All 12 existing Sales pages and 39 non-auth API routes have entrypoints in the combined app. Auth and Ping reuse EpicTools.
- Nine unauthenticated HTTP checks passed: login loads and protected workspace routes redirect to employee login.
- Original tour-checkin-sweep, tour issue report, and rental issue report handlers match main byte-for-byte.
- No authenticated workflow acceptance or deployment is claimed. Existing EXC middleware still blocks operational writes when EPIC_STAGING_NO_OUTBOUND is enabled; this must be reconciled with isolated full-workflow testing before deployment.

## November 4 continuation
- Vercel UUI project confirmed protected, without custom domains; server credential exists only for Preview/Development.
- Configured public database key, Jennifer/Joe test profile audit allowlist, and outbound-disabled staging flag.
- Applied the existing three EXC migrations to UUI development only. Verified RLS and absence of direct client table access on all four EXC tables.
- Updated the staging database guard to recognize the dedicated UUI project while retaining the existing EXC-staging restriction elsewhere. Six isolation checks passed.
- Sales internal relay URLs now default to the deployment's own VERCEL_URL; removed the remaining Meta Messenger production database fallback.
- Operational mutation restrictions remain enabled pending route-by-route isolated workflow validation. No live communications or production changes.

## Deployed verification checkpoint
- Protected Preview deployment: dpl_B7TrkZPm7tghFwJ645WRWEXdKMjy; commit aa27c779d9e2a209544667462e4760bc782def52; status READY.
- URL: https://epic-uui-development-dg3z1hswq-automation-4515s-projects.vercel.app/uui-login
- Browser verified login renders and /uui-home redirects to login when signed out.
- Restored authenticated EXECUTE only on existing search_epic_customers(text,integer) and search_epic_inbound_only_customers(text,integer). Verified named Team Test finds synthetic records and Workstation Test is rejected by existing function checks.
- Employee browser sign-in returned Invalid login credentials. No live password or Auth configuration changed. Full signed-in browser acceptance remains outstanding.
- Automated temporary share link request was rejected by approval review; use the signed-in Vercel browser instead. Do not disable protection.
- Remaining: original Sales RPC permissions, operational mutation/outbound isolation, authenticated workspace flows, EXC fixtures and full completion checks, and extension availability verification. Do not call the combined application complete until these pass.
