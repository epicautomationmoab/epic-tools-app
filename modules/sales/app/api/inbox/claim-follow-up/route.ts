import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../../lib/team-auth";
const ROOT=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
async function rpc(token:string,name:string,params:object){
 const r=await fetch(ROOT+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(params),cache:"no-store"});
 const p=await r.json().catch(()=>null);
 if(!r.ok)throw Error(p?.message||"Customer workflow failed");return p;
}
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function POST(req:NextRequest){
 const token=req.cookies.get("epic_access_token")?.value;
 const employee=await getAuthenticatedTeamProfile(token);
 if(!token||!employee||!employee.active||employee.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});
 const b=await req.json().catch(()=>null);
 if(!b||typeof b.thread_key!=="string"||b.thread_key.length>250||!uuid(b.opportunity_id)&&!uuid(b.contact_id)||typeof b.title!=="string"||!b.title.trim()||b.title.length>240||typeof b.due_at!=="string"||!Number.isFinite(Date.parse(b.due_at)))
  return NextResponse.json({error:"Customer, follow-up action and date are required"},{status:400});
 try {
   // Keep the Inbox item until a follow-up is persisted. Existing claim activity is idempotent.
   let opportunityId:string;
   if(uuid(b.opportunity_id)){
     await rpc(token,"epic_sales_claim_lead",{p_opportunity_id:b.opportunity_id,p_release:false});
     opportunityId=b.opportunity_id;
   }else{
     const result=await rpc(token,"epic_claim_customer_sales_lead",{p_contact_id:b.contact_id});
     opportunityId=result?.opportunity_id;
     if(!uuid(opportunityId))throw Error("Could not establish an active sales opportunity");
   }
   const item=await rpc(token,"epic_followup_create",{
     p_opportunity_id:opportunityId,p_assignee:employee.id,p_title:b.title.trim(),
     p_note:String(b.context_note||"").slice(0,3000),p_due_at:new Date(b.due_at).toISOString(),
     p_source:"inbox_claim",p_workflow_id:null
   });
   if(!item?.id)throw Error("Lead claimed but follow-up not saved. Inbox remains open.");
   try{await rpc(token,"epic_sales_clean_inbox_thread",{p_thread_key:b.thread_key});}
   catch(e){return NextResponse.json({ok:true,opportunity_id:opportunityId,followup_id:item.id,warning:"Follow-up saved, but Inbox could not be cleared."});}
   return NextResponse.json({ok:true,opportunity_id:opportunityId,followup_id:item.id});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to schedule follow-up"},{status:500});}
}
