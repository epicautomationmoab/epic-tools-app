"use client";
import {useEffect,useState} from "react";

type Method={id:string|null;type:"phone"|"email";value:string;primary:boolean};
const formatPhone=(v:string)=>{const digits=v.replace(/\D/g,"");return digits.length===11&&digits.startsWith("1")?`(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`:digits.length===10?`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`:v;};
const actionStyle={padding:"7px 11px",borderRadius:8,border:"1px solid #d7deea",background:"#fff",color:"#334155",fontSize:12,fontWeight:700,cursor:"pointer"} as const;
const gradientStyle={...actionStyle,border:"none",color:"#fff",background:"linear-gradient(110deg,#7c3aed,#c339a0,#f97316)"} as const;
type Props={name:string|null|undefined;phone:string|null|undefined;email:string|null|undefined;contactId:string|null|undefined};
export default function ContactIdentityEditor({name,phone,email}:Props){
 const [open,setOpen]=useState(false);
 const [methods,setMethods]=useState<Method[]>([]);
 const [linked,setLinked]=useState(false);
 const [loading,setLoading]=useState(false);
 const [status,setStatus]=useState("");
 const [type,setType]=useState<"phone"|"email">("phone");
 const [value,setValue]=useState("");
 const [editing,setEditing]=useState<Method|null>(null);
 const [formOpen,setFormOpen]=useState(false);
 async function load(){if(!phone)return;setLoading(true);setStatus("");try{
  const res=await fetch("/api/sales/customer-360/contact-methods?phone="+encodeURIComponent(phone)+"&email="+encodeURIComponent(email||""),{cache:"no-store"});
  const result=await res.json();if(!res.ok)throw new Error(result.error||"Unable to load contacts");
  setMethods(result.methods||[]);setLinked(Boolean(result.linked||result.editable));
 }catch(e){setStatus(e instanceof Error?e.message:"Unable to load contacts");}finally{setLoading(false);}}
 useEffect(()=>{if(open)void load();},[open,phone]);
 async function change(action:"add"|"remove"|"primary",methodType:"phone"|"email",methodValue:string,makePrimary=false){
  setLoading(true);setStatus("");
  try{
   const res=await fetch("/api/sales/customer-360/contact-methods",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,email,action,type:methodType,value:methodValue,make_primary:makePrimary})});
   const result=await res.json();if(!res.ok)throw new Error(result.error||"Unable to save contact change");
   setMethods(result.methods||[]);setStatus("Saved. Reopen C360 to refresh the header.");
   setEditing(null);setValue("");setFormOpen(false);
  }catch(e){setStatus(e instanceof Error?e.message:"Unable to save");}finally{setLoading(false);}
 }
 return <div style={{position:"relative",display:"inline-block"}}>
  <button type="button" onClick={()=>{setOpen(v=>!v);setFormOpen(false);setEditing(null);setValue("");}} style={{padding:"5px 9px",borderRadius:7,border:"1px solid #cbd5e1",background:"#fff",fontWeight:700,fontSize:12}}>Edit contact details</button>
  {open?<section aria-label="Customer contact details" style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:45,width:"min(450px,88vw)",maxHeight:"75vh",overflowY:"auto",padding:20,background:"white",border:"1px solid #cbd5e1",borderRadius:16,boxShadow:"0 18px 50px #0f172a2e",color:"#172033"}}>
   <div style={{fontSize:17,fontWeight:850,letterSpacing:"-.02em"}}>{name||"Customer"}</div><div style={{fontSize:12,color:"#f05a28",fontWeight:800,letterSpacing:".08em",marginTop:3}}>CONTACT DETAILS</div>
   <p style={{fontSize:12,color:"#64748b",lineHeight:1.5,margin:"10px 0 16px"}}>Edit preferred contact information or add another way to reach this customer.</p>
   {loading?<p style={{fontSize:12}}>Saving or loading…</p>:null}
   {!linked?<p style={{fontSize:12}}>Contact editing is unavailable for this record.</p>:null}
   {(["phone","email"] as const).map(t=><div key={t} style={{margin:"15px 0 19px"}}>
    <div style={{fontSize:13,fontWeight:850,marginBottom:10}}>{t==="phone"?"Phone numbers":"Email addresses"}</div>
    {methods.filter(m=>m.type===t).map(m=><div key={m.id||m.value} style={{padding:"12px",marginBottom:8,border:"1px solid #e2e8f0",borderRadius:11,background:m.primary?"#faf9ff":"#f8fafc"}}>
     <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:9,flexWrap:"wrap"}}><span style={{overflowWrap:"anywhere",fontSize:13,fontWeight:700}}>{m.type==="phone"?formatPhone(m.value):m.value}</span><span style={{fontSize:10,fontWeight:800,padding:"4px 8px",borderRadius:20,color:m.primary?"#6d28d9":"#64748b",background:m.primary?"#ede9fe":"#e2e8f0"}}>{m.primary?"PRIMARY":"ADDITIONAL"}</span></div>
     <div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}>
      {!m.primary?<button type="button" disabled={loading} style={gradientStyle} onClick={()=>void change("primary",m.type,m.value)}>Make primary</button>:null}
      <button type="button" disabled={loading} style={actionStyle} onClick={()=>{setType(m.type);setEditing(m);setValue(m.value);setFormOpen(true);}}>Edit</button>
      {!m.primary&&m.id?<button type="button" disabled={loading} style={actionStyle} onClick={()=>void change("remove",m.type,m.value)}>Remove</button>:null}
     </div>
    </div>)}
    {methods.filter(m=>m.type===t).length===0?<p style={{fontSize:12}}>No {t} on file.</p>:null}
    <button type="button" disabled={!linked||loading} onClick={()=>{setType(t);setEditing(null);setValue("");setFormOpen(true);}} style={{...actionStyle,marginTop:4,borderStyle:"dashed",color:"#6d28d9"}}>+ Add {t}</button>
    {linked&&formOpen&&type===t?<div style={{border:"1px solid #c4b5fd",borderRadius:12,padding:14,background:"#faf9ff"}}>
    <strong>{editing?"Replace preferred "+editing.type+" (preserve previous contact)":"Add "+type}</strong>
    <input aria-label="Contact value" type={type==="email"?"email":"tel"} value={value} onChange={e=>setValue(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",margin:"10px 0",border:"1px solid #cbd5e1",borderRadius:9,fontSize:13}} placeholder={type==="phone"?"Phone number":"Email address"}/>
    <div style={{display:"flex",gap:8}}>
     <button type="button" style={gradientStyle} disabled={loading||!value.trim()} onClick={async()=>{
      if(editing){await change("add",type,value,editing.primary);}
      else await change("add",type,value);
     }}>Save contact</button>
     <button type="button" style={actionStyle} onClick={()=>{setEditing(null);setValue("");setFormOpen(false);}}>Cancel</button>
    </div>
   </div>:null}
   </div>)}

   {status?<p role="status" style={{fontSize:12}}>{status}</p>:null}
   <div style={{textAlign:"right",marginTop:12}}><button type="button" style={actionStyle} onClick={()=>setOpen(false)}>Close</button></div>
  </section>:null}
 </div>;
}
