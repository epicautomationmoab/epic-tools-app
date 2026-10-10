import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { podiumWebhookRequest } from "@/lib/server/podium";

export const dynamic = "force-dynamic";
const EVENTS = ["message.received", "message.sent", "message.failed"];
const PREVIEW_WEBHOOK_URL = "https://epic-tools-app-git-feature-c36-83802a-automation-4515s-projects.vercel.app/api/webhooks/podium-messages";

function authorize(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\\s+(.+)$/i)?.[1];
  return getAuthenticatedTeamProfile(bearer || request.cookies.get("epic_access_token")?.value || null);
}

export async function GET(request: NextRequest) {
  const profile = await authorize(request);
  if (!profile || !["admin","manager"].includes(profile.role)) return NextResponse.json({error:"Manager access required."},{status:403});
  try {
    const {result} = await podiumWebhookRequest("GET");
    return NextResponse.json({ok:true, result});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Podium webhook listing failed."},{status:502});
  }
}

export async function POST(request: NextRequest) {
  const profile = await authorize(request);
  if (!profile || !["admin","manager"].includes(profile.role)) return NextResponse.json({error:"Manager access required."},{status:403});
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "feature/c360-podium-sms-2700") {
    return NextResponse.json({error:"This setup is restricted to the Podium preview branch."},{status:403});
  }
  const secret = process.env.PODIUM_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({error:"Missing preview Podium webhook signing secret."},{status:503});
  try {
    const listed = await podiumWebhookRequest("GET");
    const entries = (listed.result && typeof listed.result === "object" ? listed.result : {}) as Record<string,unknown>;
    const records = [entries.data, entries.items, entries.webhooks, listed.result].find(Array.isArray) as Array<Record<string,unknown>>|undefined || [];
    if (records.some(row=>String(row.url||"") === PREVIEW_WEBHOOK_URL)) {
      return NextResponse.json({ok:true,already_exists:true});
    }
    const {result} = await podiumWebhookRequest("POST", {
      eventTypes: EVENTS,
      locationUid: listed.locationUid,
      secret,
      url: PREVIEW_WEBHOOK_URL,
    });
    return NextResponse.json({ok:true,created:true,result});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Podium webhook creation failed."},{status:502});
  }
}
