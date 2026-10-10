import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { podiumWebhookRequest } from "@/lib/server/podium";

export const dynamic = "force-dynamic";
const EVENTS = ["message.received", "message.sent", "message.failed"];
const PREVIEW_WEBHOOK_URL = "https://epic-tools-app-git-feature-c36-83802a-automation-4515s-projects.vercel.app/api/webhooks/podium-messages";


const SUPABASE_RECEIVER = "https://kbuxcvqzicnydqllyong.supabase.co/functions/v1/podium-sms-webhook";
async function loadSigningSecret() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase server configuration.");
  const r = await fetch(`${url.replace(/\\/+$/, "")}/rest/v1/podium_webhook_settings?id=eq.primary&select=signing_secret&limit=1`,{
    headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store",
  });
  if(!r.ok) throw new Error("Unable to load signing secret.");
  const rows=await r.json() as Array<{signing_secret:string}>;
  if(!rows[0]?.signing_secret)throw new Error("Podium webhook secret not configured.");
  return rows[0].signing_secret;
}

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

  try {
    const secret = await loadSigningSecret();
    const listed = await podiumWebhookRequest("GET");
    const entries = (listed.result && typeof listed.result === "object" ? listed.result : {}) as Record<string,unknown>;
    const records = [entries.data, entries.items, entries.webhooks, listed.result].find(Array.isArray) as Array<Record<string,unknown>>|undefined || [];
    const existing = records.find(row => String(row.url || "") === SUPABASE_RECEIVER);
    if(existing) return NextResponse.json({ok:true,already_exists:true});
    const old = records.find(row => String(row.url || "") === PREVIEW_WEBHOOK_URL);
    if (!old) return NextResponse.json({error:"Existing preview webhook not found; no changes made."},{status:409});
    const uid = String(old.uid || old.id || "");
    if(!uid)return NextResponse.json({error:"Podium did not provide the existing webhook ID."},{status:409});
    const {result} = await podiumWebhookRequest("PUT", {
      eventTypes: EVENTS,
      locationUid: listed.locationUid,
      secret,
      url: SUPABASE_RECEIVER,
    },uid);
    return NextResponse.json({ok:true,updated:true,result});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Podium webhook creation failed."},{status:502});
  }
}
