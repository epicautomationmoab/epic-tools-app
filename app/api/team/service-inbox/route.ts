import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

const SUPABASE_URL=(process.env.NEXT_PUBLIC_SUPABASE_URL||"https://kbuxcvqzicnydqllyong.supabase.co").replace(/\/+$/,"");
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"";

async function session(request:NextRequest){
  const accessToken=request.cookies.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(accessToken);
  return profile&&accessToken&&profile.role!=="workstation"?{profile,accessToken}:null;
}
async function rpc(accessToken:string,fn:string,body:Record<string,unknown>){
  if(!SUPABASE_KEY) throw new Error("Supabase publishable key is missing.");
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  const text=await r.text(); if(!r.ok) throw new Error(text||`Request failed (${r.status})`); return text?JSON.parse(text):null;
}
export async function GET(request:NextRequest){
  const s=await session(request); if(!s)return NextResponse.json({error:"Employee login required."},{status:401});
  const threadKey=request.nextUrl.searchParams.get("thread_key");
  try{
    if(threadKey){
      const [notes,transfers]=await Promise.all([
        rpc(s.accessToken,"get_epic_inbox_thread_notes",{p_thread_key:threadKey}),
        rpc(s.accessToken,"get_epic_inbox_thread_transfers",{p_thread_key:threadKey}),
      ]);
      return NextResponse.json({ok:true,notes:notes||[],transfers:transfers||[]});
    }
    const queue=request.nextUrl.searchParams.get("queue");
    if(queue!=="rental_service"&&queue!=="tour_service")return NextResponse.json({error:"Valid service queue required."},{status:400});
    const rows=await rpc(s.accessToken,"get_epic_routed_inbox",{p_include_cleaned:false});
    const threads=(Array.isArray(rows)?rows:[]).filter((row:{queue?:string;is_open?:boolean})=>row.queue===queue&&row.is_open!==false);
    return NextResponse.json({ok:true,threads});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to load service inbox."},{status:500});}
}
export async function POST(request:NextRequest){
  const s=await session(request); if(!s)return NextResponse.json({error:"Employee login required."},{status:401});
  const body=await request.json().catch(()=>null) as {action?:string;thread_key?:string;note_text?:string}|null;
  if(!body?.thread_key)return NextResponse.json({error:"Thread is required."},{status:400});
  try{
    if(body.action==="note"){
      const result=await rpc(s.accessToken,"epic_sales_add_inbox_thread_note",{p_thread_key:body.thread_key,p_note_text:body.note_text||""});
      return NextResponse.json(result||{ok:true});
    }
    if(body.action==="sales"){
      const result=await rpc(s.accessToken,"epic_route_inbox_thread",{p_thread_key:body.thread_key,p_destination:"sales",p_note_text:body.note_text||null});
      return NextResponse.json(result||{ok:true});
    }
    if(body.action==="close"){
      const result=await rpc(s.accessToken,"epic_sales_clean_inbox_thread",{p_thread_key:body.thread_key});
      return NextResponse.json(result||{ok:true});
    }
    return NextResponse.json({error:"Invalid inbox action."},{status:400});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to update conversation."},{status:500});}
}
