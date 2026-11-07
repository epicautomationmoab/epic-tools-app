import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../../lib/team-auth";
const BASE=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/[/]+$/,"");
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
export async function POST(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!profile||!token||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
 const body=await request.json().catch(()=>null);
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 if(!uuid.test(body?.source_contact_id||"")||!uuid.test(body?.target_contact_id||"")||body.source_contact_id===body.target_contact_id)return NextResponse.json({error:"Select two distinct valid contacts."},{status:400});
 const response=await fetch(BASE+"/rest/v1/rpc/c360_confirm_social_contact_link",{
  method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({p_source_contact:body.source_contact_id,p_target_contact:body.target_contact_id}),cache:"no-store"
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)return NextResponse.json({error:data?.message||"Could not link social identity."},{status:response.status});
 return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
}