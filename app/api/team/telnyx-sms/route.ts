import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

const EPIC_TELNYX_NUMBER="+14352207775";
function normalized(input:unknown){
  const digits=String(input||"").replace(/[^0-9]/g,"");
  return digits.length===10?"+1"+digits:digits.length===11&&digits.startsWith("1")?"+"+digits:null;
}
export async function POST(req:NextRequest){
  const authorization=req.headers.get("authorization")||"";
  const token=authorization.startsWith("Bearer ")?authorization.slice(7):req.cookies.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(token);
  if(!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
  const input=await req.json().catch(()=>null);
  const to=normalized(input?.phone),message=String(input?.message_text||"").trim();
  if(!to||to===EPIC_TELNYX_NUMBER)return NextResponse.json({error:"Invalid recipient phone."},{status:400});
  if(!message||message.length>1600)return NextResponse.json({error:"Message must be 1 to 1600 characters."},{status:400});
  const telnyxKey=process.env.TELNYX_API_KEY?.trim();
  if(!telnyxKey)return NextResponse.json({error:"Telnyx outbound is not activated; TELNYX_API_KEY is missing."},{status:503});
  try{
    const {url}=getServerSupabaseConfig();
    const customer=await fetch(url+"/rest/v1/telnyx_text_messages?customer_phone=eq."+encodeURIComponent(to)+"&epic_number=eq."+encodeURIComponent(EPIC_TELNYX_NUMBER)+"&direction=eq.inbound&select=message_id&limit=1",{headers:serverSupabaseHeaders(),cache:"no-store"});
    if(!customer.ok)throw new Error("Unable to verify Telnyx conversation.");
    const history=await customer.json() as Array<{message_id:string}>;
    if(!history.length)return NextResponse.json({error:"This customer has no verified incoming 7775 conversation."},{status:409});
    const sent=await fetch("https://api.telnyx.com/v2/messages",{method:"POST",headers:{Authorization:"Bearer "+telnyxKey,"Content-Type":"application/json"},body:JSON.stringify({from:EPIC_TELNYX_NUMBER,to,text:message}),signal:AbortSignal.timeout(15000)});
    const response=await sent.json().catch(()=>null);
    if(!sent.ok)return NextResponse.json({error:"Telnyx rejected the outbound message.",provider_status:sent.status},{status:502});
    const id=String(response?.data?.id||"");
    if(!id)return NextResponse.json({error:"Telnyx response missing message ID; delivery status needs review."},{status:502});
    const row={message_id:id,event_id:id,customer_phone:to,epic_number:EPIC_TELNYX_NUMBER,direction:"outbound",body:message,occurred_at:new Date().toISOString()};
    const saved=await fetch(url+"/rest/v1/telnyx_text_messages?on_conflict=message_id",{method:"POST",headers:{...serverSupabaseHeaders(),"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(row)});
    if(!saved.ok)return NextResponse.json({error:"Telnyx accepted the SMS, but C360 history could not be saved. Do not retry until reconciled.",message_id:id},{status:502});
    return NextResponse.json({ok:true,message_id:id,provider:"telnyx",from:EPIC_TELNYX_NUMBER});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to send Telnyx SMS."},{status:502});}
}
