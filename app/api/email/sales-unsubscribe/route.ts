import { NextRequest } from "next/server";

function requiredEnv(name:string){
  const value=process.env[name]?.trim();
  if(!value)throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function supabaseConfig(){
  const rawUrl=requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const url=(/^https?:\/\//i.test(rawUrl)?rawUrl:`https://${rawUrl}`).replace(/\/+$/,"");
  return {url,key:requiredEnv("SUPABASE_SECRET_KEY")};
}

function headers(key:string){
  return {apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
}

function page(title:string,body:string){
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#eeeae3;font-family:Arial,Helvetica,sans-serif;color:#222"><main style="max-width:620px;margin:48px auto;padding:0 18px"><section style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.08)"><div style="background:#171717;padding:26px;text-align:center"><img src="https://myepicreservation.com/epic-logo.png" width="205" alt="Epic 4X4 Adventures" style="max-width:100%;height:auto"></div><div style="height:5px;background:#c6492d"></div><div style="padding:34px"><h1 style="margin:0 0 16px;font-size:30px">${title}</h1><p style="font-size:17px;line-height:1.6;margin:0">${body}</p></div></section></main></body></html>`,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}

export async function GET(request:NextRequest){
  const token=request.nextUrl.searchParams.get("token")?.trim()||"";
  if(!token)return page("Unable to update preferences","That unsubscribe link is incomplete. Please reply to the email and our team will help.");

  try{
    const {url,key}=supabaseConfig();
    const tokenResponse=await fetch(`${url}/rest/v1/sales_email_unsubscribe_tokens?token=eq.${encodeURIComponent(token)}&select=token,email,used_at&limit=1`,{headers:headers(key),cache:"no-store"});
    if(!tokenResponse.ok)throw new Error(await tokenResponse.text());
    const rows=await tokenResponse.json() as Array<{token:string;email:string;used_at:string|null}>;
    const row=rows[0];
    if(!row)return page("Unable to update preferences","That unsubscribe link is no longer valid. Please reply to the email and our team will help.");

    const email=row.email.trim().toLowerCase();
    const existingResponse=await fetch(`${url}/rest/v1/sales_email_suppressions?email=eq.${encodeURIComponent(email)}&reason=eq.unsubscribe&select=id&limit=1`,{headers:headers(key),cache:"no-store"});
    if(!existingResponse.ok)throw new Error(await existingResponse.text());
    const existing=await existingResponse.json() as Array<{id:string}>;
    const now=new Date().toISOString();
    const suppressionPayload={email,reason:"unsubscribe",source:"email_unsubscribe",active:true,updated_at:now};
    const suppressionResponse=existing[0]
      ? await fetch(`${url}/rest/v1/sales_email_suppressions?id=eq.${encodeURIComponent(existing[0].id)}`,{method:"PATCH",headers:{...headers(key),Prefer:"return=minimal"},body:JSON.stringify(suppressionPayload)})
      : await fetch(`${url}/rest/v1/sales_email_suppressions`,{method:"POST",headers:{...headers(key),Prefer:"return=minimal"},body:JSON.stringify(suppressionPayload)});
    if(!suppressionResponse.ok)throw new Error(await suppressionResponse.text());

    if(!row.used_at){
      const usedResponse=await fetch(`${url}/rest/v1/sales_email_unsubscribe_tokens?token=eq.${encodeURIComponent(token)}`,{method:"PATCH",headers:{...headers(key),Prefer:"return=minimal"},body:JSON.stringify({used_at:now})});
      if(!usedResponse.ok)throw new Error(await usedResponse.text());
    }

    return page("You’re unsubscribed","You won’t receive further Epic sales follow-up emails. We may still email you about reservations you make, including confirmations, waivers, readiness information, or other service messages.");
  }catch{
    return page("Unable to update preferences","We couldn’t process that request automatically. Please reply to the email and our team will take care of it.");
  }
}
