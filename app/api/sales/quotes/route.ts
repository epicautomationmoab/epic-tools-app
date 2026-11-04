export {POST} from "@/modules/sales/app/api/quotes/route";
export const dynamic="force-dynamic";

import {NextRequest, NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "@/lib/team-auth";

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});

export async function GET(request:NextRequest) {
  const profile=await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if(!profile?.active || profile.role==='workstation') return reply({error:'Signed-in employee required.'},401);
  const quoteId=request.nextUrl.searchParams.get('quote');
  if(quoteId!==null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoteId)) return reply({error:'Valid quote ID required.'},400);
  const requestedLimit=Number(request.nextUrl.searchParams.get('limit') || 25);
  const limit=Number.isFinite(requestedLimit)?Math.max(1,Math.min(100,Math.trunc(requestedLimit))):25;
  const origin=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const secret=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!origin || !secret) return reply({error:'Quote storage unavailable.'},503);
  // These legacy readers have no employee guard. Keep them server-only; the
  // signed-in employee check above is mandatory before using the service key.
  const fn=quoteId?'get_epic_sales_quote_detail':'get_recent_epic_sales_quotes';
  try {
    const response=await fetch(`${origin}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(quoteId?{p_quote_id:quoteId}:{p_limit:limit}),cache:'no-store'});
    if(!response.ok) return reply({error:'Unable to load saved quotes.'},502);
    const result=await response.json();
    if(quoteId && !result) return reply({error:'Quote not found.'},404);
    return reply(result);
  } catch {return reply({error:'Quote storage is temporarily unavailable.'},502);}
}
