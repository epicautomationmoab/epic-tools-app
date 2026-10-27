import { NextResponse } from "next/server";

/** Configuration-only diagnostic. Never returns credentials or guest information. */
export async function GET() {
  const staging = process.env.EPIC_STAGING_NO_OUTBOUND === "true";
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let host = "";
  try { host = new URL(raw).hostname; } catch { /* report unavailable */ }
  const correctDatabase = host === "cchsrkhpvvrvcuepkqdu.supabase.co";
  const noLiveSendingKeys = !["RESEND_API_KEY", "TELNYX_API_KEY", "PODIUM_CLIENT_SECRET"]
    .some(key => Boolean(process.env[key]?.trim()));
  const serverKeyConfigured = Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
  const assessmentEnabled = process.env.EXP_ASSESSMENT_SERVER_ENABLED === "true";
  const basicPrerequisitesMet = staging && correctDatabase && noLiveSendingKeys && serverKeyConfigured;
  return NextResponse.json({
    environment: staging ? "isolated_staging" : "not_staging",
    checks: { correctDatabase, noLiveSendingKeys, serverKeyConfigured,
      assessmentEnabled, basicPrerequisitesMet },
  }, { status: basicPrerequisitesMet ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
