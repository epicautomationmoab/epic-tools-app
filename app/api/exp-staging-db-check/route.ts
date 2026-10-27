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
    const reason = error instanceof Error ? error.message : "";
    const upstreamStatus = reason.match(/\\b(400|401|403|404|405|406|409|500|502|503)\\b/)?.[1] ?? "unknown";
    console.error("EXP staging DB probe failed with upstream status", upstreamStatus);
    return NextResponse.json({ stagingDatabaseAuthenticated: false, failureCategory: upstreamStatus }, { status: 503,
      headers: { "Cache-Control": "no-store" } });
  }
}
