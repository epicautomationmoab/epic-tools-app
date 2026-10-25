import type { NextRequest } from "next/server";
import { getAuthenticatedTeamProfile, type TeamProfile } from "@/lib/team-auth";

export type ActionIdentity = {
  profile: TeamProfile;
  actorName: string;
  sharedSession: false;
};

// No PIN or preview-cookie fallback: each operational action must be linked to
// an independently authenticated, active employee.
export async function resolveActionIdentity(
  request: NextRequest,
  _body?: { actorDisplayName?: string; actorPin?: string },
): Promise<ActionIdentity | null> {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return null;
  return { profile, actorName: profile.display_name, sharedSession: false };
}

// Preview access only controls visibility of a preview shell, never authority
// to perform a staff action.
export function requestHasEpicToolsAccess(_request: NextRequest) {
  return false;
}
