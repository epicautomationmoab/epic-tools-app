import type { NextRequest } from "next/server";
import { getAuthenticatedTeamProfile, type TeamProfile } from "@/lib/team-auth";

// Legacy name retained for existing imports. All staff actions now require
// an individually authenticated, active employee. Shared HQ access is denied.
export async function getGuestFormsActor(request: NextRequest): Promise<{ profile: TeamProfile; actorName: string; actorId: string } | null> {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return null;
  return { profile, actorName: profile.display_name, actorId: profile.id };
}
