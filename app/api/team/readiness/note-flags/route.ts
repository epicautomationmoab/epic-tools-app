import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "@/lib/team-auth";
export async function POST(request:NextRequest){
 const p=await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
 if(!p||p.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
 try{
  const b=await request.json();
  const ids=Array.isArray(b.readiness_ids)?b.readiness_ids.filter((v:unknown)=>typeof v==="string"&&/^[a-f0-9-]{36}$/i.test(v)).slice(0,150):[];
  const codes=Array.isArray(b.confirmations)?b.confirmations.filter((v:unknown)=>typeof v==="string"&&/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(v)).slice(0,150):[];
  if(!ids.length&&!codes.length)return NextResponse.json({ok:true,readiness_ids:[],confirmations:[]});
  const raw=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!raw||!key)throw Error("Supabase server configuration missing.");
  const url=(process.env.EPIC_NOTES_PREVIEW_URL||(/^https?:\/\//i.test(raw)?raw:`https://${raw}`)).replace(/\/+$/,"");
  const filters=[ids.length?`readiness_id.in.(${ids.join(",")})`:null,codes.length?`confirmation_code.in.(${codes.join(",")})`:null].filter(Boolean).join(",");
  const query=new URLSearchParams({select:"readiness_id,confirmation_code",or:`(${filters})`,archived_at:"is.null",visible_in_readiness:"eq.true",limit:"200"});
  const response=await fetch(`${url}/rest/v1/epic_unified_notes?${query}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store"});
  if(!response.ok)throw Error(`Notes query failed (${response.status})`);
  const notes=await response.json() as Array<{readiness_id:string|null;confirmation_code:string|null}>;
  return NextResponse.json({ok:true,readiness_ids:[...new Set(notes.map(n=>n.readiness_id).filter(Boolean))],confirmations:[...new Set(notes.map(n=>n.confirmation_code).filter(Boolean))]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not check notes."},{status:500});}
}
