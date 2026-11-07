import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
const ROOT=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
async function rpc(token:string,name:string,body:object){
 const r=await fetch(ROOT+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
 const p=await r.json().catch(()=>null);
 if(!r.ok)throw Error(p?.message||"Follow-up request failed");return p;
}
async function auth(req:NextRequest){const token=req.cookies.get("epic_access_token")?.value;const user=await getAuthenticatedTeamProfile(token);return token&&user&&user.active&&user.role!=="workstation"?{token,user}:null;}
const failure=(e:unknown)=>NextResponse.json({error:e instanceof Error?e.message:"Follow-up unavailable"},{status:500});
export async function GET(req:NextRequest){
 const a=await auth(req);if(!a)return NextResponse.json({error:"Employee login required"},{status:401});
 try {
 const type=req.nextUrl.searchParams.get("scope")||"mine";
 if(type==="members")return NextResponse.json({members:await rpc(a.token,"epic_followup_members",{}),profile:a.user.id});
 if(type==="history"){const id=req.nextUrl.searchParams.get("id");if(!id||!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid follow-up"},{status:400});return NextResponse.json({events:await rpc(a.token,"epic_followup_history",{p_id:id})});}
 const scope=type==="team"?"team":type==="customer"?"customer":"mine";
 const id=req.nextUrl.searchParams.get("opportunity_id");
 if(id&&!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid customer"},{status:400});
 const items=await rpc(a.token,"epic_followup_list",{p_scope:scope,p_opportunity_id:id||null});
 const dismissedIds=scope==="mine"?await rpc(a.token,"epic_followup_dismissed_ids",{}):[];
 return NextResponse.json({items,dismissedIds,profile:a.user.id,supervisor:["manager","admin"].includes(a.user.role)});
 }catch(e){return failure(e)}
}
export async function POST(req:NextRequest){
 const a=await auth(req);if(!a)return NextResponse.json({error:"Employee login required"},{status:401});
 try {
 const b=await req.json();
 if(!/^[0-9a-f-]{36}$/i.test(String(b.opportunity_id||""))||!String(b.title||"").trim()||String(b.title).length>240||!Number.isFinite(Date.parse(b.due_at)))return NextResponse.json({error:"Customer, action and due date required"},{status:400});
 const item=await rpc(a.token,"epic_followup_create",{p_opportunity_id:b.opportunity_id,p_assignee:b.assigned_to_profile_id||a.user.id,p_title:String(b.title).trim(),p_note:String(b.context_note||"").slice(0,3000),p_due_at:new Date(b.due_at).toISOString(),p_source:String(b.source||"c360").slice(0,80),p_workflow_id:null});
 return NextResponse.json({item});
 }catch(e){return failure(e)}
}
export async function PATCH(req:NextRequest){
 const a=await auth(req);if(!a)return NextResponse.json({error:"Employee login required"},{status:401});
 try {
 const b=await req.json();
 if(!/^[0-9a-f-]{36}$/i.test(String(b.id||"")))return NextResponse.json({error:"Invalid follow-up"},{status:400});
 const item=b.action==="dismiss"?await rpc(a.token,"epic_followup_dismiss",{p_id:b.id}):await rpc(a.token,"epic_followup_action",{p_id:b.id,p_action:b.action,p_outcome:b.outcome||null,p_note:String(b.note||"").slice(0,3000),p_due_at:b.due_at||null,p_assignee:b.assigned_to_profile_id||null});
 return NextResponse.json({ok:true,item});
 }catch(e){return failure(e)}
}
