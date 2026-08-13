import { NextRequest } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getCancellationPopupCandidates } from "@/lib/server/cancellation-popup-candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const POLL_INTERVAL_MS = 1500;
const STREAM_LIFETIME_MS = 9000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);

  if (!profile) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (profile.role === "workstation" || !profile.tripworks_user_id) {
    return new Response("No salesperson stream", { status: 204 });
  }

  const rawSince = request.nextUrl.searchParams.get("since");
  const since = rawSince ? new Date(rawSince) : new Date();
  if (Number.isNaN(since.getTime())) {
    return new Response("Invalid since timestamp", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sent = new Set<string>();
      const deadline = Date.now() + STREAM_LIFETIME_MS;

      controller.enqueue(encoder.encode("retry: 750\n\n"));

      try {
        while (!request.signal.aborted && Date.now() < deadline) {
          const candidates = await getCancellationPopupCandidates(profile.tripworks_user_id!, since);

          for (const candidate of candidates) {
            const key = candidate.readiness_id || `${candidate.confirmation_code}|${candidate.visit_start_time}|${candidate.business_line}`;
            if (sent.has(key)) continue;
            sent.add(key);
            controller.enqueue(encoder.encode(`event: booking\ndata: ${JSON.stringify(candidate)}\n\n`));
          }

          controller.enqueue(encoder.encode(": keepalive\n\n"));
          await sleep(POLL_INTERVAL_MS);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Cancellation popup stream failed.";
        controller.enqueue(encoder.encode(`event: stream-error\ndata: ${JSON.stringify({ message })}\n\n`));
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
