"use client";

import { FormEvent, useEffect, useState } from "react";

type Reward = {
  id:string; slug:string; category:string; display_name:string; image_status:"placeholder"|"ready"; image_url:string|null;
  redemption_type:string; amount_type:"fixed"|"custom"; allowed_amounts_cents:number[]; min_amount_cents:number; max_amount_cents:number|null;
  fee_cents:number; fee_note:string|null; active:boolean; sort_order:number;
};

const field:React.CSSProperties={width:"100%",height:40,border:"1px solid #cfd5dc",borderRadius:8,padding:"0 10px",boxSizing:"border-box",background:"white"};
const label:React.CSSProperties={display:"grid",gap:6,fontSize:12,fontWeight:800,color:"#39414b"};
const money=(c:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((c||0)/100);
const categoryOptions=["Moab & Local","Moab Dining","Outdoor & Local Retail","Travel & Lodging","National Brands","Cash & Digital","Open Loop Cards"];

const blank={slug:"",category:"Moab & Local",display_name:"",image_status:"placeholder",image_url:"",redemption_type:"gift_card",amount_type:"fixed",denominations:"25,50,100",min_amount:"10",max_amount:"",fee:"0",fee_note:"",active:true,sort_order:"100"};

export default function RewardCatalogClient(){
  const [rows,setRows]=useState<Reward[]>([]); const [form,setForm]=useState(blank); const [editingId,setEditingId]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("");
  async function load(){const r=await fetch("/api/team/reward-catalog",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error(p.error||"Unable to load reward catalog.");setRows(p.rewards||[]);}
  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Unable to load reward catalog."));},[]);
  function change(name:string,value:any){setForm((f)=>({...f,[name]:value}));}
  function reset(){setForm(blank);setEditingId("");setError("");setMessage("");}
  function edit(row:Reward){setEditingId(row.id);setForm({slug:row.slug,category:row.category,display_name:row.display_name,image_status:row.image_status,image_url:row.image_url||"",redemption_type:row.redemption_type,amount_type:row.amount_type,denominations:(row.allowed_amounts_cents||[]).map(v=>String(v/100)).join(","),min_amount:String((row.min_amount_cents||0)/100),max_amount:row.max_amount_cents?String(row.max_amount_cents/100):"",fee:String((row.fee_cents||0)/100),fee_note:row.fee_note||"",active:row.active,sort_order:String(row.sort_order||100)});window.scrollTo({top:0,behavior:"smooth"});}
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");try{const denominations=form.denominations.split(",").map(v=>Math.round(Number(v.trim())*100)).filter(v=>Number.isFinite(v)&&v>0);const payload={id:editingId||undefined,slug:form.slug,category:form.category,display_name:form.display_name,image_status:form.image_status,image_url:form.image_url,redemption_type:form.redemption_type,amount_type:form.amount_type,allowed_amounts_cents:denominations,min_amount_cents:Math.round(Number(form.min_amount||0)*100),max_amount_cents:form.max_amount?Math.round(Number(form.max_amount)*100):null,fee_cents:Math.round(Number(form.fee||0)*100),fee_note:form.fee_note,active:form.active,sort_order:Number(form.sort_order)||100};const r=await fetch("/api/team/reward-catalog",{method:editingId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const p=await r.json();if(!r.ok)throw new Error(p.error||"Unable to save reward.");setMessage(editingId?"Reward updated.":"Reward added.");setForm(blank);setEditingId("");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to save reward.");}finally{setBusy(false);}}

  return <section style={{background:"white",border:"1px solid #dfe4ea",borderRadius:12,padding:20}}>
    <h2 style={{margin:0,fontSize:20}}>Rewards Catalog</h2><p style={{margin:"6px 0 18px",color:"#68717d",fontSize:13}}>Add and edit the prizes Ambassadors can choose on the Redeem page. Changes appear automatically in the Ambassador portal.</p>
    <form onSubmit={save} style={{display:"grid",gap:14,background:"#f8f9fb",border:"1px solid #e5e9ee",borderRadius:10,padding:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.3fr 1fr 1fr",gap:12}}>
        <label style={label}>Category<select style={field} value={form.category} onChange={e=>change("category",e.target.value)}>{categoryOptions.map(c=><option key={c}>{c}</option>)}</select></label>
        <label style={label}>Display Name<input style={field} value={form.display_name} onChange={e=>change("display_name",e.target.value)} required /></label>
        <label style={label}>Reward Code<input style={field} value={form.slug} onChange={e=>change("slug",e.target.value)} placeholder="gearheads" required /></label>
        <label style={label}>Image Status<select style={field} value={form.image_status} onChange={e=>change("image_status",e.target.value)}><option value="placeholder">Placeholder</option><option value="ready">Ready</option></select></label>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",gap:12}}>
        <label style={label}>Image URL<input style={field} value={form.image_url} onChange={e=>change("image_url",e.target.value)} placeholder="https://..." /></label>
        <label style={label}>Redemption Type<select style={field} value={form.redemption_type} onChange={e=>change("redemption_type",e.target.value)}><option value="gift_card">Gift Card</option><option value="prepaid_card">Prepaid Card</option><option value="venmo">Venmo</option><option value="paypal">PayPal</option><option value="check">Mailed Check</option></select></label>
        <label style={label}>Amount Type<select style={field} value={form.amount_type} onChange={e=>change("amount_type",e.target.value)}><option value="fixed">Fixed Denominations</option><option value="custom">Custom Amount</option></select></label>
        <label style={label}>Sort Order<input style={field} type="number" value={form.sort_order} onChange={e=>change("sort_order",e.target.value)} /></label>
      </div>
      {form.amount_type==="fixed"?<label style={label}>Allowed Amounts (dollars, comma separated)<input style={field} value={form.denominations} onChange={e=>change("denominations",e.target.value)} placeholder="10,25,50,100" /></label>:<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label style={label}>Minimum Amount ($)<input style={field} type="number" min="0" step="1" value={form.min_amount} onChange={e=>change("min_amount",e.target.value)} /></label><label style={label}>Maximum Amount ($, optional)<input style={field} type="number" min="0" step="1" value={form.max_amount} onChange={e=>change("max_amount",e.target.value)} /></label></div>}
      <div style={{display:"grid",gridTemplateColumns:"180px 1fr 180px",gap:12}}><label style={label}>Fee ($)<input style={field} type="number" min="0" step="0.01" value={form.fee} onChange={e=>change("fee",e.target.value)} /></label><label style={label}>Fee Note<input style={field} value={form.fee_note} onChange={e=>change("fee_note",e.target.value)} placeholder="Fees apply and are deducted from redeemable rewards balance." /></label><label style={{...label,alignContent:"end"}}><span>Availability</span><span style={{height:40,display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={form.active} onChange={e=>change("active",e.target.checked)} /> Active</span></label></div>
      <div style={{display:"flex",gap:10}}><button disabled={busy} style={{border:0,borderRadius:8,background:"#d5521d",color:"white",padding:"10px 16px",fontWeight:900}}>{busy?"Saving…":editingId?"Save Changes":"Add Reward"}</button>{editingId?<button type="button" onClick={reset} style={{border:"1px solid #cfd5dc",borderRadius:8,background:"white",padding:"10px 16px",fontWeight:800}}>Cancel Edit</button>:null}</div>
      {error?<div style={{color:"#b42318",fontWeight:700}}>{error}</div>:null}{message?<div style={{color:"#18794e",fontWeight:700}}>{message}</div>:null}
    </form>

    <div style={{marginTop:18,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:"#f7f8fa",textAlign:"left"}}>{["Reward","Category","Image","Type","Amount","Fee","Status",""].map(h=><th key={h} style={{padding:"10px 12px",color:"#68717d"}}>{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} style={{borderTop:"1px solid #edf0f3"}}><td style={{padding:"11px 12px",fontWeight:800}}>{row.display_name}</td><td style={{padding:"11px 12px"}}>{row.category}</td><td style={{padding:"11px 12px"}}>{row.image_status==="ready"?"Ready":"Placeholder"}</td><td style={{padding:"11px 12px"}}>{titleCase(row.redemption_type)}</td><td style={{padding:"11px 12px"}}>{row.amount_type==="fixed"?(row.allowed_amounts_cents||[]).map(money).join(", "):"Custom"}</td><td style={{padding:"11px 12px"}}>{row.fee_cents?money(row.fee_cents):"—"}</td><td style={{padding:"11px 12px",fontWeight:700}}>{row.active?"Active":"Inactive"}</td><td style={{padding:"11px 12px"}}><button onClick={()=>edit(row)} style={{border:"1px solid #cfd5dc",borderRadius:7,background:"white",padding:"7px 10px",fontWeight:800,cursor:"pointer"}}>Edit</button></td></tr>)}</tbody></table></div>
  </section>;
}

function titleCase(v:string){return v.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());}
