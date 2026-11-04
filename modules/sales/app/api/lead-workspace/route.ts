import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
const URL_BASE=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const API_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
export async function GET(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!profile||!token||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
 const r=await fetch(`${URL_BASE}/rest/v1/rpc/get_epic_sales_open_leads`,{method:"POST",headers:{apikey:API_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:"{}",cache:"no-store"});
 if(!r.ok)return NextResponse.json({error:"Unable to load sales leads."},{status:r.status});
 const p=await r.json();
 return NextResponse.json({profile:{display_name:profile.display_name},leads:p.leads||[]});
}
