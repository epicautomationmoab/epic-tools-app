# Command Center shared-authorization preview
Branch: `feature/command-center-auth-foundation` (non-production).
Files: `command-center/auth-policy.mjs`, `command-center/auth-policy.test.mjs`.

Run locally: `node --test command-center/auth-policy.test.mjs`

This is a **tested-policy candidate**, not live authorization and not an SSO implementation.
It has no imports in existing routes. It only formalizes roles and workspace entitlements.
Before integration, compare team roles against actual EpicTools and C360 API checks, and confirm product permissions with management. Do not trust visible navigation as authorization.

Verified differences to resolve:
- EpicTools and C360 both authenticate using Supabase Auth and `epic_access_token`, but have different login/session cookie expiration rules.
- Existing guest portal is explicitly excluded from employee workspace authentication changes.
- Manager team-activity audit read and admin-sensitive-session audit read are separate scopes.
- Cookies from distinct hosts are not automatically shared and require deliberate auth handoff; do not copy tokens via URL.
- Existing login endpoints currently do not themselves show persistent device-session logging.

Acceptance before production:
1. Confirm active user's Supabase id / role, including inactive and workstation test accounts.
2. Verify server-side authorization on every API; deny unauthorized direct route access.
3. Validate current C360 and Readiness work, guest portal, and two-device login remain unchanged.
4. Resolve expiry/refresh strategy, logout/revocation, domain and CSRF behavior.
5. Verify manager audit query is read-only, scoped, and excludes sensitive PII.
6. Migrate incrementally with feature flags and rollback.

No production files, keys, database objects or deployments are modified by these files.
