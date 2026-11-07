import { NextRequest, NextResponse } from "next/server";
import { isIsolatedUui } from "@/lib/uui-internal-writes";
import { serverSupabaseHeaders } from "@/lib/server/supabase-rest";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";
const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
async function handler(request:NextRequest,method:"GET"|"POST"){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});
 // Existing employee guard remains mandatory before server-only isolated storage access.
 const storageHeaders = isIsolatedUui(process.env) ? serverSupabaseHeaders() : {apikey:KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
 const id=method==="GET"?request.nextUrl.searchParams.get("id"):null;
 const phone=method==="GET"?request.nextUrl.searchParams.get("phone"):null;
 const contact=method==="GET"?request.nextUrl.searchParams.get("contact"):null;
 const matchPhone=method==="GET"?request.nextUrl.searchParams.get("match_phone"):null;
 const body=method==="POST"?await request.json().catch(()=>null):null;
 if(method==="POST"&&(!body||typeof body!=="object"||!body.fields||typeof body.fields!=="object"||Array.isArray(body.fields)))return NextResponse.json({error:"Invalid sheet"},{status:400});
 const p=method==="GET"?(id?`epicc360_lead_sheets?id=eq.${encodeURIComponent(id)}&select=id,fields,status&limit=1`:contact?`epicc360_lead_sheets?contact_id=eq.${encodeURIComponent(contact)}&status=eq.saved&select=id,customer_name,customer_phone,updated_at,status,fields&order=updated_at.desc&limit=30`:phone?`epicc360_lead_sheets?customer_phone=eq.${encodeURIComponent(phone)}&status=eq.saved&select=id,customer_name,customer_phone,updated_at,status,fields&order=updated_at.desc&limit=30`:"epicc360_lead_sheets?select=id,customer_name,customer_phone,updated_at,status&order=updated_at.desc&limit=20"):"epicc360_lead_sheets?on_conflict=id";
 const payload=method==="POST"?{...(body.id?{id:body.id}:{}),owner_user_id:profile.user_id||profile.id,customer_name:String(body.fields.name||"").slice(0,200),customer_phone:String(body.fields.phone||"").slice(0,50),fields:body.fields,status:body.finalize===true?"saved":"draft",updated_at:new Date().toISOString()}:null;
 try{
 if(method==="GET"&&matchPhone!==null){
  const digits=matchPhone.replace(/\D/g,"");
  const canonical=digits.length===10?"+1"+digits:digits.length===11&&digits.startsWith("1")?"+"+digits:null;
  if(!canonical)return NextResponse.json({ok:true,match:null});
  const response=await fetch(URL+"/rest/v1/rpc/get_epic_known_customer_matches",{
   method:"POST",
   headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({p_emails:[],p_phones:[digits.slice(-10),"1"+digits.slice(-10)]}),
   cache:"no-store"
  });
  const rows=await response.json().catch(()=>[]);
  if(!response.ok)return NextResponse.json({error:"Customer lookup failed"},{status:response.status});
  const matches=[...new Map((Array.isArray(rows)?rows:[]).filter((row:any)=>row.match_type==="phone"&&row.contact_id).map((row:any)=>[row.contact_id,row])).values()];
  return NextResponse.json({ok:true,match:matches.length===1?{id:matches[0].contact_id,display_name:matches[0].display_name,tripworks_customer_id:null}:null,ambiguous:matches.length>1},{headers:{"Cache-Control":"no-store"}});
 }
 if(method==="POST"&&body.finalize===true){
  const rawPhone=String(body.fields.phone||"").trim();
  const digits=rawPhone.replace(/\D/g,"");
  if(rawPhone&&!(digits.length===10||(digits.length===11&&digits.startsWith("1"))))return NextResponse.json({error:"Enter a valid 10-digit phone number or leave the phone field blank."},{status:400});
  const response=await fetch(URL+"/rest/v1/rpc/finalize_and_claim_epicc360_lead_sheet",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({p_id:body.id||null,p_fields:body.fields,p_contact_id:body.contactId||null}),cache:"no-store"});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)return NextResponse.json({error:result.message||"Unable to finish saving this Lead Sheet"},{status:response.status});
  return NextResponse.json({ok:true,rows:[result],linked:result.linked,contactId:result.contact_id,opportunityId:result.opportunity_id||null,opportunityStatus:result.opportunity_status||null});
 }
 const response=await fetch(`${URL}/rest/v1/${p}`,{method:method==="POST"?"POST":"GET",headers:{...storageHeaders,...(method==="POST"?{"Prefer":"resolution=merge-duplicates,return=representation"}:{})},body:payload?JSON.stringify(payload):undefined,cache:"no-store"});
 const result=await response.json().catch(()=>[]);
 if(!response.ok)return NextResponse.json({error:"Unable to save or read lead sheet"},{status:response.status});
 return NextResponse.json({ok:true,rows:result},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Lead sheet service unavailable"},{status:502});}
}
export async function GET(r:NextRequest){return handler(r,"GET")}
export async function POST(r:NextRequest){return handler(r,"POST")}
