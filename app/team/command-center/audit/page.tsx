import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

type EventRow = {
  id: string;
  at: string;
  actor: string;
  actor_id: string | null;
  domain: string;
  action: string;
  object: string;
  detail: string;
};

async function loadAuditEvents(): Promise<{ events: EventRow[]; errors: string[] }> {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/[/]$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!origin || !secret) return {events: [], errors: ["Operational database configuration unavailable."]};
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const tasks = [
    {
      name: "Sales opportunities",
      table: "sales_opportunity_status_history",
      fields: "id,changed_at,changed_by_profile_id,changed_by_name,opportunity_id,from_status,to_status,reason",
      sort: "changed_at",
      map: (r: Record<string, unknown>): EventRow => ({
        id: String(r.id), at: String(r.changed_at), actor: String(r.changed_by_name || "Unknown"),
        actor_id: r.changed_by_profile_id ? String(r.changed_by_profile_id) : null,
        domain: "Sales", action: "Opportunity status", object: String(r.opportunity_id),
        detail: `${String(r.from_status || "—")} → ${String(r.to_status || "—")}`,
      }),
    },
    {
      name: "Fleet availability",
      table: "fleet_inventory_events",
      fields: "id,created_at,changed_by_profile_id,changed_by_name,vehicle_number,previous_state,new_state",
      sort: "created_at",
      map: (r: Record<string, unknown>): EventRow => ({
        id: String(r.id), at: String(r.created_at), actor: String(r.changed_by_name || "Unknown"),
        actor_id: r.changed_by_profile_id ? String(r.changed_by_profile_id) : null,
        domain: "Fleet", action: "Vehicle state", object: `Vehicle ${String(r.vehicle_number ?? "unknown")}`,
        detail: `${String(r.previous_state || "—")} → ${String(r.new_state || "—")}`,
      }),
    },
    {
      name: "Sales follow-ups",
      table: "sales_followup_events",
      fields: "id,created_at,actor_profile_id,followup_id,event_type",
      sort: "created_at",
      map: (r: Record<string, unknown>): EventRow => ({
        id: String(r.id), at: String(r.created_at), actor: "Staff profile",
        actor_id: r.actor_profile_id ? String(r.actor_profile_id) : null,
        domain: "Sales", action: String(r.event_type || "Follow-up"), object: String(r.followup_id), detail: "Follow-up event",
      }),
    },
  ];
  const results = await Promise.all(tasks.map(async t => {
    try {
      const params = new URLSearchParams({select:t.fields, order:`${t.sort}.desc`, limit:"80"});
      const response = await fetch(`${origin}/rest/v1/${t.table}?${params}`, {headers, cache:"no-store"});
      if (!response.ok) return { name: t.name, error: `HTTP ${response.status}`, events: [] as EventRow[] };
      const rows = await response.json();
      if (!Array.isArray(rows)) return {name:t.name,error:"Invalid response",events:[] as EventRow[]};
      return {name:t.name,error:null,events:rows.map(t.map)};
    } catch {
      return {name:t.name,error:"Source not reachable",events:[] as EventRow[]};
    }
  }));
  return {
    events:results.flatMap(x=>x.events).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,120),
    errors:results.filter(x=>x.error).map(x=>`${x.name}: ${x.error}`),
  };
}

export default async function ManagerAuditPreview({
  searchParams,
}:{
  searchParams:Promise<{employee?:string;area?:string}>;
}) {
  const token=(await cookies()).get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(token);
  if(!profile || !token) redirect("/employee-login");
  if(profile.role!=="manager" && profile.role!=="admin") {
    return <main style={{padding:40}}><h1>Access restricted</h1><p>Managers and administrators only.</p><Link href="/team/readiness">Return to Readiness</Link></main>;
  }
  const params=await searchParams;
  const employee=(params.employee||"").slice(0,100).trim().toLowerCase();
  const area=(params.area||"").slice(0,40);
  const {events,errors}=await loadAuditEvents();
  const visible=events.filter(e=>(!employee||e.actor.toLowerCase().includes(employee)||e.actor_id?.toLowerCase().includes(employee)) && (!area||e.domain===area));
  return <main style={{maxWidth:1250,margin:"0 auto",padding:"25px 20px",fontFamily:"system-ui,sans-serif",color:"#17304b"}}>
    <p style={{fontSize:12,color:"#657c92"}}>EPIC COMMAND CENTER / MANAGEMENT / AUDIT PREVIEW</p>
    <h1>Team Activity</h1>
    <p style={{color:"#56718b"}}>Read-only pilot using verified operational history records. Recent events only. Incomplete coverage is expected; this is not yet a comprehensive audit log.</p>
    <div style={{background:"#fff6e6",border:"1px solid #ead6ad",borderRadius:10,padding:14,margin:"15px 0"}}>Preview branch only. No writes or changes to employee access. Sensitive customer contact changes and session metadata are intentionally excluded.</div>
    <form method="get" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",padding:"18px 0"}}>
      <label>Employee or profile ID<br/><input name="employee" defaultValue={params.employee||""} placeholder="Search actor" style={{padding:10,border:"1px solid #b9cede",borderRadius:8,minWidth:230}}/></label>
      <label>Area<br/><select name="area" defaultValue={area} style={{padding:10,border:"1px solid #b9cede",borderRadius:8}}><option value="">All areas</option><option value="Sales">Sales</option><option value="Fleet">Fleet</option></select></label>
      <button type="submit" style={{background:"#173b56",color:"#fff",border:0,borderRadius:8,padding:"11px 16px"}}>Filter activity</button>
    </form>
    {errors.length>0&&<p role="status" style={{background:"#fff1df",padding:12}}>Some sources were unavailable: {errors.join("; ")}. Results may be incomplete.</p>}
    <p style={{color:"#627b92"}}>{visible.length} matching events (up to 120 recent events combined from three sources)</p>
    <div style={{overflowX:"auto",background:"white",border:"1px solid #dce6ee",borderRadius:12}}>
      <table style={{borderCollapse:"collapse",width:"100%",fontSize:13,textAlign:"left"}}>
        <thead><tr style={{background:"#eff4f8"}}>{["When (Moab)","Area","Action","Employee","Record","Change"].map(x=><th key={x} style={{padding:13,borderBottom:"1px solid #dce6ee"}}>{x}</th>)}</tr></thead>
        <tbody>{visible.map(x=><tr key={x.domain+x.id}>{[
          new Date(x.at).toLocaleString("en-US",{timeZone:"America/Denver",dateStyle:"medium",timeStyle:"short"}),
          x.domain,x.action,x.actor,x.object,x.detail
        ].map((s,i)=><td key={i} style={{padding:12,borderBottom:"1px solid #eaf0f4",whiteSpace:i===5?"normal":"nowrap"}}>{s}</td>)}</tr>)}</tbody>
      </table>
      {!visible.length&&<p style={{padding:20}}>No recorded events match these filters.</p>}
    </div>
    <p style={{fontSize:12,color:"#6c8193",marginTop:20}}>Next: source-level pagination, linked records, actor identity resolution, before/after detail, unified session history, full coverage review, and production manager-permission tests.</p>
  </main>;
}
