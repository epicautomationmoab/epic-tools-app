"use client";
import {useEffect,useState} from "react";
type Upload={id:string;driver_name:string;original_filename:string};
export default function GuestOhvUpload({token,readinessId,driverNames,onUploaded}:{token:string;readinessId:string;driverNames:string[];onUploaded?:()=>void}){
 const [uploads,setUploads]=useState<Upload[]>([]);
 const [driver,setDriver]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 useEffect(()=>{let active=true;
 fetch(`/api/guest/${encodeURIComponent(token)}/guest-forms`,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(active)setFormDrivers(d?.signedRentalDrivers??[])}).catch(()=>{});
 fetch(`/api/guest/${encodeURIComponent(token)}/ohv?readinessId=${encodeURIComponent(readinessId)}`,{cache:"no-store"})
  .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"Cannot load certificates");if(active)setUploads(data.uploads??[])})
  .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to retrieve certificates")});
 return()=>{active=false};},[token,readinessId]);
 const names=[...new Set([...driverNames,...formDrivers].map(n=>n.trim()).filter(Boolean))];
 async function submit(){
  if(!driver||!file)return;
  setBusy(true);setError("");setSuccess("");
  try{
   const data=new FormData();data.set("readinessId",readinessId);data.set("driverName",driver);data.set("certificate",file);
   const response=await fetch(`/api/guest/${encodeURIComponent(token)}/ohv`,{method:"POST",body:data});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Certificate upload failed");
   setUploads(result.uploads??[]);setFile(null);setDriver("");
   setSuccess("Certificate uploaded and recorded for review.");onUploaded?.();
  }catch(e){setError(e instanceof Error?e.message:"Upload failed");}finally{setBusy(false)}
 }
 return <section aria-label="Upload OHV certificate" style={{marginTop:12}}>
  {uploads.length>0?<p>Uploaded certificates: {uploads.map(x=>x.original_filename).join(", ")}</p>:null}
  {names.length>0?<label>Certificate holder <select value={driver} onChange={e=>setDriver(e.target.value)} style={{display:"block",margin:"6px 0 12px",width:"100%"}}>
    <option value="">Select signed driver</option>{names.map(n=><option key={n} value={n}>{n}</option>)}
   </select></label>:<p>Complete the required driver agreement before uploading the certificate.</p>}
  <label>OHV certificate (PDF, JPEG, PNG or HEIC; 10 MB maximum)
   <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif" onChange={e=>setFile(e.target.files?.[0]??null)} style={{display:"block",margin:"8px 0"}}/>
  </label>
  <button type="button" disabled={!names.length||!driver||!file||busy} onClick={()=>void submit()}>{busy?"Uploading…":"Upload OHV Certificate"}</button>
  {error?<p role="alert" style={{color:"#a32626"}}>{error}</p>:null}
  {success?<p role="status">{success}</p>:null}
 </section>;
}
