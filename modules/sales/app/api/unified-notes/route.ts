import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
import {previewUnifiedNotes} from "../../../lib/preview-unified-notes";

const SUPABASE_URL=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const ANON_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
async function session(req:NextRequest){
 const token=req.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 return token&&profile&&profile.active&&profile.role!=="workstation"?{token,profile}:null;
}
async function rpc<T>(token:string,fn:string,params:Record<string,unknown>):Promise<T>{
 const isolated=await previewUnifiedNotes<T>(fn,params);if(isolated!==null)return isolated;
 const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:ANON_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(Object.entries(params).filter(([k])=>k!=="p_author"))),cache:"no-store"});
 const t=await r.text();if(!r.ok)throw new Error(t||`Supabase request failed (${r.status})`);return t?JSON.parse(t) as T:[] as T;
}
type Note={note_id:string;confirmation_code:string|null;note_text:string;note_scope:string;source:string;visible_in_readiness:boolean;author_name:string|null;created_at:string};
export async function GET(req:NextRequest){
 const actor=await session(req);if(!actor)return NextResponse.json({error:"Employee login required."},{status:401});
 const confirmations=Array.from(new Set((req.nextUrl.searchParams.get("confirmations")||"").split(",").map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z0-9-]{3,25}$/.test(s)))).slice(0,30);
 if(!confirmations.length)return NextResponse.json({ok:true,notes:[]});
 try{return NextResponse.json({ok:true,notes:await rpc<Note[]>(actor.token,"epic_unified_notes_for_reservations",{p_confirmations:confirmations})});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to load notes."},{status:500});}
}
export async function POST(req:NextRequest){
 const actor=await session(req);if(!actor)return NextResponse.json({error:"Employee login required."},{status:401});
 try{const b=await req.json(),confirmation=String(b.confirmation_code||"").trim().toUpperCase(),text=String(b.note_text||"").trim();
 if(!/^[A-Z0-9-]{3,25}$/.test(confirmation)||!text||text.length>4000)return NextResponse.json({error:"Valid reservation and note required."},{status:400});
 const notes=await rpc<Note[]>(actor.token,"epic_unified_notes_add",{p_confirmation:confirmation,p_note_text:text,p_show_in_readiness:b.visible_in_readiness===true,p_author:actor.profile.display_name});
 return NextResponse.json({ok:true,note:notes[0]});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to save note."},{status:500});}
}
export async function PATCH(req:NextRequest){
 const actor=await session(req);if(!actor)return NextResponse.json({error:"Employee login required."},{status:401});
 try{const b=await req.json(),id=String(b.note_id||"");if(!/^[a-f0-9-]{36}$/i.test(id)||typeof b.visible_in_readiness!=="boolean")return NextResponse.json({error:"Note and Readiness choice required."},{status:400});
 const notes=await rpc<Note[]>(actor.token,"epic_unified_notes_set_readiness",{p_note_id:id,p_visible:b.visible_in_readiness});
 if(!notes.length)return NextResponse.json({error:"Note unavailable or visibility locked."},{status:404});
 return NextResponse.json({ok:true,note:notes[0]});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to update note."},{status:500});}
}
