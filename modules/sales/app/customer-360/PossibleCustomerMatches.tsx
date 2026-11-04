"use client";
import {useEffect,useState} from "react";

type Candidate={candidate_name:string;candidate_phone:string|null;candidate_email:string|null;confidence_score:number;evidence:{exact_name?:boolean;nickname_variant?:boolean;within_two_hours?:boolean;same_area_code?:boolean};source_count:number;source_records:Array<{source_type:string;source_key:string}>};
export default function PossibleCustomerMatches({name,phone,email,sourceType,sourceKey}:{name:string|null|undefined;phone:string|null|undefined;email:string|null|undefined;sourceType?:string|null;sourceKey?:string|null}){
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [matches,setMatches]=useState<Candidate[]>([]);
  const [resolvedCallSource,setResolvedCallSource]=useState("");
  const [reviewing,setReviewing]=useState(false);
  const [reviewMessage,setReviewMessage]=useState("");
  const [selectedCandidate,setSelectedCandidate]=useState<Candidate|null>(null);
  const [primaryPhone,setPrimaryPhone]=useState("");
  const [primaryEmail,setPrimaryEmail]=useState("");
  const [inspectCandidate,setInspectCandidate]=useState<Candidate|null>(null);
  const [inspectData,setInspectData]=useState<any>(null);
  const [inspectLoading,setInspectLoading]=useState(false);
  const [inspectError,setInspectError]=useState("");
  async function inspect(candidate:Candidate){
    setInspectCandidate(candidate);setInspectData(null);setInspectError("");setInspectLoading(true);
    try{
      const q=new URLSearchParams();
      if(candidate.candidate_phone)q.set("phone",candidate.candidate_phone);
      if(candidate.candidate_email)q.set("email",candidate.candidate_email);
      const res=await fetch("/api/sales/customer-360?"+q.toString(),{cache:"no-store"});
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||"Could not load the other customer.");
      setInspectData(body.customer);
    }catch(err){setInspectError(err instanceof Error?err.message:"Unable to load history.");}
    finally{setInspectLoading(false);}
  }
  async function review(candidate:Candidate, decision:"confirmed"|"rejected"){
    const target=candidate.source_records?.find(r=>r.source_key&&(r.source_type==="sales_opportunity"||r.source_type==="call")&&!(r.source_type===sourceType&&r.source_key===sourceKey));
    const leftType=(sourceType==="call"||sourceType==="sales_opportunity")&&sourceKey?sourceType:(resolvedCallSource?"call":null);
    const leftKey=(sourceType==="call"||sourceType==="sales_opportunity")&&sourceKey?sourceKey:resolvedCallSource;
    if(!leftType||!leftKey||!target){setReviewMessage("A verified source record is required for this decision.");return;}
    setReviewing(true);setReviewMessage("");
    try{
      const response=await fetch("/api/sales/customer-360/possible-matches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({left_type:leftType,left_key:leftKey,right_type:target.source_type,right_key:target.source_key,decision,...(decision==="confirmed"?{primary_phone:primaryPhone,primary_email:primaryEmail||null}:{})})});
      if(!response.ok){const details=await response.json().catch(()=>null);throw new Error(details?.error||"Could not save review ("+response.status+")");}
      const result=await response.json();
      setMatches(previous=>previous.filter(m=>m!==candidate));
      setSelectedCandidate(null);
      setReviewMessage(decision==="confirmed"?(result.history_linked?"Confirmed. Both phone histories are now linked. Reopen C360 to see the combined timeline.":"Confirmation recorded; history link is not yet available."):"Not-the-same-person decision recorded.");
    }catch(e){setReviewMessage(e instanceof Error?e.message:"Unable to save decision.");}
    finally{setReviewing(false);}
  }
  useEffect(()=>{
    if(!open||!name)return;
    const controller=new AbortController();
    const q=new URLSearchParams({name});
    if(phone)q.set("phone",phone);
    if(email)q.set("email",email);
    if(sourceType&&sourceKey){q.set("source_type",sourceType);q.set("source_key",sourceKey);}
    setLoading(true);setError("");
    fetch("/api/sales/customer-360/possible-matches?"+q,{signal:controller.signal,cache:"no-store"})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"Unable to search.");return data;})
      .then(data=>{setMatches(data.matches||[]);setResolvedCallSource(data.current_call_source||"");})
      .catch(e=>{if(e.name!=="AbortError")setError(e.message||"Lookup failed.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[open,name,phone,email,sourceType,sourceKey]);
  if(!name||name.trim().length<3)return null;
  return <div style={{position:"relative",display:"inline-block"}}>
    <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} style={{border:"1px solid #cbd5e1",borderRadius:7,padding:"7px 10px",background:"#fff",color:"#334155",cursor:"pointer",fontSize:12,fontWeight:700}}>Possible matches ▾</button>
    {open?<div role="region" aria-label="Possible customer matches" style={{position:"absolute",zIndex:40,top:"calc(100% + 6px)",right:0,width:"min(380px,80vw)",maxHeight:"75vh",overflowY:"auto",padding:14,background:"#fff",color:"#172033",border:"1px solid #cbd5e1",borderRadius:10,boxShadow:"0 12px 28px #0002",fontSize:13}}>
      <div style={{fontWeight:800,marginBottom:6}}>Possible customer matches</div>
      <p style={{margin:"0 0 10px",color:"#64748b"}}>Suggestions only. No customer records are merged.</p>
      {reviewMessage?<p role="status">{reviewMessage}</p>:null}
      {!inspectCandidate?<>
      {loading?<p>Searching…</p>:error?<p role="alert">{error}</p>:matches.length===0?<p>No suggested matches found.</p>:matches.map((m,i)=><div key={i} style={{padding:"10px 0",borderTop:"1px solid #e2e8f0"}}>
        <strong>{m.candidate_name||"Unnamed customer"}</strong>
        <div style={{fontSize:12,color:"#475569"}}>{[m.candidate_phone,m.candidate_email].filter(Boolean).join(" · ")||"No contact method"}</div>
        <div style={{marginTop:4,fontSize:11,color:"#64748b"}}>{[m.evidence?.exact_name?"Same name":null,m.evidence?.nickname_variant?"Name variation":null,m.evidence?.same_area_code?"Same area code":null,m.evidence?.within_two_hours?"Recent activity":null].filter(Boolean).join(" · ")}{m.source_count>1?` · ${m.source_count} records`:""}</div>
        <button type="button" onClick={()=>void inspect(m)} style={{display:"block",padding:"6px 0",border:0,background:"transparent",color:"#6d28d9",textDecoration:"underline",fontWeight:700,cursor:"pointer"}}>View C360 →</button>
        {(sourceType&&sourceKey||resolvedCallSource)&&m.source_records?.length?<div style={{display:"flex",gap:7,marginTop:8}}><button type="button" disabled={reviewing} onClick={()=>{setSelectedCandidate(m);setPrimaryPhone(m.candidate_phone||phone||"");setPrimaryEmail(m.candidate_email||email||"");}} style={{flex:1,padding:"9px 12px",border:"none",borderRadius:9,background:"linear-gradient(110deg,#7c3aed 0%,#ce3b91 45%,#f97316 100%)",boxShadow:"0 3px 10px rgba(190,50,125,.2)",color:"#fff",fontSize:12,fontWeight:800,cursor:reviewing?"wait":"pointer",opacity:reviewing?.6:1}}>✓ Same person</button><button type="button" disabled={reviewing} onClick={()=>void review(m,"rejected")} style={{flex:1,padding:"9px 12px",border:"1px solid #cbd5e1",borderRadius:9,background:"linear-gradient(120deg,#f8fafc 0%,#e2e8f0 100%)",color:"#334155",fontSize:12,fontWeight:750,cursor:reviewing?"wait":"pointer",opacity:reviewing?.6:1}}>Not same person</button></div>:null}
      </div>)}
      </>:null}
      {inspectCandidate?<section aria-label="Suggested customer history" style={{marginTop:12,padding:12,border:"1px solid #c4b5fd",borderRadius:10,background:"#f8fafc"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><strong>Other C360 · Read only</strong><button type="button" onClick={()=>setInspectCandidate(null)} style={{border:"1px solid #cbd5e1",padding:"7px 9px",borderRadius:7,background:"#fff",cursor:"pointer"}}>← Back</button></div>
        <div style={{marginTop:6,fontSize:12}}>{inspectCandidate.candidate_name} · {inspectCandidate.candidate_phone||inspectCandidate.candidate_email}</div>
        {inspectLoading?<p>Loading history…</p>:inspectError?<p role="alert">{inspectError}</p>:inspectData?<div style={{marginTop:10,fontSize:12}}>
          {(["calls","texts","emails","reservations","opportunities","drafts","quotes","team_thread_notes"] as const).map(key=>{
            const items=Array.isArray(inspectData[key])?inspectData[key]:[];
            return <div key={key} style={{borderTop:"1px solid #e2e8f0",padding:"6px 0"}}><strong>{key.replace(/_/g," ")} · {items.length}</strong>{items.slice(0,3).map((item:any,i:number)=><p key={String(item.id||i)} style={{margin:"4px 0",color:"#475569"}}>{String(item.at||item.created_at||item.start_time||"").slice(0,16)} {String(item.summary||item.subject||item.experience_name||item.body||item.customer_name||"").slice(0,180)}</p>)}</div>;
          })}
          <p style={{color:"#64748b"}}>Inspection only. No records changed.</p>
        </div>:null}
      </section>:null}
      {selectedCandidate?<div role="dialog" aria-modal="true" aria-label="Confirm customer identity and primary contacts" style={{position:"relative",padding:14,marginTop:12,border:"1px solid #c4b5fd",borderRadius:12,background:"#faf9ff"}}>
        <strong>Confirm customer match</strong><p style={{fontSize:12,color:"#475569"}}>Choose one primary phone and email before linking. Both phone histories will be preserved.</p>
        <div style={{fontWeight:700,marginBottom:5}}>Primary phone</div>
        {[...new Set([phone,selectedCandidate.candidate_phone].filter((v):v is string=>Boolean(v)))].map(v=><label key={v} style={{display:"block",marginBottom:6}}><input type="radio" checked={primaryPhone===v} onChange={()=>setPrimaryPhone(v)}/> {v}</label>)}
        <div style={{fontWeight:700,margin:"12px 0 5px"}}>Primary email</div>
        {[...new Set([email,selectedCandidate.candidate_email].filter((v):v is string=>Boolean(v)))].length?
          [...new Set([email,selectedCandidate.candidate_email].filter((v):v is string=>Boolean(v)))].map(v=><label key={v} style={{display:"block",marginBottom:6}}><input type="radio" checked={primaryEmail===v} onChange={()=>setPrimaryEmail(v)}/> {v}</label>):
          <p style={{fontSize:12,color:"#64748b"}}>Neither record has an email address.</p>}
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button type="button" disabled={reviewing||!primaryPhone} onClick={()=>void review(selectedCandidate,"confirmed")} style={{padding:"9px 12px",border:0,borderRadius:8,background:"linear-gradient(110deg,#7c3aed,#ce3b91,#f97316)",color:"white",fontWeight:800}}>Confirm & link</button>
          <button type="button" disabled={reviewing} onClick={()=>setSelectedCandidate(null)} style={{padding:"9px 12px",border:"1px solid #cbd5e1",borderRadius:8,background:"white"}}>Cancel</button>
        </div>
      </div>:null}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}><button type="button" onClick={()=>setOpen(false)} style={{background:"#fff",border:"1px solid #cbd5e1",borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>Close</button></div>
    </div>:null}
  </div>;
}
