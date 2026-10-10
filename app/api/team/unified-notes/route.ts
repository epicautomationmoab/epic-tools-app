import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function config() {
 const raw=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key=process.env.SUPABASE_SECRET_KEY?.trim();
 if (!raw || !key) throw new Error("Supabase configuration missing.");
 return {url:(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).replace(/\/+$/,""),key};
}
async function db<T>(path:string, init?:RequestInit):Promise<T> {
 const {url,key}=config();
 const res=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(init?.headers||{})},cache:"no-store"});
 const text=await res.text();if(!res.ok)throw new Error(text||`Database error ${res.status}`);
 return text?JSON.parse(text) as T:undefined as T;
}
async function employee(req:NextRequest) {
 const p=await getAuthenticatedTeamProfile(req.cookies.get("epic_access_token")?.value);
 return p && p.role!=="workstation"?p:null;
}
type Note={note_id:string; confirmation_code:string|null; readiness_id:string|null; customer_code:string|null; note_text:string; note_scope:string; source:string;visible_in_readiness:boolean;author_name:string|null;source_note_id:string|null;created_at:string;updated_at:string;archived_at:string|null};
const select="note_id,confirmation_code,readiness_id,customer_code,note_text,note_scope,source,visible_in_readiness,author_name,source_note_id,created_at,updated_at,archived_at";
export async function GET(req:NextRequest) {
 if(!await employee(req))return NextResponse.json({error:"Employee login required."},{status:401});
 const q=req.nextUrl.searchParams,confirmation=q.get("confirmation")?.trim().toUpperCase(),readiness=q.get("readiness_id")?.trim(),customer=q.get("customer_code")?.trim(),view=q.get("view");
 if(!confirmation&&!readiness&&!customer)return NextResponse.json({error:"A reservation or customer is required."},{status:400});
 const filters=[confirmation?`confirmation_code.eq.${confirmation}`:null,readiness?`readiness_id.eq.${readiness}`:null,customer?`customer_code.eq.${customer}`:null].filter(Boolean).join(",");
 try {
  const params=new URLSearchParams({select,archived_at:"is.null",order:"created_at.desc",limit:"200",or:`(${filters})`});
  if(view==="readiness")params.set("visible_in_readiness","eq.true");
  const notes=await db<Note[]>(`epic_unified_notes?${params}`);
  return NextResponse.json({ok:true,notes});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to load notes."},{status:500});}
}
export async function POST(req:NextRequest) {
 const p=await employee(req);if(!p)return NextResponse.json({error:"Employee login required."},{status:401});
 try{
  const body=await req.json();const text=String(body.note_text||"").trim(),scope=body.note_scope==="customer"?"customer":"reservation";
  const confirmation=String(body.confirmation_code||"").trim().toUpperCase()||null;
  const readiness=String(body.readiness_id||"").trim()||null;
  const customer=String(body.customer_code||"").trim()||null;
  if(!text||text.length>4000||(!confirmation&&!readiness&&!customer))return NextResponse.json({error:"Valid note text and identity are required."},{status:400});
  const inReadiness=scope==="reservation"&&body.visible_in_readiness===true;
  if(inReadiness&&!confirmation&&!readiness)return NextResponse.json({error:"Readiness notes require a reservation."},{status:400});
  const rows=await db<Note[]>("epic_unified_notes",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({note_text:text,note_scope:scope,source:"c360",confirmation_code:confirmation,readiness_id:readiness,customer_code:customer,visible_in_readiness:inReadiness,author_name:p.display_name})});
  return NextResponse.json({ok:true,note:rows[0]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to add note."},{status:500});}
}
export async function PATCH(req:NextRequest) {
 if(!await employee(req))return NextResponse.json({error:"Employee login required."},{status:401});
 try{
  const body=await req.json(),id=String(body.note_id||"").trim();if(!/^[a-f0-9-]{36}$/i.test(id))return NextResponse.json({error:"Valid note ID required."},{status:400});
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(typeof body.visible_in_readiness==="boolean")patch.visible_in_readiness=body.visible_in_readiness;
  if(typeof body.note_text==="string"){const text=body.note_text.trim();if(!text||text.length>4000)return NextResponse.json({error:"Invalid note text."},{status:400});patch.note_text=text;}
  // Imported TripWorks notes are read-only; only visibility may change.
  const rows=await db<Note[]>(`epic_unified_notes?note_id=eq.${encodeURIComponent(id)}&source=neq.tripworks`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)});
  if(!rows.length&&typeof body.visible_in_readiness==="boolean"&&!body.note_text){
   const imported=await db<Note[]>(`epic_unified_notes?note_id=eq.${encodeURIComponent(id)}&source=eq.tripworks`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({visible_in_readiness:body.visible_in_readiness,updated_at:new Date().toISOString()})});
   if(imported.length)return NextResponse.json({ok:true,note:imported[0]});
  }
  if(!rows.length)return NextResponse.json({error:"Note not found or read-only."},{status:404});
  return NextResponse.json({ok:true,note:rows[0]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to update note."},{status:500});}
}
