import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

async function requireEmployee(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return null;
  return profile;
}

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const context = request.nextUrl.searchParams.get("context") || "all";

  try {
    const alerts = await rest<Array<{id:string;context_kind:string;opportunity_id:string|null;reservation_id:string|null;alert_kind:string;call_started_at:string|null;caller_name:string|null;caller_phone:string|null}>>(
      `call_attention_alerts?status=eq.open&select=id,context_kind,opportunity_id,reservation_id,alert_kind,call_started_at,caller_name,caller_phone&order=created_at.desc&limit=500`,
    );
    const filtered = alerts.filter((a) => context === "all" || (context === "leads" && a.context_kind === "sales_opportunity") || (context === "readiness" && a.context_kind === "reservation"));

    const oppIds = [...new Set(filtered.map(a=>a.opportunity_id).filter((v):v is string=>Boolean(v)))];
    const resIds = [...new Set(filtered.map(a=>a.reservation_id).filter((v):v is string=>Boolean(v)))];
    const [opps,reservations] = await Promise.all([
      oppIds.length ? rest<Array<{id:string;customer_name:string|null;phone_e164:string|null}>>(`sales_opportunities?id=in.(${oppIds.map(id=>`"${id}"`).join(",")})&select=id,customer_name,phone_e164`) : Promise.resolve([]),
      resIds.length ? rest<Array<{id:string;confirmation_code:string|null;customer_name:string|null;customer_phone:string|null}>>(`operational_reservations?id=in.(${resIds.map(id=>`"${id}"`).join(",")})&select=id,confirmation_code,customer_name,customer_phone`) : Promise.resolve([]),
    ]);
    const oppMap = new Map(opps.map(o=>[o.id,o]));
    const resMap = new Map(reservations.map(r=>[r.id,r]));

    return NextResponse.json({ ok:true, alerts: filtered.map(a=>({
      ...a,
      customer_name: a.opportunity_id ? oppMap.get(a.opportunity_id)?.customer_name || a.caller_name : a.reservation_id ? resMap.get(a.reservation_id)?.customer_name || a.caller_name : a.caller_name,
      phone: a.opportunity_id ? oppMap.get(a.opportunity_id)?.phone_e164 || a.caller_phone : a.reservation_id ? resMap.get(a.reservation_id)?.customer_phone || a.caller_phone : a.caller_phone,
      confirmation_code: a.reservation_id ? resMap.get(a.reservation_id)?.confirmation_code || null : null,
    })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load call alerts." }, { status:500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(()=>null) as { opportunity_id?:string; reservation_id?:string } | null;
  const opportunityId = body?.opportunity_id?.trim();
  const reservationId = body?.reservation_id?.trim();
  if (!opportunityId && !reservationId) return NextResponse.json({ error:"Opportunity or reservation is required." }, {status:400});

  try {
    const now = new Date().toISOString();
    const filter = opportunityId ? `opportunity_id=eq.${encodeURIComponent(opportunityId)}` : `reservation_id=eq.${encodeURIComponent(reservationId!)}`;
    await rest<void>(`call_attention_alerts?status=eq.open&${filter}`, {
      method:"PATCH",
      headers:{Prefer:"return=minimal"},
      body:JSON.stringify({status:"acknowledged",acknowledged_at:now,acknowledged_by_profile_id:profile.id,acknowledged_by_name:profile.display_name}),
    });
    return NextResponse.json({ok:true});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to acknowledge call alert."},{status:500});
  }
}
