import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../../lib/team-auth";

const SUPABASE_URL=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

export async function POST(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!profile||!token||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.session!=="string"||typeof body.extension!=="string"||typeof body.event_time!=="string"||typeof body.restore!=="boolean")return NextResponse.json({error:"Invalid call correction."},{status:400});
 const reasons=["general_question","reservation_service","vendor","wrong_number","other"];
 if(!body.restore&&!reasons.includes(body.reason))return NextResponse.json({error:"Choose a reason."},{status:400});
 const result=await fetch(SUPABASE_URL+"/rest/v1/rpc/set_phone_sales_lead_override",{
  method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({p_session:body.session,p_extension:body.extension,p_event_time:body.event_time,p_reason:body.restore?"restored":body.reason,p_restore:body.restore}),cache:"no-store"
 });
 if(!result.ok)return NextResponse.json({error:"Unable to save correction: "+await result.text()},{status:result.status});
 return NextResponse.json({ok:true});
}
