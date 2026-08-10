import type { NextRequest } from "next/server";
import { getAuthenticatedTeamProfile, type TeamProfile } from "@/lib/team-auth";
import { verifyTeamProfilePin } from "@/lib/server/team-pin";
import { supabaseSelect } from "@/lib/server/supabase-rest";

type PinProfileRow = {
  id: string;
  display_name: string;
  role: "admin" | "manager" | "agent" | "workstation";
  active: boolean;
  pin_set_at: string | null;
};

export type ActionIdentity = {
  profile: TeamProfile | null;
  actorName: string;
  sharedSession: boolean;
};

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

export async function resolveActionIdentity(
  request: NextRequest,
  body?: { actorDisplayName?: string; actorPin?: string },
): Promise<ActionIdentity | null> {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);

  if (profile && profile.role !== "workstation") {
    return { profile, actorName: profile.display_name, sharedSession: false };
  }

  const sharedSession = profile?.role === "workstation" || hasPreviewAccess(request);
  if (!sharedSession) return null;

  const actorDisplayName = body?.actorDisplayName?.trim() || "";
  const actorPin = body?.actorPin?.trim() || "";
  if (!actorDisplayName || !actorPin) {
    throw new Error("Select your name and enter your PIN.");
  }

  const rows = await supabaseSelect<PinProfileRow>(
    "team_profiles",
    new URLSearchParams({
      select: "id,display_name,role,active,pin_set_at",
      display_name: `eq.${actorDisplayName}`,
      active: "eq.true",
      role: "neq.workstation",
      limit: "1",
    }),
  );
  const actor = rows[0];
  if (!actor) throw new Error("Employee was not found.");
  if (!actor.pin_set_at) throw new Error("This employee has not set a PIN yet.");

  const verified = await verifyTeamProfilePin(actor.id, actorPin);
  if (!verified) throw new Error("Incorrect PIN.");

  return { profile, actorName: verified.display_name, sharedSession: true };
}

export function requestHasEpicToolsAccess(request: NextRequest) {
  return hasPreviewAccess(request);
}
