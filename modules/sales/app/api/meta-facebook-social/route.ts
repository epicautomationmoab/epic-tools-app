import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
const base=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/[/]+$/,"");
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
export async function POST(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});
 const input=await request.json().catch(()=>null);
 const uid=String(input?.conversation_uid||""),message=String(input?.message_text||"").trim();
 if(!/^[0-9a-f-]{36}$/i.test(uid)||!message||message.length>1600)return NextResponse.json({error:"Valid conversation and reply required"},{status:400});
 const lookup=await fetch(base+"/rest/v1/rpc/c360_verified_facebook_social_recipient",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({p_conversation_uid:uid}),cache:"no-store"});
 if(!lookup.ok)return NextResponse.json({error:"Meta identity verification failed"},{status:502});
 const recipient=await lookup.json();
 if(typeof recipient!=="string"||!/^[0-9]{5,30}$/.test(recipient))return NextResponse.json({error:"No verified direct Meta identity for this Facebook conversation"},{status:403});
 const sent=await fetch(base+"/functions/v1/meta-messenger-send",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({recipient_id:recipient,message_text:message}),cache:"no-store"});
 return NextResponse.json(await sent.json().catch(()=>({error:"Meta reply unavailable"})),{status:sent.status});
}