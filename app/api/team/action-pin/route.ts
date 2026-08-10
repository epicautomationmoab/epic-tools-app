import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { verifyTeamProfilePin } from "@/lib/server/team-pin";
import { supabaseSelect } from "@/lib/server/supabase-rest";

type PinProfileRow = {
  id: string;
  display_name: string;
  role: "admin" | "manager" | "agent" | "workstation";
  active: boolean;
  pin_set_at: string | null;
};

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function canUseActionPin(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  return Boolean(profile || hasPreviewAccess(request));
}

export async function GET(request: NextRequest) {
  if (!await canUseActionPin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const rows = await supabaseSelect<PinProfileRow>(
      "team_profiles",
      new URLSearchParams({
        select: "id,display_name,role,active,pin_set_at",
        active: "eq.true",
        role: "neq.workstation",
        pin_set_at: "not.is.null",
        order: "display_name.asc",
      }),
    );

    return NextResponse.json({
      profiles: rows.map((row) => ({ id: row.id, display_name: row.display_name, role: row.role })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load PIN-enabled employees." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!await canUseActionPin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { displayName?: string; pin?: string } | null;
  const displayName = body?.displayName?.trim() || "";
  const pin = body?.pin?.trim() || "";

  if (!displayName || !pin) {
    return NextResponse.json({ error: "Employee and PIN are required." }, { status: 400 });
  }

  try {
    const rows = await supabaseSelect<PinProfileRow>(
      "team_profiles",
      new URLSearchParams({
        select: "id,display_name,role,active,pin_set_at",
        display_name: `eq.${displayName}`,
        active: "eq.true",
        role: "neq.workstation",
        limit: "1",
      }),
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Employee was not found." }, { status: 404 });
    if (!row.pin_set_at) return NextResponse.json({ error: "This employee has not set a PIN yet." }, { status: 409 });

    const verified = await verifyTeamProfilePin(row.id, pin);
    if (!verified) return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });

    return NextResponse.json({
      ok: true,
      profile: {
        id: verified.id,
        display_name: verified.display_name,
        role: verified.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify PIN." },
      { status: 500 },
    );
  }
}
