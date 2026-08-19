import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function canManageUsers(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (profile?.role === "admin" || profile?.role === "manager") return true;
  return hasPreviewAccess(request);
}

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase configuration is missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

type WebhookRow = {
  payload: {
    owner?: {
      id?: number | string | null;
      full_name?: string | null;
    } | null;
  } | null;
};

export async function GET(request: NextRequest) {
  if (!await canManageUsers(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const name = request.nextUrl.searchParams.get("name")?.trim() || "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 characters of the employee name." }, { status: 400 });
  }

  try {
    const { url, key } = getSupabaseConfig();
    const params = new URLSearchParams({
      select: "payload",
      event_type: "eq.payment_created",
      "payload->owner->>full_name": `ilike.*${name.replace(/[%*]/g, "")}*`,
      order: "received_at.desc",
      limit: "100",
    });

    const response = await fetch(`${url}/rest/v1/webhook_events?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`TripWorks lookup failed (${response.status}).`);
    }

    const rows = await response.json() as WebhookRow[];
    const unique = new Map<string, { id: number; full_name: string }>();

    for (const row of rows) {
      const rawId = row.payload?.owner?.id;
      const fullName = row.payload?.owner?.full_name?.trim();
      const id = typeof rawId === "number" ? rawId : Number(rawId);
      if (!Number.isInteger(id) || id <= 0 || !fullName) continue;
      unique.set(`${id}:${fullName.toLowerCase()}`, { id, full_name: fullName });
    }

    const matches = [...unique.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to look up TripWorks user." },
      { status: 500 },
    );
  }
}
