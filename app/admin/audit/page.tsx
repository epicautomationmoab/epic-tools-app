import EpicToolsHome from "@/app/team/EpicToolsHome";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

import { loadAuditEvents } from "@/lib/server/audit-events";

export default async function ManagerAuditPreview({
  searchParams,
}:{
  searchParams:Promise<{employee?:string;area?:string;cursor?:string}>;
}) {
  const token=(await cookies()).get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(token);
  if(!profile || !token) redirect("/employee-login");
  if(!process.env.EPIC_AUDIT_OWNER_PROFILE_IDS?.split(",").map(id=>id.trim()).includes(profile.id)) {
    return <main style={{padding:40}}><h1>Access restricted</h1><p>The User Audit Trail is available only to Jennifer and Joe.</p><Link href="/team/readiness">Return to Readiness</Link></main>;
  }
  const params=await searchParams;
  const employee=(params.employee||"").slice(0,100).trim().toLowerCase();
  const area=(params.area||"").slice(0,40);
  const {events,errors,nextCursor}=await loadAuditEvents({employee,area,cursor:params.cursor});
  const uncovered = "Includes reservation notes, sales status and follow-up events, and fleet changes. Follow-up names use the current employee profile; unrecorded identities remain Unknown. Other action categories and denied-action coverage remain incomplete.";
  const visible=events;
  const nextParams=new URLSearchParams({employee,area,...(nextCursor?{cursor:nextCursor}:{})});
  return <EpicToolsHome profile={profile} title="User Audit Trail"><section style={{maxWidth:1250,color:"#17304b"}}>
    <p style={{fontSize:12,color:"#657c92"}}>EPIC COMMAND CENTER / MANAGEMENT / AUDIT PREVIEW</p>
    <h2>Team Activity</h2>
    <p style={{color:"#56718b"}}>Read-only pilot using verified operational history records. Search the available history by employee and area, then use Older events to continue. Sources listed below are not yet a comprehensive audit log.</p>
    <div style={{background:"#fff6e6",border:"1px solid #ead6ad",borderRadius:10,padding:14,margin:"15px 0"}}>Preview branch only. No writes or changes to employee access. Sensitive customer contact changes and session metadata are intentionally excluded.</div>
    <form method="get" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",padding:"18px 0"}}>
      <label>Employee or profile ID<br/><input name="employee" defaultValue={params.employee||""} placeholder="Search actor" style={{padding:10,border:"1px solid #b9cede",borderRadius:8,minWidth:230}}/></label>
      <label>Area<br/><select name="area" defaultValue={area} style={{padding:10,border:"1px solid #b9cede",borderRadius:8}}><option value="">All areas</option><option value="Sales">Sales</option><option value="Fleet">Fleet</option><option value="Notes">Notes</option></select></label>
      <button type="submit" style={{background:"#173b56",color:"#fff",border:0,borderRadius:8,padding:"11px 16px"}}>Filter activity</button>
    </form>
    {errors.length>0&&<p role="status" style={{background:"#fff1df",padding:12}}>Some sources were unavailable: {errors.join("; ")}. Results may be incomplete.</p>}
    <p style={{color:"#627b92"}}>{visible.length} matching events on this page. {uncovered}</p>
    <div style={{overflowX:"auto",background:"white",border:"1px solid #dce6ee",borderRadius:12}}>
      <table style={{borderCollapse:"collapse",width:"100%",minWidth:950,tableLayout:"fixed",fontSize:13,textAlign:"left"}}>
        <thead><tr style={{background:"#eff4f8"}}>{["When (Moab)","Area","Action","Employee","Record","Change"].map(x=><th key={x} style={{padding:13,borderBottom:"1px solid #dce6ee",width:["18%","9%","18%","16%","18%","21%"][["When (Moab)","Area","Action","Employee","Record","Change"].indexOf(x)]}}>{x}</th>)}</tr></thead>
        <tbody>{visible.map(x=><tr key={x.domain+x.id}>{[
          new Date(x.at).toLocaleString("en-US",{timeZone:"America/Denver",dateStyle:"medium",timeStyle:"short"}),
          x.domain,x.action,x.actor,(x.object.startsWith("Vehicle ") ? x.object : `…${x.object.slice(-8)}`),x.detail
        ].map((s,i)=><td key={i} style={{padding:12,borderBottom:"1px solid #eaf0f4",whiteSpace:i===0?"nowrap":"normal",overflowWrap:"anywhere"}} title={i===4?x.object:undefined}>{s}</td>)}</tr>)}</tbody>
      </table>
      {!visible.length&&<p style={{padding:20}}>No recorded events match these filters.</p>}
    </div>
    <nav aria-label="Audit history pages" style={{display:"flex",gap:20,marginTop:20}}>
      {params.cursor?<Link href={`/admin/audit?${new URLSearchParams({employee,area})}`}>Newest matching events</Link>:null}
      {nextCursor?<Link href={`/admin/audit?${nextParams}`}>Older events →</Link>:null}
    </nav>
  </section></EpicToolsHome>;
}
