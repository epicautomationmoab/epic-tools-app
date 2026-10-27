import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/server/supabase-rest";

/** Safe staging-only authenticated database probe; never returns guest records. */
export async function GET() {
  if (process.env.EPIC_STAGING_NO_OUTBOUND !== "true")
    return NextResponse.json({ error: "Unavailable." }, { status: 404 });
  try {
    const tables = ["exp_sessions", "exp_participants", "exp_reconciliation_events"];
    for (const table of tables) {
      await supabaseSelect<{ id: string }>(table, new URLSearchParams({ select: "id", limit: "1" }));
    }
    return NextResponse.json({ stagingDatabaseAuthenticated: true, checkedTables: tables.length },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("EXP staging connection probe failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ stagingDatabaseAuthenticated: false }, { status: 503,
      headers: { "Cache-Control": "no-store" } });
  }
}
