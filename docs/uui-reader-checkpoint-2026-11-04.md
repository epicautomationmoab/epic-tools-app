# Existing reader access verification

Applied only to Epic UUI Development (jgpihdpcdlqugmqanzfj). Restored authenticated EXECUTE on 14 existing employee-authorized readers; function bodies, direct table grants, and anonymous permissions were not changed.

The real Supabase HTTP test passed all 42 checks: Jennifer test employee succeeds, anonymous denied, workstation denied or receives an empty result from SQL readers. Test output contains no records, credentials, or tokens. Run scripts/uui/verify-readers.py with a private test-account JSON path; do not commit that input.

This verifies database reader access, not completion of browser workflows or outbound integrations. Existing protected Preview remains deployed at commit aa27c779d9e2a209544667462e4760bc782def52. No application redeploy needed for these database grants.

Next acceptance work: verify existing write workflows against isolated data, including shared Epic Ping; review narrow middleware exceptions without enabling outbound delivery; verify protected Preview browser-to-server Sales relay and Admin/Management/EXC flows. Do not rebuild Readiness. Production and existing EXC staging remain untouched.
