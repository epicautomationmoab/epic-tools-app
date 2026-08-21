import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAuthenticatedTeamProfile, type TeamProfile } from "@/lib/team-auth";

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function getGuestFormsActor(request: NextRequest): Promise<{ profile: TeamProfile | null; actorName: string; actorId: string | null } | null> {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (profile) return { profile, actorName: profile.display_name, actorId: profile.id };

  const password = process.env.EPIC_HQ_RECEPTION_PASSWORD?.trim();
  const workstationCookie = request.cookies.get("epic_workstation_access")?.value;
  if (!password || !workstationCookie || workstationCookie !== sha256Hex(password)) return null;

  return { profile: null, actorName: "HQ Reception", actorId: null };
}
