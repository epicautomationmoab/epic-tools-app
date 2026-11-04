import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
export async function POST(req:NextRequest){
 const token=req.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});
 const base=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/[/]+$/,"");
 const r=await fetch(base+"/functions/v1/meta-instagram-send",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:await req.text(),cache:"no-store"});
 const body=await r.json().catch(()=>({error:"Instagram send unavailable"}));
 return NextResponse.json(body,{status:r.status});
}