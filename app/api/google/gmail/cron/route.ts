import { NextResponse } from "next/server";
import { syncEpicInboxes } from "@/lib/server/gmail-inbound";

function requiredEnv(name:string){
  const value=process.env[name]?.trim();
  if(!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function run(request:Request){
  try{
    const authorization=request.headers.get("authorization");
    const cronSecret=requiredEnv("CRON_SECRET");
    if(authorization!==`Bearer ${cronSecret}`){
      return NextResponse.json({ok:false,error:"Unauthorized cron request."},{status:401});
    }

    const result=await syncEpicInboxes();
    return NextResponse.json(result);
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Unable to sync Epic Gmail inboxes."},{status:500});
  }
}

export async function GET(request:Request){return run(request);}
export async function POST(request:Request){return run(request);}
