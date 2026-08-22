import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";

export async function GET(request: NextRequest) {
  const actor = await getGuestFormsActor(request);

  if (!actor) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    mode: actor.profile ? "employee" : "workstation",
  });
}
