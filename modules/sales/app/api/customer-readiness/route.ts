import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
const BASE=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
export async function GET(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});
 const confirmation=(request.nextUrl.searchParams.get("confirmation")||"").trim().toUpperCase();
 if(!/^[A-Z0-9-]{3,25}$/.test(confirmation))return NextResponse.json({error:"Invalid reservation"},{status:400});
 try{
  const response=await fetch(BASE+"/rest/v1/rpc/get_epic_c360_readiness_docs",{
   method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({p_confirmation:confirmation}),cache:"no-store"
  });
  if(!response.ok)return NextResponse.json({error:"Readiness document lookup failed ("+response.status+")"},{status:502});
  const result=await response.json();
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Unable to reach readiness database"},{status:502});}
}
