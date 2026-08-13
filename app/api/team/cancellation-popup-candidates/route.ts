import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import { getCancellationPopupCandidates, type ReadinessCandidate } from "@/lib/server/cancellation-popup-candidates";

type OperationalReservation = {
  confirmation_code: string;
  latest_payload: Record<string, unknown> | null;
  trip_payload: Record<string, unknown> | null;
};

function creatorId(payload: Record<string, unknown> | null) {
  const creator = payload?.created_by_user_avatar;
  if (!creator || typeof creator !== "object") return null;
  const id = (creator as { id?: unknown }).id;
  if (typeof id === "number") return id;
  if (typeof id === "string" && /^\d+$/.test(id)) return Number(id);
  return null;
}

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (profile.role === "workstation" || !profile.tripworks_user_id) return NextResponse.json({ candidates: [] });

  const readinessId = request.nextUrl.searchParams.get("readinessId")?.trim();
  if (readinessId) {
    try {
      const rows = await supabaseSelect<ReadinessCandidate>(
        "guest_readiness_with_handoff_v",
        new URLSearchParams({ select: "*", readiness_id: `eq.${readinessId}`, limit: "1" }),
      );
      const candidate = rows[0];
      if (!candidate) return NextResponse.json({ candidates: [] });

      const reservations = await supabaseSelect<OperationalReservation>(
        "operational_reservations",
        new URLSearchParams({
          select: "confirmation_code,latest_payload,trip_payload",
          confirmation_code: `eq.${candidate.confirmation_code}`,
          limit: "20",
        }),
      );
      const belongsToSalesperson = reservations.some((reservation) => {
        const source = reservation.latest_payload ?? reservation.trip_payload;
        return creatorId(source) === profile.tripworks_user_id;
      });
      return NextResponse.json({ candidates: belongsToSalesperson ? [candidate] : [] });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load cancellation popup." }, { status: 500 });
    }
  }

  const rawSince = request.nextUrl.searchParams.get("since");
  const since = rawSince ? new Date(rawSince) : new Date(Date.now() - 30_000);
  if (Number.isNaN(since.getTime())) return NextResponse.json({ error: "Invalid since timestamp." }, { status: 400 });

  try {
    const candidates = await getCancellationPopupCandidates(profile.tripworks_user_id, since);
    return NextResponse.json({ candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load cancellation popup candidates." },
      { status: 500 },
    );
  }
}
