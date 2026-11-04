/** Existing internal messaging, call dismissal and saved quote drafts only. */
export function allowsUuiInternalWrite(
  pathname: string,
  method: string,
  env: Record<string, string | undefined>,
) {
  return env.VERCEL_PROJECT_ID === "prj_lZGiQ85J6jQRgSRostBvUJGVKv6r"
    && ["preview", "development"].includes(env.VERCEL_ENV || "")
    && env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") === "https://jgpihdpcdlqugmqanzfj.supabase.co"
    && ((pathname === "/api/team/readiness/notes" && ["POST", "PATCH", "DELETE"].includes(method)) || (pathname === "/api/sales/unified-notes" && ["POST", "PATCH"].includes(method)) || (["/api/auth/refresh-session", "/api/team/epic-ping", "/api/team/live-calls", "/api/sales/live-calls", "/api/team/readiness/note-flags", "/api/sales/quotes"].includes(pathname)
    && method === "POST"));
}
