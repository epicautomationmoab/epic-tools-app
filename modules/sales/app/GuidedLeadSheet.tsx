"use client";
import {useEffect,useState} from "react";
export default function GuidedLeadSheet({phone,name,onClose,draftId}:{phone:string;name:string;onClose:()=>void;draftId?:string}){
 const key="lead-sheet:"+(draftId||phone||"manual");
 const [serverId,setServerId]=useState<string|null>(null);
 const [saveStatus,setSaveStatus]=useState("Start entering details");
 const [touched,setTouched]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [matchedCustomer,setMatchedCustomer]=useState<{id:string;display_name:string|null;tripworks_customer_id:number|null}|null>(null);
 const [matchPending,setMatchPending]=useState(false);
 const [matchError,setMatchError]=useState(false);
 const [data,setData]=useState<Record<string,any>>({phone,name});
 useEffect(()=>{let active=true;(async()=>{try{if(draftId&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(draftId)){const r=await fetch("/api/sales/lead-sheets?id="+encodeURIComponent(draftId),{cache:"no-store"});const p=await r.json();if(r.ok&&p.rows?.[0]&&active){setData(p.rows[0].fields);setServerId(draftId);setSaveStatus(p.rows[0].status==="saved"?"Saved Lead Sheet loaded":"Draft loaded");setLoaded(true);return;}}const stored=localStorage.getItem(key);if(stored)setData(prev=>({...prev,...JSON.parse(stored)}));setServerId(localStorage.getItem(key+":server-id"));}catch{}if(active)setLoaded(true);})();return()=>{active=false};},[key,draftId]);
 useEffect(()=>{if(!loaded)return;try{localStorage.setItem(key,JSON.stringify(data));}catch{}},[data,key,loaded]);
 useEffect(()=>{
  if(!loaded)return;
  let active=true;
  setMatchedCustomer(null);
  setMatchError(false);
  const digits=String(data.phone||"").replace(/\D/g,"");
  if(!(digits.length===10||(digits.length===11&&digits.startsWith("1")))){setMatchPending(false);return;}
  setMatchPending(true);
  const timer=setTimeout(async()=>{try{const response=await fetch("/api/sales/lead-sheets?match_phone="+encodeURIComponent(String(data.phone||"")),{cache:"no-store"});const body=await response.json();if(active){setMatchedCustomer(response.ok&&!body.ambiguous?body.match||null:null);setMatchError(!response.ok); }}catch{if(active){setMatchedCustomer(null);setMatchError(true);}}finally{if(active)setMatchPending(false);}},350);
  return()=>{active=false;clearTimeout(timer)};
 },[data.phone,loaded]);
 useEffect(()=>{if(!loaded||!touched)return;const timer=setTimeout(async()=>{setSaveStatus("Saving draft…");try{const res=await fetch("/api/sales/lead-sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:serverId,fields:data})});const result=await res.json();if(!res.ok||!result.rows?.[0]?.id)throw Error(result.error||"Save returned no record");setServerId(result.rows[0].id);try{localStorage.setItem(key+":server-id",result.rows[0].id);}catch{}setSaveStatus("Draft autosaved");}catch(e){setSaveStatus("C360 autosave failed: "+(e instanceof Error?e.message:"Network error"));}},1200);return()=>clearTimeout(timer);},[data,loaded,touched]);
 const [savingFinal,setSavingFinal]=useState(false);
 const [finalMessage,setFinalMessage]=useState("");
 async function saveFinal(openCustomer:boolean){
  const rawPhone=String(data.phone||"").trim();
  const digits=rawPhone.replace(/\D/g,"");
  if(rawPhone && !(digits.length===10 || (digits.length===11&&digits.startsWith("1")))){setFinalMessage("Phone number must contain 10 digits, or be left blank. Please check the customer name and phone fields.");return;}
  setSavingFinal(true);setFinalMessage("");
  try{
   const response=await fetch("/api/sales/lead-sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:serverId,fields:data,finalize:true})});
   const payload=await response.json();
   if(!response.ok||!payload.rows?.[0]?.id)throw Error(payload.error||"Couldn't save this Lead Sheet.");
   const id=payload.rows[0].id;setServerId(id);
   try{localStorage.setItem(key+":server-id",id);}catch{}
   setSaveStatus(payload.opportunityStatus==="claimed"?"Sales Opportunity claimed":payload.contactId?"Saved to customer C360":"Lead Sheet saved — customer not yet linked");setFinalMessage(payload.opportunityStatus==="claimed"?"Saved to C360 and claimed in Sales Opportunities.":payload.opportunityStatus==="already_claimed"?"Saved to C360. Existing Sales Opportunity remains claimed by its current representative.":payload.opportunityStatus==="needs_contact"?"Lead Sheet saved. Add a phone number or email to create a Sales Opportunity.":payload.contactId?"Saved and linked to customer C360.":"Lead Sheet saved.");
   if(openCustomer&&payload.contactId){window.location.href="/sales/customers?q="+encodeURIComponent(String(data.phone||""))+"&open=1";}else if(!openCustomer){onClose();}
  }catch(e){setFinalMessage(e instanceof Error?e.message:"Unable to save.");}
  finally{setSavingFinal(false);}
 }
 const set=(k:string,v:any)=>{setTouched(true);setData(d=>({...d,[k]:v}));};

 const field:React.CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #cbd5e1",borderRadius:9,padding:"11px 12px",fontSize:14,background:"#fff",color:"#17202b",marginTop:6};
 const label:React.CSSProperties={fontSize:12,fontWeight:800,color:"#485467",display:"block",marginBottom:12};
 const card:React.CSSProperties={background:"#fff",border:"1px solid #e3e7ed",borderRadius:14,padding:18,marginBottom:15,boxShadow:"0 1px 3px #13203a0a"};
 const input=(title:string,k:string,type="text")=><label style={label}>{title}<input type={type} style={field} value={data[k]||""} onChange={e=>set(k,e.target.value)}/></label>;
 const notes=(title:string,k:string)=><label style={label}>{title}<textarea style={{...field,minHeight:76,resize:"vertical"}} value={data[k]||""} onChange={e=>set(k,e.target.value)}/></label>;
 const check=(title:string,k:string)=><label key={k} style={{display:"flex",alignItems:"center",gap:9,border: data[k]?"1px solid #d71920":"1px solid #e0e4e9",borderRadius:9,background:data[k]?"#fff3f3":"#fafbfd",padding:"10px 12px",fontSize:13,fontWeight:data[k]?750:550,cursor:"pointer"}}><input type="checkbox" checked={!!data[k]} onChange={e=>set(k,e.target.checked)} style={{accentColor:"#d71920",width:16,height:16,flexShrink:0}}/>{title}</label>;
 const grid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:10};
 const section=(step:string,title:string,hint:string)=><div style={{display:"flex",alignItems:"start",gap:10,marginBottom:14}}><span style={{background:"#191f2b",color:"white",borderRadius:8,width:29,height:29,display:"grid",placeItems:"center",fontWeight:900,fontSize:12,flexShrink:0}}>{step}</span><div><h3 style={{fontSize:17,margin:0,color:"#1a2331"}}>{title}</h3><p style={{fontSize:12,color:"#697789",margin:"4px 0 0"}}>{hint}</p></div></div>;
 const activities=["","Gateway to Hell’s Revenge","Hell’s Revenge","Poison Spider Mesa","Moab Discovery","Pro R Ultimate","Private Pro Xperience","Private Tours","RZR Rental","Undecided"];
 const priorities=["Scenery / sightseeing","Excitement / adrenaline","Driving themselves","Comfort / enclosed vehicle","Family-friendly experience","First-time off-roading","Technical trails / challenge","Flexible schedule / independence","Budget / value","Other"];
 const objections:[string,string][]=[["Price / value","Is it overall budget or comparing what's included?"],["Activity choice","Ask what kind of experience they imagine."],["Safety / difficulty","What specifically concerns the driver or passenger?"],["Dates / timing","Are dates fixed or flexible?"],["Group deciding","Who else is weighing in?"],["Researching","What would help them make a decision?"],["Comparing companies","What matters most in their comparison?"],["Other","Capture their actual concern."]];
 return <div role="dialog" aria-modal="true" aria-label="Guided lead sheet" style={{position:"fixed",inset:0,zIndex:12000,background:"#10182699",display:"flex",justifyContent:"flex-end"}}>
 <section style={{background:"#f3f5f8",color:"#202936",width:"min(720px,100vw)",height:"100%",overflowY:"auto",boxSizing:"border-box",boxShadow:"-10px 0 40px #0003"}}>
 <div style={{position:"sticky",top:0,zIndex:1,background:"#131b28",color:"#fff",padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
 <div><div style={{fontSize:10,letterSpacing:1.7,fontWeight:900,color:"#ff7774"}}>EPIC C360 / SALES DISCOVERY</div><h2 style={{fontSize:22,margin:"5px 0 2px"}}>Guided Lead Sheet</h2><div style={{fontSize:11,color:"#ccd5df",marginTop:5}}>{saveStatus}</div>{matchedCustomer?<div style={{fontSize:12,color:"#b7f3c5",fontWeight:800,marginTop:5}}>✅ Known customer: {matchedCustomer.display_name||"C360 customer"} · {matchedCustomer.tripworks_customer_id?"TW #"+matchedCustomer.tripworks_customer_id:"C360 #"+matchedCustomer.id.slice(0,8)}</div>:matchPending?<div style={{fontSize:11,color:"#ccd5df",marginTop:5}}>Checking C360 customer match…</div>:matchError?<div style={{fontSize:11,color:"#ffb4ab",marginTop:5}}>Customer lookup unavailable — match not verified</div>:null}</div>
 <button onClick={onClose} type="button" style={{border:"1px solid #5c6778",borderRadius:9,background:"#293343",color:"#fff",padding:"9px 13px",fontWeight:700,cursor:"pointer"}}>Close ✕</button></div>
 <div style={{padding:"19px 18px 34px"}}>
 <div style={card}>{section("01","Guest identity","Prefilled when available. Confirm details conversationally.")}<div style={grid}>{input("Name","name")}{input("Phone","phone")}{input("Email","email","email")}</div>{check("Confirmed name with guest","confirmed")}</div>
 <div style={card}>{section("02","Discover their adventure","Both tours and rentals can apply. Nothing is required.")}<div style={grid}>{check("Tour prospect","tour")}{check("Rental prospect","rental")}</div><div style={{...grid,marginTop:13}}>{input("Travel from","arrival","date")}{input("Travel to","departure","date")}</div>
 <label style={label}>Activity of interest<select style={field} value={data.activity||""} onChange={e=>set("activity",e.target.value)}>{activities.map(a=><option key={a} value={a}>{a||"Not discussed yet"}</option>)}</select></label>{input("Party size","party")}
 <div style={{margin:"16px 0 10px"}}><strong style={{fontSize:14}}>What matters to the guest?</strong><p style={{fontSize:12,color:"#697789",margin:"4px 0"}}>Ask what would make the experience memorable. Select all that apply.</p></div><div style={grid}>{priorities.map(a=>check(a,"wants:"+a))}</div><div style={{marginTop:13}}>{notes("Additional preferences or details","interests")}</div>
 <a href="/sales/quote" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",marginTop:4,background:"#d71920",color:"#fff",padding:"11px 15px",borderRadius:9,fontSize:13,fontWeight:800,textDecoration:"none"}}>Open Quote Builder ↗</a></div>
 <div style={card}>{section("03","Concerns & objections","Select an objection to see a helpful discovery question.")}<div style={grid}>{objections.map(([a,h])=><div key={a}>{check(a,"objection:"+a)}{data["objection:"+a]&&<p style={{fontSize:12,color:"#6f4a28",background:"#fff9ed",padding:10,borderRadius:7,margin:"5px 0 9px"}}>💡 {h}</p>}</div>)}</div><div style={{marginTop:13}}>{notes("Conversation notes","notes")}</div></div>
 <div style={card}>{section("04","Actions & next steps","Record everything done, then select one main disposition.")}<div style={grid}>{["Quote sent","Information sent","Follow-up scheduled","Guest will call back"].map(a=>check(a,"action:"+a))}</div>
 <label style={{...label,marginTop:15}}>Primary disposition<select style={field} value={data.disposition||""} onChange={e=>set("disposition",e.target.value)}>{["","Booked","Quote / information","Follow-up needed","Researching","Lost","Not a sales lead"].map(a=><option key={a} value={a}>{a||"Not decided yet"}</option>)}</select></label>{notes("Next action / promise","next")}{input("Follow-up date","followup","date")}</div>
 <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}><button type="button" disabled={savingFinal} onClick={()=>void saveFinal(false)} style={{padding:"12px 16px",border:0,borderRadius:9,background:"#d71920",color:"white",fontWeight:800,cursor:"pointer"}}>{savingFinal?"Saving...":"Save Lead Sheet"}</button><button type="button" disabled={savingFinal} onClick={()=>void saveFinal(true)} style={{padding:"12px 16px",border:"1px solid #aeb7c4",borderRadius:9,background:"#fff",fontWeight:800,cursor:"pointer"}}>Save & Open C360</button></div>{finalMessage&&<p role="status" style={{fontSize:12,color:"#475569"}}>{finalMessage}</p>}<p style={{fontSize:11,color:"#6c7786",textAlign:"center",margin:"12px 0"}}>All fields optional · {saveStatus}</p></div></section></div>;
}