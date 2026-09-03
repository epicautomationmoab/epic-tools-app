import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseAdminConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase admin configuration is missing.");
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: url.replace(/\/+$/, ""), key };
}

async function callRpc<T>(name: string, body: Record<string, unknown>) {
  const { url, key } = getSupabaseAdminConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error((await response.text()) || `Unable to run ${name}.`);
  return response.json() as Promise<T>;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("epic_access_token")?.value;
    const profile = await getAuthenticatedTeamProfile(accessToken);
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (profile.role !== "manager" && profile.role !== "admin") {
      return NextResponse.json({ error: "Manager or Admin required." }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const readinessId = typeof payload?.readiness_id === "string" ? payload.readiness_id : "";
    if (!readinessId) return NextResponse.json({ error: "Missing readiness_id" }, { status: 400 });

    const result = await callRpc("set_rental_damage_deposit_hold", {
      p_readiness_id: readinessId,
      p_do_not_release: false,
      p_reason: null,
      p_updated_by: profile.display_name,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to release deposit hold." },
      { status: 500 },
    );
  }
}
