"use client";
import {useEffect,useId,useRef,useState} from "react";
import formStyles from "./OhvUploadEnhancer.module.css";
import styles from "./GuestOhvUpload.module.css";
type Upload={id:string;driver_name:string;original_filename:string};
const normalized=(name:string)=>name.trim().replace(/\s+/g," ").toLowerCase();
export default function GuestOhvUpload({token,readinessId,driverNames,onUploaded}:{token:string;readinessId:string;driverNames:string[];onUploaded?:()=>void}){
 const [uploads,setUploads]=useState<Upload[]>([]);
 const [formDrivers,setFormDrivers]=useState<string[]|null>(null);
 const [driver,setDriver]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const fileInput=useRef<HTMLInputElement>(null),cameraInput=useRef<HTMLInputElement>(null);
 const helpId=useId();
 useEffect(()=>{let active=true;
 fetch(`/api/guest/${encodeURIComponent(token)}/guest-forms`,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(active)setFormDrivers(d?.signedRentalDrivers??[])}).catch(()=>{});
 fetch(`/api/guest/${encodeURIComponent(token)}/ohv?readinessId=${encodeURIComponent(readinessId)}`,{cache:"no-store"})
  .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"Cannot load certificates");if(active)setUploads(data.uploads??[])})
  .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to retrieve certificates")});
 return()=>{active=false};},[token,readinessId]);
 const names=[...new Map((formDrivers??driverNames).map(n=>n.trim()).filter(Boolean).map(n=>[normalized(n),n])).values()];
 const uploadedNames=new Set(uploads.map(upload=>normalized(upload.driver_name)));
 const remainingNames=names.filter(name=>!uploadedNames.has(normalized(name)));
 const complete=names.length>0&&remainingNames.length===0;
 function chooseFile(selected:File|null){setFile(selected);setError("");setSuccess("")}
 async function submit(){
  if(!remainingNames.includes(driver)||!file)return;
  setBusy(true);setError("");setSuccess("");
  try{
   const data=new FormData();data.set("readinessId",readinessId);data.set("driverName",driver);data.set("certificate",file);
   const response=await fetch(`/api/guest/${encodeURIComponent(token)}/ohv`,{method:"POST",body:data});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Certificate upload failed");
   setUploads(result.uploads??[]);setFile(null);setDriver("");
   if(fileInput.current)fileInput.current.value="";
   if(cameraInput.current)cameraInput.current.value="";
   setSuccess("Certificate uploaded and recorded for review.");onUploaded?.();
  }catch(e){setError(e instanceof Error?e.message:"Upload failed");}finally{setBusy(false)}
 }
 return <section aria-label="Upload OHV certificate" className={styles.uploadPanel} aria-busy={busy}>
  {names.length>0?<div className={`${formStyles.progress} ${complete?"":styles.pendingProgress}`}><strong>{names.length-remainingNames.length} of {names.length}</strong><span>{complete?"All driver certificates uploaded":"Driver certificates uploaded"}</span></div>:null}
  {uploads.length>0?<div className={formStyles.uploadList} aria-label="Uploaded OHV certificates">{uploads.map(upload=><div key={upload.id} className={formStyles.uploadRow}><span className={formStyles.check} aria-hidden="true">✓</span><div><strong>{upload.driver_name}</strong><small>{upload.original_filename}</small></div></div>)}</div>:null}
  {complete?<p className={styles.complete}>Every signed driver has an OHV certificate on file.</p>:names.length>0?<>
   <label className={formStyles.field}><span>Certificate holder</span><select value={driver} disabled={busy} onChange={e=>setDriver(e.target.value)}><option value="">Select signed driver</option>{remainingNames.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
   <p id={helpId} className={styles.help}>Upload a PDF, JPEG, PNG or HEIC certificate. Maximum file size: 10 MB.</p>
   <input ref={cameraInput} className={formStyles.hiddenInput} type="file" accept="image/jpeg,image/png,image/heic,image/heif" capture="environment" onChange={e=>chooseFile(e.target.files?.[0]??null)}/>
   <input ref={fileInput} className={formStyles.hiddenInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif" onChange={e=>chooseFile(e.target.files?.[0]??null)}/>
   <div className={formStyles.chooserRow}><button type="button" disabled={busy} aria-describedby={helpId} onClick={()=>cameraInput.current?.click()}>Open Camera</button><button type="button" disabled={busy} aria-describedby={helpId} onClick={()=>fileInput.current?.click()}>Choose File</button></div>
   {file?<p className={formStyles.selectedFile}>Selected: {file.name}</p>:null}
   <button className={formStyles.uploadButton} type="button" disabled={!remainingNames.includes(driver)||!file||busy} onClick={()=>void submit()}>{busy?"Uploading…":"Upload OHV Certificate"}</button>
  </>:<p className={styles.help}>Complete the required driver agreement before uploading a certificate.</p>}
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {success?<p role="status" className={styles.complete}>{success}</p>:null}
 </section>;
}
