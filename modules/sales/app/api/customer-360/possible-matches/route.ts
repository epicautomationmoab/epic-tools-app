import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../../lib/team-auth";

const url=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
async function authorized(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 return token&&profile&&profile.role!=="workstation"?token:null;
}
async function rpc(token:string,fn:string,body:unknown){
 const response=await fetch(url+"/rest/v1/rpc/"+fn,{method:"POST",cache:"no-store",headers:{"apikey":anonKey,"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)});
 if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(String(body?.message||body?.error||"Identity review service unavailable")+" ("+response.status+").");}
 return response.json();
}
export async function GET(request:NextRequest){
 const token=await authorized(request);
 if(!token)return NextResponse.json({error:"Employee login required."},{status:401});
 const p=request.nextUrl.searchParams;
 const name=(p.get("name")||"").trim();
 if(name.length<3||name.length>120)return NextResponse.json({matches:[]});
 try{
  const rows=await rpc(token,"c360_employee_match_suggestions",{p_name:name,p_phone:p.get("phone")||null,p_email:p.get("email")||null,p_source_type:p.get("source_type")||null,p_source_key:p.get("source_key")||null});
  const normalizePhone=(value:unknown)=>String(value||"").replace(/[^0-9]/g,"").slice(-10);
  const currentPhone=normalizePhone(p.get("phone"));
  const linked= currentPhone.length===10 ? await rpc(token,"c360_linked_phones",{p_phone:currentPhone}).catch(()=>[]) : [];
  const linkedNumbers=new Set((Array.isArray(linked)?linked:[]).map(normalizePhone));
  const currentEmail=String(p.get("email")||"").trim().toLowerCase();
  const currentType=p.get("source_type"),currentKey=p.get("source_key");
  const matches=(Array.isArray(rows)?rows:[]).map((row:any)=>{
    const sources=(Array.isArray(row.source_records)?row.source_records:[]).filter((source:any)=>!(source.source_type===currentType&&source.source_key===currentKey));
    return {...row,source_records:sources,source_count:sources.length};
  }).filter((row:any)=>{
    const phone=normalizePhone(row.candidate_phone);
    const email=String(row.candidate_email||"").trim().toLowerCase();
    if(currentPhone.length===10&&(phone===currentPhone||linkedNumbers.has(phone)))return false;
    if(currentEmail&&email&&currentEmail===email)return false;
    return row.source_records.length>0;
  });
  const currentCallSource=await rpc(token,"c360_employee_call_source_for_phone",{p_phone:p.get("phone")||null}).catch(()=>null);
  return NextResponse.json({matches,current_call_source:currentCallSource},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Match lookup unavailable."},{status:502});}
}
export async function POST(request:NextRequest){
 const token=await authorized(request);
 if(!token)return NextResponse.json({error:"Employee login required."},{status:401});
 try{
  const b=await request.json();
  const types=["sales_opportunity","sales_draft","call","tripworks_customer"];
  if(!types.includes(b.left_type)||!types.includes(b.right_type)||!["confirmed","rejected"].includes(b.decision)||typeof b.left_key!=="string"||typeof b.right_key!=="string"||!b.left_key||!b.right_key||b.left_key.length>120||b.right_key.length>120)return NextResponse.json({error:"Invalid match review."},{status:400});
  if(b.decision==="confirmed"){
    if(typeof b.primary_phone!=="string"||b.primary_phone.replace(/[^0-9]/g,"").length<10)return NextResponse.json({error:"Choose a primary phone before linking."},{status:400});
    const linked=await rpc(token,"c360_confirm_phone_identity_with_primary",{p_left_type:b.left_type,p_left_key:b.left_key,p_right_type:b.right_type,p_right_key:b.right_key,p_primary_phone:b.primary_phone,p_primary_email:b.primary_email||null});
    return NextResponse.json({ok:true,recorded:true,history_linked:linked?.linked===true},{headers:{"Cache-Control":"no-store"}});
  }
  await rpc(token,"c360_employee_record_identity_review",{p_left_type:b.left_type,p_left_key:b.left_key,p_right_type:b.right_type,p_right_key:b.right_key,p_decision:b.decision});
  return NextResponse.json({ok:true,recorded:true,history_linked:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Match review unavailable."},{status:502});}
}
