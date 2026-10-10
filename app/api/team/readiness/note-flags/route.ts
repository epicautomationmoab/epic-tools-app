import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "@/lib/team-auth";
export async function POST(request:NextRequest){
 const p=await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
 if(!p||p.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
 try{
  const b=await request.json();
  const ids=Array.isArray(b.readiness_ids)?b.readiness_ids.filter((v:unknown)=>typeof v==="string"&&/^[a-f0-9-]{36}$/i.test(v)):[];
  const codes=Array.isArray(b.confirmations)?b.confirmations.filter((v:unknown)=>typeof v==="string"&&/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(v)):[];
  if(!ids.length&&!codes.length)return NextResponse.json({ok:true,readiness_ids:[],confirmations:[]});
  const raw=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!raw||!key)throw Error("Supabase server configuration missing.");
  const url=(process.env.EPIC_NOTES_PREVIEW_URL||(/^https?:\/\//i.test(raw)?raw:`https://${raw}`)).replace(/\/+$/,"");
  // Only fetch indicator metadata and match against the full displayed reservation set.
  // Previously slicing input to 150 silently skipped later Readiness rows.
  const idSet=new Set<string>(ids),codeSet=new Set<string>(codes);
  const matches:Array<{readiness_id:string|null;confirmation_code:string|null}>=[];
  for(let offset=0;offset<10000;offset+=500){
    const query=new URLSearchParams({select:"readiness_id,confirmation_code",archived_at:"is.null",visible_in_readiness:"eq.true",limit:"500",offset:String(offset),order:"created_at.asc"});
    const response=await fetch(`${url}/rest/v1/epic_unified_notes?${query}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store"});
    if(!response.ok)throw Error(`Notes query failed (${response.status})`);
    const rows=await response.json() as Array<{readiness_id:string|null;confirmation_code:string|null}>;
    for(const n of rows)if((n.readiness_id&&idSet.has(n.readiness_id))||(n.confirmation_code&&codeSet.has(n.confirmation_code)))matches.push(n);
    if(rows.length<500)break;
  }
  const notes=matches;
  return NextResponse.json({ok:true,readiness_ids:[...new Set(notes.map(n=>n.readiness_id).filter(Boolean))],confirmations:[...new Set(notes.map(n=>n.confirmation_code).filter(Boolean))]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not check notes."},{status:500});}
}
