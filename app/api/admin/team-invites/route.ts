import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedTeamProfile,
  inviteTeamProfile,
  linkTeamProfileUser,
  listSupabaseAuthUsers,
  listTeamProfiles,
  sendTeamPasswordReset,
} from "@/lib/team-auth";

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function isAuthorizedManager(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (profile?.role === "admin" || profile?.role === "manager") return true;
  return hasPreviewAccess(request);
}

export async function GET(request: NextRequest) {
  if (!await isAuthorizedManager(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const [profiles, authUsers] = await Promise.all([
      listTeamProfiles(),
      listSupabaseAuthUsers(),
    ]);

    const authByEmail = new Map(
      authUsers
        .filter((user) => user.email)
        .map((user) => [user.email!.trim().toLowerCase(), user]),
    );

    const reconciledProfiles = await Promise.all(
      profiles.map(async (profile) => {
        const authUser = authByEmail.get(profile.email.trim().toLowerCase());
        const authAccountActivated = Boolean(
          authUser?.id && (authUser.last_sign_in_at || authUser.email_confirmed_at),
        );

        if (!profile.user_id && authUser?.id && authAccountActivated && profile.role !== "workstation") {
          await linkTeamProfileUser(profile.id, authUser.id);
          return { ...profile, user_id: authUser.id };
        }

        return profile;
      }),
    );

    const enrichedProfiles = reconciledProfiles.map((profile) => {
      const authUser = authByEmail.get(profile.email.trim().toLowerCase());
      const invitationPending = Boolean(
        !profile.user_id &&
        authUser?.id &&
        authUser.invited_at &&
        !authUser.last_sign_in_at &&
        !authUser.email_confirmed_at,
      );

      return {
        ...profile,
        invitation_pending: invitationPending,
        invitation_sent_at: invitationPending ? authUser?.invited_at ?? null : null,
      };
    });

    return NextResponse.json({ profiles: enrichedProfiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load team profiles." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!await isAuthorizedManager(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const action = body?.action === "reset_password" ? "reset_password" : "invite";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    if (action === "reset_password") {
      const redirectTo = `${request.nextUrl.origin}/auth/reset-password`;
      const result = await sendTeamPasswordReset(email, redirectTo);
      return NextResponse.json({ success: true, resetSent: true, profile: result.profile });
    }

    const redirectTo = `${request.nextUrl.origin}/auth/accept-invite`;
    const result = await inviteTeamProfile(email, redirectTo);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to manage employee authentication." },
      { status: 500 },
    );
  }
}
