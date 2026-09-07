import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const OAUTH_STATE_COOKIE = "epic_google_oauth_state";
const EXPECTED_MAILBOX = "hello@epic4x4adventures.com";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const errorParam = request.nextUrl.searchParams.get("error");
  if (errorParam) return NextResponse.redirect(new URL(`/team/readiness/journey-preview?gmail=${encodeURIComponent(errorParam)}`, request.url));

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid Google OAuth state." }, { status: 400 });
  }

  try {
    const clientId = requiredEnv("GOOGLE_GMAIL_CLIENT_ID");
    const clientSecret = requiredEnv("GOOGLE_GMAIL_CLIENT_SECRET");
    const redirectUri = `${request.nextUrl.origin}/api/google/oauth/callback`;

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenPayload?.error_description || tokenPayload?.error || "Unable to exchange Google OAuth code.");

    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      cache: "no-store",
    });
    const userPayload = await userResponse.json();
    if (!userResponse.ok) throw new Error(userPayload?.error?.message || "Unable to verify Google mailbox.");

    const mailbox = String(userPayload?.email || "").trim().toLowerCase();
    if (mailbox !== EXPECTED_MAILBOX) {
      return NextResponse.redirect(new URL(`/team/readiness/journey-preview?gmail=wrong-account&connected=${encodeURIComponent(mailbox || "unknown")}`, request.url));
    }
    if (!tokenPayload.refresh_token) throw new Error("Google did not return a refresh token. Re-authorize with consent enabled.");

    const expiresAt = tokenPayload.expires_in ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString() : null;
    const { url } = getServerSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/google_mailbox_connections?mailbox_email=eq.${encodeURIComponent(EXPECTED_MAILBOX)}`, {
      method: "PUT",
      headers: serverSupabaseHeaders("resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify({
        mailbox_email: EXPECTED_MAILBOX,
        refresh_token: tokenPayload.refresh_token,
        access_token: tokenPayload.access_token,
        access_token_expires_at: expiresAt,
        scope: tokenPayload.scope || null,
        token_type: tokenPayload.token_type || null,
        connected_by: profile.display_name,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) throw new Error(`Unable to save Google mailbox connection: ${await response.text()}`);

    const redirect = NextResponse.redirect(new URL("/team/readiness/journey-preview?gmail=connected", request.url));
    redirect.cookies.delete(OAUTH_STATE_COOKIE);
    return redirect;
  } catch (error) {
    return NextResponse.redirect(new URL(`/team/readiness/journey-preview?gmail=error&message=${encodeURIComponent(error instanceof Error ? error.message : "Unable to connect Gmail")}`, request.url));
  }
}
