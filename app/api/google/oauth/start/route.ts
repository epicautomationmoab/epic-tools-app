import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_STATE_COOKIE = "epic_google_oauth_state";
const OAUTH_MAILBOX_COOKIE = "epic_google_oauth_mailbox";
const DEFAULT_MAILBOX = "hello@epic4x4adventures.com";
const ALLOWED_MAILBOXES = new Set([
  DEFAULT_MAILBOX,
  "customerservice@epic4x4adventures.com",
]);

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

  try {
    const requestedMailbox = (request.nextUrl.searchParams.get("mailbox") || DEFAULT_MAILBOX).trim().toLowerCase();
    if (!ALLOWED_MAILBOXES.has(requestedMailbox)) {
      return NextResponse.json({ error: "That Gmail mailbox is not approved for Epic OAuth." }, { status: 400 });
    }

    const clientId = requiredEnv("GOOGLE_GMAIL_CLIENT_ID");
    const state = crypto.randomBytes(24).toString("hex");
    const redirectUri = `${request.nextUrl.origin}/api/google/oauth/callback`;

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent select_account");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("scope", "openid email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly");
    url.searchParams.set("state", state);
    url.searchParams.set("login_hint", requestedMailbox);

    const response = NextResponse.redirect(url);
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/api/google/oauth",
      maxAge: 10 * 60,
    };
    response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
    response.cookies.set(OAUTH_MAILBOX_COOKIE, requestedMailbox, cookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start Google authorization." }, { status: 500 });
  }
}
