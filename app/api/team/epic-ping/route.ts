import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "@/lib/team-auth";
const base=(process.env.NEXT_PUBLIC_SUPABASE_URL||"https://kbuxcvqzicnydqllyong.supabase.co").replace(/\/+$/,"");
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"sb_publishable_Jw6uPe9tju4BGeUI6vkucQ_MI-EiRVZ";
async function call(req:NextRequest,fn:string,args:object){const token=req.cookies.get("epic_access_token")?.value;const profile=await getAuthenticatedTeamProfile(token);if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});const r=await fetch(base+"/rest/v1/rpc/"+fn,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(args),cache:"no-store"});const p=await r.json().catch(()=>({}));return NextResponse.json(p,{status:r.status});}
export async function GET(req:NextRequest){return call(req,"epic_ping_inbox",{});}
export async function POST(req:NextRequest){const b=await req.json().catch(()=>({}));return call(req,"epic_ping_action",{p_action:b.action,p_recipient:b.recipient||null,p_message:b.message||null,p_ping_id:b.id||null,p_reply_to:b.reply_to||null});}
