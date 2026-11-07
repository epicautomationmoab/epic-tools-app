import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";

const BASE=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/$/,"");
const ANON=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
export async function GET(req:NextRequest){
 const token=req.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});
 const id=req.nextUrl.searchParams.get("id");
 const events=req.nextUrl.searchParams.get("events");
 if(id&&!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid attachment"},{status:400});
 if(!id&&!events)return NextResponse.json({attachments:[]});
 const url=new URL(BASE+"/functions/v1/c360-private-media");
 if(id)url.searchParams.set("id",id);
 else url.searchParams.set("events",events||"");
 const response=await fetch(url,{headers:{Authorization:"Bearer "+token,apikey:ANON},cache:"no-store"});
 const headers=new Headers({"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});
 const mime=response.headers.get("content-type")||"application/json";
 headers.set("Content-Type",mime);
 return new NextResponse(response.body,{status:response.status,headers});
}
