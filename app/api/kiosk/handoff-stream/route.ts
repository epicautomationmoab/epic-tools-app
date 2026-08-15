import { NextRequest } from "next/server";
import { supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const PUBLIC_PORTAL_ORIGIN = "https://myepicreservation.com";
const POLL_INTERVAL_MS = 1500;
const STREAM_LIFETIME_MS = 9000;
const KIOSKS = new Set(Array.from({ length: 7 }, (_, index) => `kiosk-${index + 1}`));

type KioskHandoffRow = {
  id: string;
  confirmation_code: string;
  created_at: string;
};

type PortalLookupRow = {
  guest_portal_token?: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function nextPendingHandoff(kioskId: string) {
  const handoffParams = new URLSearchParams({
    select: "id,confirmation_code,created_at",
    target_kiosk: `eq.${kioskId}`,
    status: "eq.pending",
    expires_at: `gt.${new Date().toISOString()}`,
    order: "created_at.asc",
    limit: "1",
  });
  const handoffs = await supabaseSelect<KioskHandoffRow>(
    "kiosk_handoffs",
    handoffParams,
  );
  const handoff = handoffs[0];
  if (!handoff) return null;

  const portalParams = new URLSearchParams({
    select: "guest_portal_token",
    confirmation_code: `eq.${handoff.confirmation_code}`,
    limit: "10",
  });
  const portalRows = await supabaseSelect<PortalLookupRow>("guest_portal_v", portalParams);
  const token = portalRows.find((row) => row.guest_portal_token)?.guest_portal_token?.trim();

  if (!token) {
    await supabasePatch(
      "kiosk_handoffs",
      new URLSearchParams({ id: `eq.${handoff.id}`, status: "eq.pending" }),
      {
        status: "failed",
        failure_reason: "Guest portal token could not be resolved.",
      },
    );
    return null;
  }

  await supabasePatch(
    "kiosk_handoffs",
    new URLSearchParams({ id: `eq.${handoff.id}`, status: "eq.pending" }),
    {
      status: "delivered",
      delivered_at: new Date().toISOString(),
    },
  );

  return {
    handoffId: handoff.id,
    portalPath: `${PUBLIC_PORTAL_ORIGIN}/guest/${encodeURIComponent(token)}`,
  };
}

export async function GET(request: NextRequest) {
  const kioskId = request.nextUrl.searchParams.get("kiosk")?.trim().toLowerCase();

  if (!kioskId || !KIOSKS.has(kioskId)) {
    return new Response("Invalid kiosk", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const deadline = Date.now() + STREAM_LIFETIME_MS;
      controller.enqueue(encoder.encode("retry: 750\n\n"));

      try {
        while (!request.signal.aborted && Date.now() < deadline) {
          const handoff = await nextPendingHandoff(kioskId);

          if (handoff) {
            controller.enqueue(
              encoder.encode(`event: handoff\ndata: ${JSON.stringify(handoff)}\n\n`),
            );
            break;
          }

          controller.enqueue(encoder.encode(": keepalive\n\n"));
          await sleep(POLL_INTERVAL_MS);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Kiosk handoff stream failed.";
        console.error("Kiosk handoff stream failed:", message);
        controller.enqueue(
          encoder.encode(
            `event: stream-error\ndata: ${JSON.stringify({ message: "Handoff unavailable." })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
