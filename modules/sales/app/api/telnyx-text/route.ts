import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";
export async function POST(request:NextRequest){
  const token=request.cookies.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(token);
  if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
  const body=await request.json().catch(()=>null);
  const response=await fetch(((process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || "") + "/api/team/telnyx-sms"),{
    method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({phone:body?.phone,message_text:body?.message_text}),cache:"no-store"
  });
  return new NextResponse(await response.text(),{status:response.status,headers:{"Content-Type":"application/json"}});
}
