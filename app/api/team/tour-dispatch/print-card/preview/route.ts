import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";
import { renderTourWindshieldCardSvg } from "@/lib/tour-windshield-card";

type CardRow = {
  store_visit_id: string;
  confirmation_code: string;
  customer_name: string;
  product_display_name: string;
  visit_start_time: string;
  vehicle_slot: number;
};

function lastName(fullName: string) {
  const value = fullName.trim();
  const parts = value.split(/\s+/);
  return parts.at(-1) ?? value;
}

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (!profile && !workstation) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const storeVisitId = String(request.nextUrl.searchParams.get("store_visit_id") ?? "").trim();
    const vehicleSlot = Number(request.nextUrl.searchParams.get("vehicle_slot"));
    if (!storeVisitId || !Number.isInteger(vehicleSlot) || vehicleSlot < 1) {
      return NextResponse.json({ error: "Invalid tour vehicle slot." }, { status: 400 });
    }

    const params = new URLSearchParams({
      select: "store_visit_id,confirmation_code,customer_name,product_display_name,visit_start_time,vehicle_slot",
      store_visit_id: `eq.${storeVisitId}`,
      vehicle_slot: `eq.${vehicleSlot}`,
      limit: "1",
    });
    const [row] = await supabaseSelect<CardRow>("tour_vehicle_dispatch_roster_v", params);
    if (!row) return NextResponse.json({ error: "Tour card data was not found." }, { status: 404 });

    const svg = renderTourWindshieldCardSvg({
      guestLastName: lastName(row.customer_name),
      tourName: row.product_display_name,
      departureTime: row.visit_start_time,
      confirmationCode: row.confirmation_code,
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Windshield card preview failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to render windshield card." },
      { status: 500 },
    );
  }
}
