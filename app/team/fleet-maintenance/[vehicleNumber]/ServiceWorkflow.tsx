"use client";

import { useState } from "react";
import type { FleetServiceItem, FleetServiceRecord } from "@/lib/fleet-maintenance";

export default function ServiceWorkflow({
  vehicleNumber,
  currentMileage,
  initialService,
  initialItems,
}: {
  vehicleNumber:number;
  currentMileage:number|null;
  initialService:FleetServiceRecord|null;
  initialItems:FleetServiceItem[];
}) {
  const [service,setService]=useState(initialService);
  const [items,setItems]=useState(initialItems);
  const [parts,setParts]=useState(initialService?.parts_and_fluids_used||"");
  const [concerns,setConcerns]=useState(initialService?.additional_concerns||"");
  const [mpwr,setMpwr]=useState(Boolean(initialService?.mpwr_documented));
  const [inspection,setInspection]=useState(Boolean(initialService?.full_inspection_completed));
  const [completionMileage,setCompletionMileage]=useState(currentMileage?.toString()||"");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function call(payload:any) {
    setBusy(true); setMessage("");
    try {
      const r=await fetch("/api/team/fleet-maintenance/service",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({vehicleNumber,...payload}),
      });
      const p=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(p.error||"Service action failed.");
      return p;
    } catch(e) {
      setMessage(e instanceof Error?e.message:"Service action failed.");
      return null;
    } finally { setBusy(false); }
  }

  async function start() {
    const p=await call({action:"start"});
    if(!p) return;
    location.reload();
  }

  async function updateItem(item:FleetServiceItem,status:string) {
    const p=await call({action:"update_item",itemId:item.id,status,notes:item.notes||""});
    if(!p) return;
    setItems(rows=>rows.map(x=>x.id===item.id?{...x,status}:x));
  }

  async function saveService() {
    const p=await call({
      action:"update_service",
      serviceId:service?.id,
      parts_and_fluids_used:parts,
      additional_concerns:concerns,
      mpwr_documented:mpwr,
      full_inspection_completed:inspection,
    });
    if(p) {
      setService(s=>s?{...s,parts_and_fluids_used:parts,additional_concerns:concerns,mpwr_documented:mpwr,full_inspection_completed:inspection}:s);
      setMessage("Saved.");
    }
  }

  async function complete() {
    const p=await call({action:"complete",serviceId:service?.id,completionMileage:Number(completionMileage)});
    if(p) location.reload();
  }

  if(!service || service.status==="completed" || service.status==="cancelled") {
    return <div style={box}>
      <div style={kicker}>1,000-MILE SERVICE</div>
      <h3 style={{margin:"5px 0 10px",fontSize:22}}>{service?.status==="completed"?"Last service completed":"No open service"}</h3>
      {service?.completed_at?<div style={{color:"#68717d",fontSize:13,marginBottom:12}}>Completed {new Date(service.completed_at).toLocaleDateString()} at {service.completion_mileage?.toLocaleString()} miles.</div>:null}
      <button disabled={busy} onClick={start} style={primary}>Start 1,000-Mile Service</button>
      {message?<div style={error}>{message}</div>:null}
    </div>;
  }

  return <div style={box}>
    <div style={kicker}>1,000-MILE SERVICE</div>
    <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"start"}}>
      <div>
        <h3 style={{margin:"5px 0 3px",fontSize:22}}>Service in progress</h3>
        <div style={{color:"#68717d",fontSize:13}}>Started by {service.technician_name||"team member"} · Due at {service.due_mileage?.toLocaleString()||"—"} miles</div>
      </div>
      <span style={{background:"#fff4df",color:"#8d5a10",border:"1px solid #ead29a",borderRadius:999,padding:"5px 9px",fontSize:11,fontWeight:900}}>IN PROGRESS</span>
    </div>

    <div style={{marginTop:16,display:"grid",gap:8}}>
      {items.map(item=><div key={item.id} style={{border:"1px solid #e2e6ea",borderRadius:10,padding:11}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
          <div>
            <strong>{item.label}</strong>
            <div style={{color:"#6f7883",fontSize:12,marginTop:2}}>{item.action_text}</div>
          </div>
          <select value={item.status} onChange={e=>updateItem(item,e.target.value)} disabled={busy} style={select}>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="needs_attention">Needs Attention</option>
            <option value="not_applicable">N/A</option>
          </select>
        </div>
      </div>)}
    </div>

    <label style={label}>Parts & fluids used</label>
    <textarea value={parts} onChange={e=>setParts(e.target.value)} style={textarea} placeholder="Oil, filters, belt, tires, fluids, etc." />

    <label style={label}>Additional mechanical concerns</label>
    <textarea value={concerns} onChange={e=>setConcerns(e.target.value)} style={textarea} placeholder="Anything discovered during service or inspection" />

    <label style={check}><input type="checkbox" checked={inspection} onChange={e=>setInspection(e.target.checked)} /> Full mechanical inspection completed</label>
    <label style={check}><input type="checkbox" checked={mpwr} onChange={e=>setMpwr(e.target.checked)} /> Service documented in Polaris M Power</label>

    <div style={{display:"flex",gap:10,marginTop:14}}>
      <button disabled={busy} onClick={saveService} style={secondary}>Save Progress</button>
      <input value={completionMileage} onChange={e=>setCompletionMileage(e.target.value.replace(/\D/g,""))} placeholder="Completion mileage" style={{...select,flex:1}} />
      <button disabled={busy} onClick={complete} style={primary}>Complete Service</button>
    </div>
    {message?<div style={message==="Saved."?ok:error}>{message}</div>:null}
  </div>;
}

const box:React.CSSProperties={marginTop:14};
const kicker:React.CSSProperties={fontSize:11,color:"#7b8490",fontWeight:900,letterSpacing:".1em"};
const primary:React.CSSProperties={border:0,borderRadius:9,padding:"10px 13px",background:"#258b53",color:"white",fontWeight:900,cursor:"pointer"};
const secondary:React.CSSProperties={border:"1px solid #cfd6dd",borderRadius:9,padding:"10px 13px",background:"white",color:"#27313b",fontWeight:900,cursor:"pointer"};
const select:React.CSSProperties={border:"1px solid #cfd6dd",borderRadius:8,padding:"8px 10px",background:"white",fontSize:12};
const textarea:React.CSSProperties={width:"100%",boxSizing:"border-box",minHeight:68,border:"1px solid #cfd6dd",borderRadius:9,padding:"10px",fontSize:13,resize:"vertical"};
const label:React.CSSProperties={display:"block",fontSize:12,fontWeight:900,margin:"13px 0 6px"};
const check:React.CSSProperties={display:"flex",gap:8,alignItems:"center",marginTop:10,fontSize:13,fontWeight:700};
const error:React.CSSProperties={marginTop:10,padding:"9px 10px",background:"#fff0ee",border:"1px solid #efc5bf",color:"#922f27",borderRadius:8,fontSize:12};
const ok:React.CSSProperties={marginTop:10,padding:"9px 10px",background:"#effbf4",border:"1px solid #bfe3cd",color:"#257248",borderRadius:8,fontSize:12};
