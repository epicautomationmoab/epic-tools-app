import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

type IncidentAction = "claim" | "resolve" | "reopen";

type ActionBody = {
  incidentId?: string;
  action?: IncidentAction;
  note?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseConfig() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

function supabaseHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function getActor(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (profile) return profile.display_name || profile.email || "EpicTools team member";

  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (workstation) return "EpicTools workstation";

  if (hasPreviewAccess(request)) return "EpicTools preview";
  return null;
}

function patchForAction(action: IncidentAction, actor: string, note?: string) {
  const now = new Date().toISOString();

  if (action === "claim") {
    return { status: "claimed", claimed_by: actor, claimed_at: now, updated_at: now };
  }

  if (action === "resolve") {
    return {
      status: "resolved",
      resolved_by: actor,
      resolved_at: now,
      resolution_note: note?.trim() || "Resolved by EpicTools team member.",
      updated_at: now,
    };
  }

  return {
    status: "open",
    claimed_by: null,
    claimed_at: null,
    resolved_by: null,
    resolved_at: null,
    resolution_note: note?.trim() || null,
    updated_at: now,
  };
}

export async function GET(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { url, key } = getSupabaseConfig();
    const params = new URLSearchParams({
      select: "id,confirmation_code,recipient_email,failure_type,failure_detail,status,claimed_by,created_at,updated_at",
      status: "neq.resolved",
      order: "created_at.desc",
      limit: "100",
    });
    const response = await fetch(`${url}/rest/v1/guest_email_delivery_incidents?${params}`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Unable to load delivery incidents: ${await response.text()}`);
    const incidents = await response.json() as Array<{ confirmation_code: string }>;
    return NextResponse.json({
      activeCount: incidents.length,
      confirmationCodes: [...new Set(incidents.map((incident) => incident.confirmation_code).filter(Boolean))],
      incidents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delivery incident query error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: ActionBody;
  try { body = (await request.json()) as ActionBody; }
  catch { return NextResponse.json({ error: "A JSON body is required." }, { status: 400 }); }

  const incidentId = body.incidentId?.trim();
  const action = body.action;
  if (!incidentId) return NextResponse.json({ error: "incidentId is required." }, { status: 400 });
  if (!action || !["claim", "resolve", "reopen"].includes(action)) {
    return NextResponse.json({ error: "action must be claim, resolve, or reopen." }, { status: 400 });
  }

  try {
    const { url, key } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/guest_email_delivery_incidents?id=eq.${encodeURIComponent(incidentId)}`, {
      method: "PATCH",
      headers: { ...supabaseHeaders(key), Prefer: "return=representation" },
      body: JSON.stringify(patchForAction(action, actor, body.note)),
    });
    if (!response.ok) throw new Error(`Unable to update delivery incident: ${await response.text()}`);

    const rows = await response.json() as Array<{
      id: string;
      confirmation_code: string;
      status: string;
      claimed_by: string | null;
      resolved_by: string | null;
      resolution_note: string | null;
    }>;
    const incident = rows[0] ?? null;
    if (!incident) return NextResponse.json({ error: "Delivery incident not found." }, { status: 404 });
    return NextResponse.json({ ok: true, incident });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delivery incident action error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
