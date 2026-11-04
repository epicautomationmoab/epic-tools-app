"use client";

import { useMemo, useState } from "react";
import type { FleetInspection, FleetInspectionItem } from "@/lib/fleet-maintenance";

export default function InspectionWorkflow({ vehicleNumber, initialInspection, initialItems }:{
  vehicleNumber:number; initialInspection:FleetInspection|null; initialItems:FleetInspectionItem[];
}) {
  const [inspection]=useState(initialInspection);
  const [items,setItems]=useState(initialItems);
  const [type,setType]=useState<"weekly"|"during_service">(initialInspection?.inspection_type==="during_service"?"during_service":"weekly");
  const [issues,setIssues]=useState(initialInspection?.issues_damage_found||"");
  const [actionRequired,setActionRequired]=useState(initialInspection?.action_required||"");
  const [result,setResult]=useState(initialInspection?.inspection_result||"");
  const [releaseDecision,setReleaseDecision]=useState(initialInspection?.release_decision_notes||"");
  const [workOrder,setWorkOrder]=useState(initialInspection?.work_order_reference||"");
  const [assignedTo,setAssignedTo]=useState(initialInspection?.assigned_to||"");
  const [targetDate,setTargetDate]=useState(initialInspection?.target_completion_date||"");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const groups=useMemo(()=>{
    const m=new Map<string,FleetInspectionItem[]>();
    for(const x of items){ const a=m.get(x.category_label); if(a)a.push(x); else m.set(x.category_label,[x]); }
    return Array.from(m.entries());
  },[items]);

  async function call(payload:any){
    setBusy(true); setMessage("");
    try{
      const r=await fetch("/api/team/fleet-maintenance/inspection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({vehicleNumber,...payload})});
      const p=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(p.error||"Inspection action failed.");
      return p;
    }catch(e){setMessage(e instanceof Error?e.message:"Inspection action failed.");return null;}
    finally{setBusy(false);}
  }

  async function start(){if(await call({action:"start",inspectionType:type})) location.reload();}
  async function itemStatus(item:FleetInspectionItem,status:string){
    if(await call({action:"update_item",itemId:item.id,status,notes:item.notes||""}))
      setItems(v=>v.map(x=>x.id===item.id?{...x,status:status as FleetInspectionItem["status"]}:x));
  }
  async function save(){
    if(!inspection)return;
    if(await call({action:"save",inspectionId:inspection.id,issues_damage_found:issues,action_required:actionRequired,inspection_result:result,release_decision_notes:releaseDecision,work_order_reference:workOrder,assigned_to:assignedTo,target_completion_date:targetDate}))
      setMessage("Saved.");
  }
  async function complete(){
    if(!inspection)return;
    if(await call({action:"complete",inspectionId:inspection.id,inspectionResult:result,actionRequired,issuesDamageFound:issues,releaseDecisionNotes:releaseDecision,workOrderReference:workOrder,assignedTo,targetCompletionDate:targetDate,inspectorSignature:inspection.inspector_name||""}))
      location.reload();
  }

  if(!inspection || inspection.status!=="in_progress"){
    return <div style={{marginTop:14}}>
      {inspection?.completed_at?<div style={{fontSize:13,color:"#68717d",marginBottom:10}}>Last completed {new Date(inspection.completed_at).toLocaleString()} · {inspection.inspection_result?.replaceAll("_"," ")}</div>:null}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
        <select value={type} onChange={e=>setType(e.target.value as any)} style={sel}>
          <option value="weekly">Weekly inspection</option>
          <option value="during_service">During scheduled service</option>
        </select>
        <button disabled={busy} onClick={start} style={primary}>Start Inspection</button>
      </div>
      {message?<div style={err}>{message}</div>:null}
    </div>;
  }

  return <div style={{marginTop:14}}>
    <div style={{fontSize:12,fontWeight:900,color:"#7b8490"}}>{inspection.inspection_type==="weekly"?"WEEKLY":"DURING SERVICE"} INSPECTION</div>
    <div style={{fontSize:13,color:"#68717d",marginTop:4}}>Inspector: {inspection.inspector_name||"Epic team"}</div>
    <div style={{display:"grid",gap:12,marginTop:14}}>
      {groups.map(([name,rows])=><section key={name} style={{border:"1px solid #e1e5e9",borderRadius:10,padding:11,background:"#fafbfc"}}>
        <strong style={{fontSize:12}}>{name}</strong>
        {rows.map(x=><div key={x.id} style={{display:"grid",gridTemplateColumns:"1fr 150px",gap:8,alignItems:"center",borderTop:"1px solid #edf0f2",paddingTop:8,marginTop:8}}>
          <span style={{fontSize:13}}>{x.label}</span>
          <select disabled={busy} value={x.status} onChange={e=>itemStatus(x,e.target.value)} style={sel}>
            <option value="pending">Pending</option><option value="pass">Pass</option><option value="needs_attention">Needs Attention</option><option value="not_applicable">N/A</option>
          </select>
        </div>)}
      </section>)}
    </div>

    <label style={lab}>Issues / damage found</label><textarea value={issues} onChange={e=>setIssues(e.target.value)} style={ta}/>
    <label style={lab}>Action required</label><select value={actionRequired} onChange={e=>setActionRequired(e.target.value)} style={{...sel,width:"100%"}}>
      <option value="">Select action</option><option value="no_action">No action</option><option value="monitor">Monitor</option><option value="maintenance_repair">Maintenance / repair required</option><option value="remove_from_service">Remove from service pending repair or safety review</option>
    </select>
    <label style={lab}>Inspection result</label><select value={result} onChange={e=>setResult(e.target.value)} style={{...sel,width:"100%"}}>
      <option value="">Select result</option><option value="passed">Passed / ready for service</option><option value="needs_attention">Needs attention</option><option value="out_of_service">Out of service</option>
    </select>
    {result==="needs_attention"?<><label style={lab}>Release decision</label><textarea value={releaseDecision} onChange={e=>setReleaseDecision(e.target.value)} style={ta}/></>:null}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <label style={lab}>Work order<input value={workOrder} onChange={e=>setWorkOrder(e.target.value)} style={inp}/></label>
      <label style={lab}>Assigned to<input value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} style={inp}/></label>
    </div>
    <label style={lab}>Target completion date<input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} style={inp}/></label>
    <div style={{display:"flex",gap:8,marginTop:14}}><button disabled={busy} onClick={save} style={secondary}>Save Progress</button><button disabled={busy} onClick={complete} style={primary}>Complete Inspection</button></div>
    {message?<div style={message==="Saved."?ok:err}>{message}</div>:null}
  </div>;
}
const primary:React.CSSProperties={border:0,borderRadius:8,padding:"9px 12px",background:"#258b53",color:"white",fontWeight:900};
const secondary:React.CSSProperties={border:"1px solid #cfd6dd",borderRadius:8,padding:"9px 12px",background:"white",fontWeight:900};
const sel:React.CSSProperties={border:"1px solid #cfd6dd",borderRadius:8,padding:"8px",background:"white",fontSize:12};
const lab:React.CSSProperties={display:"grid",gap:5,fontSize:12,fontWeight:900,marginTop:12};
const inp:React.CSSProperties={border:"1px solid #cfd6dd",borderRadius:8,padding:"8px",fontSize:13};
const ta:React.CSSProperties={width:"100%",boxSizing:"border-box",minHeight:68,border:"1px solid #cfd6dd",borderRadius:8,padding:"9px"};
const err:React.CSSProperties={marginTop:10,padding:9,background:"#fff0ee",color:"#922f27",borderRadius:8};
const ok:React.CSSProperties={marginTop:10,padding:9,background:"#effbf4",color:"#257248",borderRadius:8};
