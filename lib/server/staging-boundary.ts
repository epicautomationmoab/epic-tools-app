/** Defensive runtime boundary for the isolated Epic Tools staging deployment.
 * This does not replace disabling credentials and external integrations. */
const STAGING_SUPABASE_HOST = "cchsrkhpvvrvcuepkqdu.supabase.co";
export function requireCorrectSupabaseEnvironment(rawUrl: string) {
  if (process.env.EPIC_STAGING_NO_OUTBOUND !== "true") return;
  let host: string;
  try { host = new URL(/^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`).hostname; }
  catch { throw new Error("Staging: invalid Supabase URL."); }
  if (host !== STAGING_SUPABASE_HOST) {
    throw new Error("Staging refused a non-staging Supabase database.");
  }
}
export function denyOutboundInStaging() {
  if (process.env.EPIC_STAGING_NO_OUTBOUND === "true") {
    throw new Error("Outbound guest communications and integrations are disabled in staging.");
  }
}
