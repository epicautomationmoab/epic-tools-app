import { NextResponse } from "next/server";

// Shared HQ workstation authentication is retired. Require individual employee login.
export async function POST() {
  return NextResponse.json(
    { error: "Shared workstation login has been retired. Sign in with your employee account." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
