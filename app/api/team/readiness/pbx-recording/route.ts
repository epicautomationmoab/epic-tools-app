import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function cfg(){
  const url=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
  const key=process.env.SUPABASE_SECRET_KEY||"";
  if(!url||!key) throw new Error("Supabase server configuration is missing.");
  return {url,key};
}

export async function GET(request:NextRequest){
  const profile=await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if(!profile||profile.role==="workstation") return NextResponse.json({error:"Employee login required."},{status:401});
  const callId=request.nextUrl.searchParams.get("call");
  if(!callId) return NextResponse.json({error:"Call ID is required."},{status:400});
  const {url,key}=cfg();
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  const meta=await fetch(`${url}/rest/v1/telnyx_call_recordings?grandstream_cdr_id=eq.${encodeURIComponent(callId)}&select=storage_path&order=updated_at.desc&limit=1`,{headers,cache:"no-store"});
  if(!meta.ok) return NextResponse.json({error:"Unable to load recording."},{status:500});
  const rows=await meta.json().catch(()=>[]) as Array<{storage_path:string|null}>;
  const path=rows[0]?.storage_path;
  if(!path) return NextResponse.json({error:"Recording is not available."},{status:404});
  const media=await fetch(`${url}/storage/v1/object/authenticated/call-recordings/${path.split("/").map(encodeURIComponent).join("/")}`,{headers,cache:"no-store"});
  if(!media.ok||!media.body) return NextResponse.json({error:"Unable to retrieve recording."},{status:502});
  return new NextResponse(media.body,{status:200,headers:{"Content-Type":media.headers.get("content-type")||"audio/wav","Content-Disposition":"inline","Cache-Control":"private, max-age=300"}});
}
