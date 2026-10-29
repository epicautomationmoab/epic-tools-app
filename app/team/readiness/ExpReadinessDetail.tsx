"use client";
import {useEffect,useState} from "react";
type Driver={name:string;expReady:boolean;orientationComplete:boolean;outstanding:string[]};
type Status={sessions:{id:string}[];drivers:Driver[];expReady:boolean;outstanding:string[]};
const labels:Record<string,string>={driverIdentity:"Driver identity",polarisWaiver:"Polaris waiver",ohvCertificate:"OHV certificate",videoAndAssessment:"Orientation and knowledge check"};
export default function ExpReadinessDetail({readinessId}:{readinessId:string|null|undefined}){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState("");
 useEffect(()=>{if(!readinessId)return;let active=true;setData(null);setError("");
  const load=()=>fetch(`/api/team/exp/readiness?readinessId=${encodeURIComponent(readinessId)}`,{cache:"no-store"})
   .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load EXC");if(active)setData(d as Status)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load EXC")});
  void load();const timer=window.setInterval(()=>void load(),30000);
  return()=>{active=false;window.clearInterval(timer)};
 },[readinessId]);
 return <section aria-label="Epic Xpress Checkout" style={{padding:"16px 0"}}>
  <h3>Epic Xpress Checkout</h3>
  <p>Driver orientation is verified alongside Epic agreements, Polaris waivers and OHV certificates. EXC does not bypass paperwork.</p>
  {!readinessId?<p>No reservation ID available.</p>:error?<p role="alert">{error}</p>:!data?<p>Checking driver readiness…</p>:
   <><p><strong>{data.expReady?"EXC complete":"EXC needs attention"}</strong> · {data.drivers.filter(d=>d.expReady).length} of {data.drivers.length} drivers verified</p>
   {data.drivers.length===0?<p>No signed drivers identified yet.</p>:data.drivers.map(d=>
    <div key={d.name.trim().toLowerCase()} style={{padding:"8px 0",borderTop:"1px solid #dde5ea"}}>
     <strong>{d.name}</strong> — {d.expReady?"Ready":d.orientationComplete?"Orientation complete; other requirements pending":"Orientation pending"}
     {d.outstanding.length>0?<div style={{fontSize:"0.9em"}}>Needs: {d.outstanding.map(k=>labels[k]??k).join(", ")}</div>:null}
    </div>
   )}
   <p style={{fontSize:"0.9em"}}>{data.expReady?"EXC requirements verified. Final vehicle checkout is separate.":"Driver requirements must be verified before EXC can be marked complete."}</p>
   </>}
 </section>;
}
