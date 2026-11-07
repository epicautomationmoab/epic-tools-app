export function isIsolatedUui(env: Record<string,string|undefined>) {
  return env.VERCEL_PROJECT_ID === "prj_lZGiQ85J6jQRgSRostBvUJGVKv6r"
    && ["preview", "development"].includes(env.VERCEL_ENV || "")
    && env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") === "https://jgpihdpcdlqugmqanzfj.supabase.co";
}
/** Reviewed internal operations only; worker triggers and external delivery remain blocked. */
export function allowsUuiInternalWrite(
  pathname: string,
  method: string,
  env: Record<string, string | undefined>,
) {
  return env.VERCEL_PROJECT_ID === "prj_lZGiQ85J6jQRgSRostBvUJGVKv6r"
    && ["preview", "development"].includes(env.VERCEL_ENV || "")
    && env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") === "https://jgpihdpcdlqugmqanzfj.supabase.co"
    && ((/^\/api\/agreements\/[A-Za-z0-9_-]{32,128}$/.test(pathname) && method === "POST") || (pathname === "/api/admin/team-invites" && method === "PATCH") || (pathname === "/api/sales/followups" && ["POST", "PATCH"].includes(method)) || (pathname === "/api/team/readiness/notes" && ["POST", "PATCH", "DELETE"].includes(method)) || (pathname === "/api/sales/unified-notes" && ["POST", "PATCH"].includes(method)) || (["/api/team/readiness/handoff", "/api/admin/team-profiles", "/api/team/service-inbox", "/api/sales/inbox", "/api/team/tour-dispatch/guide", "/api/team/tour-dispatch/observation", "/api/deposits/hold", "/api/deposits/manually-released", "/api/sales/lead-sheets", "/api/team/cancellation-agreements", "/api/sales/cancellation-acknowledgement", "/api/sales/leads", "/api/auth/refresh-session", "/api/team/epic-ping", "/api/team/live-calls", "/api/sales/live-calls", "/api/team/readiness/note-flags", "/api/sales/quotes"].includes(pathname)
    && method === "POST"));
}
