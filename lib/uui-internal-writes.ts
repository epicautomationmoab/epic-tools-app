/** Only existing internal messaging may write through the UUI preview boundary. */
export function allowsUuiInternalWrite(
  pathname: string,
  method: string,
  env: Record<string, string | undefined>,
) {
  return env.VERCEL_PROJECT_ID === "prj_lZGiQ85J6jQRgSRostBvUJGVKv6r"
    && ["preview", "development"].includes(env.VERCEL_ENV || "")
    && env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") === "https://jgpihdpcdlqugmqanzfj.supabase.co"
    && pathname === "/api/team/epic-ping"
    && method === "POST";
}
