import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";
import { supabaseInsert, supabaseSelect } from "@/lib/server/supabase-rest";

type ReadinessLookupRow = {
  readiness_id?: string | null;
  confirmation_code?: string | null;
};

type KioskHandoffRow = {
  id: string;
  target_kiosk: string;
  status: string;
};

const KIOSKS = new Set(Array.from({ length: 7 }, (_, index) => `kiosk-${index + 1}`));

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(
    request.cookies.get("epic_access_token")?.value,
  );
  const workstationAuthorized = verifyWorkstationCookie(
    request.cookies.get(WORKSTATION_COOKIE)?.value,
  );

  if (!profile && !workstationAuthorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    readinessId?: string;
    kioskId?: string;
  } | null;

  const readinessId = body?.readinessId?.trim();
  const kioskId = body?.kioskId?.trim().toLowerCase();

  if (!readinessId || !kioskId || !KIOSKS.has(kioskId)) {
    return NextResponse.json(
      { error: "A valid reservation and kiosk are required." },
      { status: 400 },
    );
  }

  try {
    const params = new URLSearchParams({
      select: "readiness_id,confirmation_code",
      readiness_id: `eq.${readinessId}`,
      limit: "1",
    });
    const rows = await supabaseSelect<ReadinessLookupRow>(
      "guest_readiness_with_handoff_v",
      params,
    );
    const reservation = rows[0];
    const confirmationCode = reservation?.confirmation_code?.trim();

    if (!reservation || !confirmationCode) {
      return NextResponse.json(
        { error: "Reservation could not be resolved for kiosk handoff." },
        { status: 404 },
      );
    }

    const handoff = await supabaseInsert<KioskHandoffRow>("kiosk_handoffs", {
      target_kiosk: kioskId,
      readiness_id: readinessId,
      confirmation_code: confirmationCode,
      created_by: profile?.display_name || "HQ Reception",
    });

    return NextResponse.json({
      ok: true,
      handoffId: handoff.id,
      kioskId: handoff.target_kiosk,
      status: handoff.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send reservation to kiosk.";
    console.error("Kiosk handoff create failed:", message);
    return NextResponse.json(
      { error: "Unable to send reservation to kiosk." },
      { status: 500 },
    );
  }
}
