import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type PreferenceRow = {
  readiness_id: string;
  confirmation_code: string;
  send_mode: "review_request" | "thank_you_only";
  updated_by: string | null;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  const actor = await getGuestFormsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const readinessId = request.nextUrl.searchParams.get("readinessId")?.trim();
  if (!readinessId) return NextResponse.json({ error: "readinessId is required." }, { status: 400 });

  try {
    const rows = await supabaseSelect<PreferenceRow>(
      "post_visit_email_preferences",
      new URLSearchParams({
        select: "readiness_id,confirmation_code,send_mode,updated_by,updated_at",
        readiness_id: `eq.${readinessId}`,
        limit: "1",
      }),
    );

    return NextResponse.json({
      sendMode: rows[0]?.send_mode ?? "review_request",
      updatedBy: rows[0]?.updated_by ?? null,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load post-visit email preference." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getGuestFormsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = await request.json();
    const readinessId = String(body?.readinessId ?? "").trim();
    const confirmationCode = String(body?.confirmationCode ?? "").trim().toUpperCase();
    const sendMode = String(body?.sendMode ?? "").trim();

    if (!readinessId || !confirmationCode) {
      return NextResponse.json({ error: "readinessId and confirmationCode are required." }, { status: 400 });
    }
    if (sendMode !== "review_request" && sendMode !== "thank_you_only") {
      return NextResponse.json({ error: "Invalid sendMode." }, { status: 400 });
    }

    const existing = await supabaseSelect<PreferenceRow>(
      "post_visit_email_preferences",
      new URLSearchParams({ select: "readiness_id,confirmation_code,send_mode,updated_by,updated_at", readiness_id: `eq.${readinessId}`, limit: "1" }),
    );

    if (existing.length) {
      await supabasePatch(
        "post_visit_email_preferences",
        new URLSearchParams({ readiness_id: `eq.${readinessId}` }),
        {
          confirmation_code: confirmationCode,
          send_mode: sendMode,
          updated_by: actor.actorName,
          updated_at: new Date().toISOString(),
        },
      );
    } else {
      await supabaseInsert<PreferenceRow>("post_visit_email_preferences", {
        readiness_id: readinessId,
        confirmation_code: confirmationCode,
        send_mode: sendMode,
        updated_by: actor.actorName,
      });
    }

    return NextResponse.json({ ok: true, sendMode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save post-visit email preference." }, { status: 500 });
  }
}
