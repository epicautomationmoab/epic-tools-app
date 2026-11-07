"use client";
import {useState} from "react";
import styles from "./IdentityActions.module.css";
type Result={contact_id:string|null;customer_name:string|null;email:string|null;phone:string|null};
export default function SocialIdentityLink({contactId,onLinked}:{contactId:string;onLinked:()=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[results,setResults]=useState<Result[]>([]);
 const [choice,setChoice]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function search(){setBusy(true);setError("");setChoice(null);try{
 const r=await fetch("/api/sales/customers?q="+encodeURIComponent(query.trim()),{cache:"no-store"});
 const v=await r.json();if(!r.ok)throw Error(v.error||"Search failed");
 setResults((v.customers||[]).filter((c:Result)=>c.contact_id&&c.contact_id!==contactId));
 }catch(e){setError(e instanceof Error?e.message:"Search failed");}finally{setBusy(false);}}
 async function confirm(){if(!choice?.contact_id)return;setBusy(true);setError("");try{
 const r=await fetch("/api/sales/customer-360/social-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source_contact_id:contactId,target_contact_id:choice.contact_id})});
 const v=await r.json();if(!r.ok)throw Error(v.error||"Link failed");onLinked();
 }catch(e){setError(e instanceof Error?e.message:"Link failed");}finally{setBusy(false);}}
 return <div className={styles.anchor}>
  <button type="button" className={styles.secondaryButton} aria-expanded={open} onClick={()=>{setOpen(!open);setChoice(null);setError("");}}>Link customer</button>
  {open?<section className={styles.panel} aria-label="Link social identity">
   <div className={styles.panelHeading}><div><strong>Link customer identity</strong><p>Connect this social history to an existing C360 profile. No unrelated customer records will be merged.</p></div><button type="button" className={styles.closeSmall} onClick={()=>setOpen(false)} aria-label="Close linking">×</button></div>
   <div className={styles.searchRow}><input aria-label="Find existing customer" placeholder="Name, email, or phone" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&query.trim().length>=2)void search();}}/><button type="button" className={styles.findButton} disabled={busy||query.trim().length<2} onClick={()=>void search()}>{busy?"Searching…":"Find"}</button></div>
   <div className={styles.results}>{results.slice(0,15).map(c=><button type="button" key={c.contact_id} className={styles.result+(choice?.contact_id===c.contact_id?" "+styles.selected:"")} onClick={()=>setChoice(c)}><strong>{c.customer_name||c.email||c.phone}</strong><span>{[c.email,c.phone].filter(Boolean).join(" · ")}</span></button>)}</div>
   {choice?<div className={styles.confirm}><strong>Confirm this is the same customer?</strong><p>Social messages will be linked to <b>{choice.customer_name||choice.email||choice.phone}</b>.</p><button className={styles.confirmButton} disabled={busy} onClick={()=>void confirm()}>Confirm & link history</button></div>:null}
   {error?<p className={styles.error} role="alert">{error}</p>:null}
  </section>:null}
 </div>;

}
