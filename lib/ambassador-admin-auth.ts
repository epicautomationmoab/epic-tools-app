import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export async function getAuthenticatedAmbassadorAdmin(accessToken: string | null | undefined) {
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) return null;
  return profile;
}
