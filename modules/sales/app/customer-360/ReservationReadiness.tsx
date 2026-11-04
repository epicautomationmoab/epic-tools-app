"use client";
import {useEffect,useState} from "react";
import CancellationAgreementPanel from "./CancellationAgreementPanel";
type Docs={businessLine?:string|null;guestPortalUrl?:string|null;mpwrReservationUrl?:string|null;readinessId:string;epicReceived:number;epicExpected:number;mpwrReceived:number;mpwrExpected:number;epic:Array<{name:string;role:string;url:string|null;minors?:string[]}>;polaris:Array<{name:string;role:string;url:string|null}>;ohv?:Array<{id:string;name:string;filename:string;uploadedAt:string}>};
type Certificate={readinessId:string;driverName:string;filename:string;uploadedAt:string;viewUrl:string|null};
type Status={confirmation_code:string;ohv_required:boolean|null;ohv_certificate_uploaded:boolean|null;mpwr_document_received_count:number|null;mpwr_document_expected_count:number|null;handoff_status:string|null};
export default function ReservationReadiness({confirmation,customerName,customerPhone,customerEmail,productName}:{confirmation:string;customerName?:string|null;customerPhone?:string|null;customerEmail?:string|null;productName?:string|null}){
 const [row,setRow]=useState<Status|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [expanded,setExpanded]=useState(false);
 const [resendOpen,setResendOpen]=useState(false);
 const [resendRecipient,setResendRecipient]=useState("");
 const [resendBusy,setResendBusy]=useState(false);
 const [resendStatus,setResendStatus]=useState("");
 async function previewResend(){setResendOpen(true);setResendRecipient("");setResendStatus("");setResendBusy(true);try{const r=await fetch("/api/sales/customer-360/resend-confirmation?confirmationCode="+encodeURIComponent(confirmation),{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error||"Unable to load recipient");setResendRecipient(j.recipient);}catch(e){setResendStatus(e instanceof Error?e.message:"Unable to load email");}finally{setResendBusy(false)}}
 async function sendResend(){setResendBusy(true);setResendStatus("");try{const r=await fetch("/api/sales/customer-360/resend-confirmation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmationCode:confirmation})});const j=await r.json();if(!r.ok)throw Error(j.error||"Resend failed");setResendStatus("Confirmation sent to "+j.recipient);}catch(e){setResendStatus(e instanceof Error?e.message:"Resend failed");}finally{setResendBusy(false)}}
 const [certificates,setCertificates]=useState<Certificate[]>([]);
 const [documents,setDocuments]=useState<Docs[]>([]);
 async function refresh(){
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/sales/customer-readiness?confirmation="+encodeURIComponent(confirmation),{cache:"no-store"});
   if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(typeof detail.error==="string"?detail.error:"Request failed ("+response.status+")");}
   const result=await response.json() as {rows:Status[];certificates?:Certificate[];documents?:Docs[]};
   setCertificates(result.certificates||[]);
   setDocuments(result.documents||[]);
   setRow(result.rows?.[0]||null);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load readiness details.");}finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[confirmation]);
 const destination="/team/readiness?confirmation="+encodeURIComponent(confirmation);
 const isRental=documents[0]?.businessLine?.toLowerCase()==="rental";
 const epicCoverage=(d:Docs)=>{const covered=d.epic.reduce((n,p)=>n+1+(p.minors?.length||0),0);return {received:Math.max(d.epicReceived,covered),expected:d.epicExpected};};
 const portalUrl=documents[0]?.guestPortalUrl?""+documents[0].guestPortalUrl:null;
 const ohv=(documents[0]?.ohv?.length??0)>0?"Received ("+documents[0]!.ohv!.length+")":"Not uploaded";
 const button={border:"1px solid #d9e0ea",borderRadius:9,padding:"9px 11px",background:"#fff",fontWeight:700,fontSize:12,color:"#334155",cursor:"pointer"} as const;
 const complete=(n:number,e:number)=>e>0&&n>=e;
 const received=documents[0]?epicCoverage(documents[0]).received:0;
 const expected=documents[0]?epicCoverage(documents[0]).expected:0;
 const summary=[{label:"Epic Documents",value:received+"/"+expected,ok:complete(received,expected),bg:"#edf8f1",border:"#ccebd8",accent:"#166534"},{label:"MPWR Waivers",value:(documents[0]?.mpwrReceived??0)+"/"+(documents[0]?.mpwrExpected??0),ok:complete(documents[0]?.mpwrReceived??0,documents[0]?.mpwrExpected??0),bg:"#eef5ff",border:"#cbdffa",accent:"#1d4ed8"},...(isRental?[{label:"OHV Certificates",value:(documents[0]?.ohv?.length??0)+" uploaded",ok:(documents[0]?.ohv?.length??0)>0,bg:"#fff8e9",border:"#f0dca9",accent:"#986400"}]:[])];
 const view=(url:string|null|undefined,label="View")=>url?<a href={url} target="_blank" rel="noreferrer" style={{...button,textDecoration:"none",whiteSpace:"nowrap",...(label==="Guest Portal"?{background:"#c44825",borderColor:"#c44825",color:"#fff"}:label==="MPWR Reservation"?{background:"#334155",borderColor:"#334155",color:"#fff"}:label==="Full Readiness"?{background:"#7c3aed",borderColor:"#7c3aed",color:"#fff"}:{background:"#fff",borderColor:"#d9e0ea",color:"#334155"})}}>{label}</a>:<span style={{fontSize:11,color:"#94a3b8"}}>Unavailable</span>;
 const line=(name:string,role:string,url:string|null|undefined,key:string)=> <div key={key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 0",borderBottom:"1px solid #edf0f4"}}><div style={{minWidth:0}}><div style={{fontWeight:750,fontSize:13}}>{name||"Guest"}</div><div style={{color:"#64748b",fontSize:11,marginTop:2}}>{role}</div></div>{view(url)}</div>;
 return <div style={{marginTop:12,borderTop:"1px solid #e4e8ed",paddingTop:14,fontSize:12}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10}}><strong style={{fontSize:14}}>Guest Readiness</strong><button type="button" onClick={()=>void refresh()} disabled={loading} title="Refresh readiness" aria-label="Refresh readiness" style={{...button,padding:"6px 9px",fontWeight:600}}>↻ {loading?"Loading":"Refresh"}</button></div>
  {error?<div role="alert" style={{color:"#b42318"}}>{error}</div>:loading&&!row?<div>Checking readiness…</div>:!row&&!documents.length?<div>No readiness record located.</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>{summary.map(item=><div key={item.label} style={{padding:11,border:"1px solid #e2e8f0",borderRadius:10,background:item.bg,borderColor:item.border}}><div style={{fontSize:11,color:item.accent,fontWeight:700}}>{item.label}</div><div style={{fontSize:16,fontWeight:800,marginTop:5,color:"#172033"}}>{item.value} <span style={{fontSize:12,color:item.ok?"#15803d":"#9a6700"}}>{item.ok?"✓":"•"}</span></div></div>)}</div>}
  {documents[0]?.readinessId?<div style={{marginTop:12}}><CancellationAgreementPanel compactLauncher row={{readiness_id:documents[0].readinessId,confirmation_code:confirmation,customer_name:customerName||"Guest",customer_phone:customerPhone||null,customer_email:customerEmail||null,product_display_name:productName||"Reservation"}}/></div>:null}
  <div style={{marginTop:13,display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
   {portalUrl?view(portalUrl,"Guest Portal"):null}
   <button type="button" onClick={()=>setExpanded(true)} style={{...button,color:"#fff",borderColor:"#1d4ed8",background:"#1d4ed8"}}>View Documents</button>
   {isRental&&documents[0]?.mpwrReservationUrl?view(documents[0].mpwrReservationUrl,"MPWR Reservation"):null}
   {view(destination,"Full Readiness")}
   <button type="button" onClick={()=>void previewResend()} style={{...button,gridColumn:"1 / -1",fontWeight:850,color:"#fff",background:"#15803d",borderColor:"#15803d"}}>Resend Confirmation</button>
  </div>
  {resendOpen?<div role="presentation" style={{position:"fixed",inset:0,zIndex:10001,background:"#0f172a88",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div role="dialog" aria-modal="true" aria-label="Resend confirmation email" style={{background:"#fff",borderRadius:16,padding:24,maxWidth:430,width:"100%",boxShadow:"0 25px 65px #0004"}}><h3 style={{margin:"0 0 12px",fontSize:20}}>Resend Confirmation</h3><div style={{color:"#64748b",fontSize:13}}>Reservation {confirmation}</div><div style={{margin:"16px 0",fontSize:14}}>Send the original confirmation to: <strong>{resendRecipient||"Checking recipient…"}</strong></div>{resendStatus?<p role="status" style={{fontSize:13}}>{resendStatus}</p>:null}<div style={{display:"flex",justifyContent:"end",gap:9}}><button type="button" style={button} onClick={()=>setResendOpen(false)}>Close</button>{!resendStatus.startsWith("Confirmation sent")?<button type="button" style={{...button,color:"#fff",background:"#15803d"}} disabled={resendBusy||!resendRecipient} onClick={()=>void sendResend()}>{resendBusy?"Please wait…":"Send Confirmation"}</button>:null}</div></div></div>:null}
  {expanded?<div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setExpanded(false)}} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
   <div role="dialog" aria-modal="true" aria-label="Reservation documents" style={{background:"#fff",color:"#172033",borderRadius:16,padding:"20px 22px",width:"min(720px,100%)",maxHeight:"88vh",overflowY:"auto",boxShadow:"0 25px 70px #0f172a44"}}>
    <div style={{display:"flex",alignItems:"start",justifyContent:"space-between",gap:12,marginBottom:14}}><div><strong style={{fontSize:20}}>Reservation Documents</strong><div style={{fontSize:12,color:"#64748b",marginTop:3}}>TripWorks {confirmation}</div></div><button type="button" onClick={()=>setExpanded(false)} aria-label="Close documents" style={{...button,padding:"6px 10px"}}>✕</button></div>
    {error?<p role="alert">{error}</p>:!documents.length?<p>No Readiness document detail available.</p>:documents.map((d,i)=><div key={d.readinessId||i}>
     <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7,marginBottom:18}}>
      {[{name:"Epic Docs",count:epicCoverage(d).received+"/"+epicCoverage(d).expected},{name:"MPWR Waivers",count:d.mpwrReceived+"/"+d.mpwrExpected},...(d.businessLine?.toLowerCase()==="rental"?[{name:"OHV",count:(d.ohv||[]).length+" uploaded"}]:[])].map(t=><div key={t.name} style={{background:t.name==="Epic Docs"?"#edf8f1":t.name==="MPWR Waivers"?"#eef5ff":"#fff8e9",border:"1px solid "+(t.name==="Epic Docs"?"#ccebd8":t.name==="MPWR Waivers"?"#cbdffa":"#f0dca9"),borderRadius:10,padding:10}}><div style={{fontSize:11,color:t.name==="Epic Docs"?"#166534":t.name==="MPWR Waivers"?"#1d4ed8":"#986400",fontWeight:700}}>{t.name}</div><strong style={{fontSize:15}}>{t.count}</strong></div>)}
     </div>
     <section style={{marginTop:13}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",background:"#edf8f1",padding:"10px 12px",borderLeft:"4px solid #16a34a",borderRadius:8}}><strong style={{fontSize:15}}>Epic Documents</strong><span style={{color:"#15803d",fontSize:12,fontWeight:700}}>{epicCoverage(d).received}/{epicCoverage(d).expected}</span></div>{d.epic.length?d.epic.map((p,j)=><div key={j}>{line(p.name,p.role,p.url,"epic"+j)}{p.minors?.map((minor,k)=><div key={k} style={{padding:"3px 0 6px 12px",fontSize:11,color:"#64748b"}}>Covered minor: {minor}</div>)}</div>):<p style={{color:"#64748b"}}>No signed Epic documents found.</p>}</section>
     <section style={{marginTop:20}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",background:"#eef5ff",padding:"10px 12px",borderLeft:"4px solid #2563eb",borderRadius:8}}><strong style={{fontSize:15}}>MPWR Waivers</strong><span style={{fontSize:12,fontWeight:700,color:"#15803d"}}>{d.mpwrReceived}/{d.mpwrExpected}</span></div>{d.polaris.length?d.polaris.map((p,j)=>line(p.name,p.role,p.url,"mpwr"+j)):<p style={{color:"#64748b"}}>No MPWR waivers found.</p>}</section>
     {d.businessLine?.toLowerCase()==="rental"?<section style={{marginTop:20}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",background:"#fff8e9",padding:"10px 12px",borderLeft:"4px solid #d97706",borderRadius:8}}><strong style={{fontSize:15}}>OHV Certificates</strong><span style={{fontSize:12,fontWeight:700}}>{(d.ohv||[]).length} uploaded</span></div>{d.ohv?.length?d.ohv.map(c=>line(c.name||"Driver","Certificate uploaded","/api/team/ohv/view/"+encodeURIComponent(c.id),c.id)):<p style={{color:"#64748b"}}>No OHV certificates uploaded.</p>}</section>:null}
    </div>)}
   </div>
  </div>:null}
 </div>;
}
