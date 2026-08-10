import { NextRequest, NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import { getCancellationPopupCandidates } from "@/lib/server/cancellation-popup-candidates";
import { sendTeamPushNotification, webPushConfigured } from "@/lib/server/web-push";

type TeamProfile = { id: string; tripworks_user_id: number | null; active: boolean };

type WebhookPayload = {
  type?: string;
  record?: {
    confirmation_code?: string;
    reserved_at?: string | null;
    latest_payload?: Record<string, unknown> | null;
    trip_payload?: Record<string, unknown> | null;
  } | null;
};

function creatorId(payload: Record<string, unknown> | null | undefined) {
  const creator = payload?.created_by_user_avatar;
  if (!creator || typeof creator !== "object") return null;
  const id = (creator as { id?: unknown }).id;
  if (typeof id === "number") return id;
  if (typeof id === "string" && /^\d+$/.test(id)) return Number(id);
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.EPIC_PUSH_WEBHOOK_SECRET?.trim();
  const suppliedSecret = request.headers.get("x-epic-push-secret")?.trim();
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!webPushConfigured()) return NextResponse.json({ error: "Web push is not configured." }, { status: 503 });

  const payload = await request.json().catch(() => null) as WebhookPayload | null;
  const record = payload?.record;
  const confirmationCode = record?.confirmation_code?.trim();
  const source = record?.latest_payload ?? record?.trip_payload;
  const tripworksUserId = creatorId(source);
  if (!confirmationCode || !tripworksUserId) return NextResponse.json({ ok: true, skipped: "No salesperson booking identity." });

  const profiles = await supabaseSelect<TeamProfile>(
    "team_profiles",
    new URLSearchParams({
      select: "id,tripworks_user_id,active",
      tripworks_user_id: `eq.${tripworksUserId}`,
      active: "eq.true",
      limit: "1",
    }),
  );
  const profile = profiles[0];
  if (!profile) return NextResponse.json({ ok: true, skipped: "No active EpicTools salesperson profile." });

  const since = record?.reserved_at ? new Date(record.reserved_at) : new Date(Date.now() - 30_000);
  const safeSince = Number.isNaN(since.getTime()) ? new Date(Date.now() - 30_000) : since;

  let matching = [] as Awaited<ReturnType<typeof getCancellationPopupCandidates>>;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidates = await getCancellationPopupCandidates(tripworksUserId, safeSince);
    matching = candidates.filter((candidate) => candidate.confirmation_code === confirmationCode);
    if (matching.length) break;
    await sleep(1000);
  }

  if (!matching.length) {
    return NextResponse.json({ ok: true, skipped: "Readiness row was not available before push timeout." });
  }

  let attempted = 0;
  let delivered = 0;
  for (const candidate of matching) {
    if (!candidate.readiness_id) continue;
    const result = await sendTeamPushNotification({
      teamProfileId: profile.id,
      title: "Cancellation acknowledgement ready",
      body: `${candidate.customer_name} · ${candidate.product_display_name}`,
      readinessId: candidate.readiness_id,
      confirmationCode: candidate.confirmation_code,
    });
    attempted += result.attempted;
    delivered += result.delivered;
  }

  return NextResponse.json({ ok: true, confirmationCode, attempted, delivered });
}
