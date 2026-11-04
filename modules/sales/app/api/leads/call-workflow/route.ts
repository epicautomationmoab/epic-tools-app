import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../../lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function rest(accessToken:string,path:string,init?:RequestInit){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    ...init,
    headers:{
      apikey:SUPABASE_PUBLISHABLE_KEY,
      Authorization:`Bearer ${accessToken}`,
      "Content-Type":"application/json",
      ...(init?.headers||{})
    },
    cache:"no-store"
  });
  const text=await response.text();
  if(!response.ok)throw new Error(text||`Request failed (${response.status})`);
  return text?JSON.parse(text):null;
}

export async function GET(request:NextRequest){
  const accessToken=request.cookies.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(accessToken);
  if(!profile||!accessToken||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
  const opportunityId=request.nextUrl.searchParams.get("opportunity_id")?.trim();
  if(!opportunityId)return NextResponse.json({error:"Lead is required."},{status:400});
  try{
    const rows=await rest(accessToken,`sales_lead_call_workflows?opportunity_id=eq.${encodeURIComponent(opportunityId)}&select=*&order=created_at.desc&limit=10`);
    return NextResponse.json({ok:true,rows});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to load call workflow."},{status:500});
  }
}

export async function POST(request:NextRequest){
  const accessToken=request.cookies.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(accessToken);
  if(!profile||!accessToken||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});

  const body=await request.json().catch(()=>null) as {
    opportunity_id?:string;
    objection_code?:string|null;
    objection_detail?:string|null;
    resolution_note?:string|null;
    outcome_code?:string|null;
    next_action?:string|null;
    follow_up_at?:string|null;
  }|null;

  const opportunityId=body?.opportunity_id?.trim();
  if(!opportunityId)return NextResponse.json({error:"Lead is required."},{status:400});

  try{
    const owned=await rest(accessToken,`sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}&claimed_by_profile_id=eq.${encodeURIComponent(profile.id)}&select=id&limit=1`);
    if(!Array.isArray(owned)||!owned[0])return NextResponse.json({error:"Claim this lead before saving a sales call."},{status:403});

    const rows=await rest(accessToken,"sales_lead_call_workflows",{
      method:"POST",
      headers:{Prefer:"return=representation"},
      body:JSON.stringify({
        opportunity_id:opportunityId,
        rep_profile_id:profile.id,
        rep_name:profile.display_name,
        objection_code:body?.objection_code?.trim()||null,
        objection_detail:body?.objection_detail?.trim()||null,
        resolution_note:body?.resolution_note?.trim()||null,
        outcome_code:body?.outcome_code?.trim()||null,
        next_action:body?.next_action?.trim()||null,
        follow_up_at:body?.follow_up_at||null
      })
    });
    const row=Array.isArray(rows)?rows[0]:rows;
    let followupScheduled=false;
    let followupError:string|null=null;
    if(body?.outcome_code==="follow_up"){
      if(!body.follow_up_at||!Number.isFinite(Date.parse(body.follow_up_at))){
        followupError="A valid follow-up date is required.";
      }else{
        try{
          await rest(accessToken,"rpc/epic_followup_create",{
            method:"POST",
            body:JSON.stringify({
              p_opportunity_id:opportunityId,
              p_assignee:profile.id,
              p_title:(body.next_action||"Follow up with guest").trim().slice(0,240),
              p_note:[body.objection_detail,body.resolution_note].filter(Boolean).join(" · ").slice(0,3000),
              p_source:"sales_call",
              p_workflow_id:row.id,
              p_due_at:new Date(body.follow_up_at).toISOString()
            })
          });
          followupScheduled=true;
        }catch(e){followupError=e instanceof Error?e.message:"Could not schedule follow-up";}
      }
    }
    return NextResponse.json({ok:true,row,followupScheduled,followupError});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save sales call."},{status:500});
  }
}
