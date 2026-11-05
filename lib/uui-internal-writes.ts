export function isIsolatedUui(env: Record<string,string|undefined>) {
  return env.VERCEL_PROJECT_ID === "prj_lZGiQ85J6jQRgSRostBvUJGVKv6r"
    && ["preview", "development"].includes(env.VERCEL_ENV || "")
    && env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") === "https://jgpihdpcdlqugmqanzfj.supabase.co";
}
/** Existing internal messaging, call dismissal and saved quote drafts only. */
export function allowsUuiInternalWrite(
  pathname: string,
  method: string,
  env: Record<string, string | undefined>,
) {
  return env.VERCEL_PROJECT_ID === "prj_lZGiQ85J6jQRgSRostBvUJGVKv6r"
    && ["preview", "development"].includes(env.VERCEL_ENV || "")
    && env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") === "https://jgpihdpcdlqugmqanzfj.supabase.co"
    && ((pathname === "/api/sales/followups" && ["POST", "PATCH"].includes(method)) || (pathname === "/api/team/readiness/notes" && ["POST", "PATCH", "DELETE"].includes(method)) || (pathname === "/api/sales/unified-notes" && ["POST", "PATCH"].includes(method)) || (["/api/team/cancellation-agreements", "/api/sales/cancellation-acknowledgement", "/api/sales/leads", "/api/auth/refresh-session", "/api/team/epic-ping", "/api/team/live-calls", "/api/sales/live-calls", "/api/team/readiness/note-flags", "/api/sales/quotes"].includes(pathname)
    && method === "POST"));
}
