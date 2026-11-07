"use client";

import { useEffect, useRef, useState } from "react";
import Customer360Modal from "../customer-360/Customer360Modal";
import styles from "./Customers.module.css";

type CustomerResult={
  identity_key:string;contact_id:string|null;reservation_id:string|null;confirmation_code:string|null;
  customer_name:string|null;email:string|null;phone:string|null;tripworks_customer_id:number|null;tripworks_customer_code:string|null;
  last_seen_at:string|null;reservation_count:number; lifetime_spend_cents:number; has_open_lead:boolean;
};

type RecentLookup = { customer: CustomerResult; openedAt: number };
const RECENT_LIMIT=8;
const RECENT_WINDOW_MS=24*60*60*1000;
function validRecent(value:unknown):RecentLookup[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  return value.filter((item):item is RecentLookup=>{
    if(!item||typeof item!=="object")return false;
    const row=item as Partial<RecentLookup>;
    const key=row.customer?.identity_key;
    if(typeof key!=="string"||!key||typeof row.openedAt!=="number"||!Number.isFinite(row.openedAt))return false;
    if(row.openedAt>Date.now()||Date.now()-row.openedAt>=RECENT_WINDOW_MS||seen.has(key))return false;
    seen.add(key);return true;
  }).sort((a,b)=>b.openedAt-a.openedAt).slice(0,RECENT_LIMIT);
}
function recentKey(userId:string){return "epicc360-recent-lookups-v1:"+userId;}

const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
function fmtDate(v:string|null){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}

export default function CustomersClient({initialQuery="",autoOpen=false,userId}:{initialQuery?:string;autoOpen?:boolean;userId:string}){
  const[query,setQuery]=useState(initialQuery);
  const autoOpened=useRef(false);
  const[results,setResults]=useState<CustomerResult[]>([]);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[selected,setSelected]=useState<CustomerResult|null>(null);
  const[recent,setRecent]=useState<RecentLookup[]>([]);
  useEffect(()=>{
    try{
      const storageKey=recentKey(userId);
      const cleaned=validRecent(JSON.parse(window.localStorage.getItem(storageKey)||"[]"));
      setRecent(cleaned);
      window.localStorage.setItem(storageKey,JSON.stringify(cleaned));
    }catch{setRecent([]);}
  },[userId]);
  function openCustomer(customer:CustomerResult){
    setSelected(customer);
    setRecent(previous=>{
      let stored=previous;
      try{stored=validRecent(JSON.parse(window.localStorage.getItem(recentKey(userId))||"[]"));}catch{}
      const next=validRecent([{customer,openedAt:Date.now()},...stored.filter(item=>item.customer.identity_key!==customer.identity_key)]);
      try{window.localStorage.setItem(recentKey(userId),JSON.stringify(next));}catch{}
      return next;
    });
  }

  useEffect(()=>{
    const q=query.trim();
    if(q.length<2){setResults([]);setLoading(false);setError("");return;}
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);setError("");
      try{
        const r=await fetch(`/api/sales/customers?q=${encodeURIComponent(q)}`,{cache:"no-store",signal:controller.signal});
        const p=await r.json();
        if(!r.ok)throw new Error(p?.error||"Unable to search customers.");
        const customers=(p.customers||[]) as CustomerResult[];
        setResults(customers);
        if(autoOpen&&!autoOpened.current&&customers.length){
          const digits=query.replace(/\D/g,"").slice(-10);
          const exact=digits?customers.find(c=>String(c.phone||"").replace(/\D/g,"").slice(-10)===digits):null;
          if(exact||customers.length===1){autoOpened.current=true;openCustomer(exact||customers[0]);}
        }
      }catch(e){if((e as Error).name!=="AbortError")setError(e instanceof Error?e.message:"Unable to search customers.");}
      finally{setLoading(false);}
    },250);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[query,autoOpen]);

  return <>
    <section className={styles.searchPanel}>
      <div className={styles.searchWrap}>
        <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, email, phone, confirmation, TripWorks ID…" />
        {loading?<span>Searching…</span>:null}
      </div>
    </section>

    {error?<div className={styles.error}>{error}</div>:null}
    {query.trim().length<2?
      <section className={styles.recentSection}>
        <div className={styles.recentHeading}><h2>My Recent Lookups</h2><span>Last 24 hours · Only you</span></div>
        {recent.length?
          <div className={styles.recentList}>{recent.map(({customer,openedAt})=><button key={customer.identity_key} className={styles.recentCard} onClick={()=>openCustomer(customer)}>
            <div><strong>{customer.customer_name||customer.email||customer.phone||"Unknown person"}</strong><span>{[customer.email,customer.phone].filter(Boolean).join(" · ")||customer.confirmation_code||"Customer history"}</span></div>
            <div className={styles.recentRight}><time>{new Date(openedAt).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}</time><span>Open →</span></div>
          </button>)}</div>:
          <div className={styles.recentEmpty}>Customers you open will appear here for 24 hours so you can return to them quickly.</div>}
      </section>:
      !loading&&!results.length?<div className={styles.empty}><strong>No match found</strong><span>Try a different name, email, phone number, or reservation confirmation.</span></div>:
      <section className={styles.results}>{results.map(c=><button key={c.identity_key} className={styles.customerCard} onClick={()=>openCustomer(c)}>
        <div className={styles.cardTop}><div><div className={styles.name}>{c.customer_name||c.email||c.phone||"Unknown person"}</div><div className={styles.contact}>{[c.email,c.phone].filter(Boolean).join(" · ")||"No contact details"}</div></div><div className={styles.lastSeen}>{fmtDate(c.last_seen_at)}</div></div>
        <div className={styles.meta}>
          {c.has_open_lead?<span className={styles.lead}>ACTIVE LEAD</span>:null}
          {c.reservation_count>0?<span>{c.reservation_count} reservation{c.reservation_count===1?"":"s"}</span>:null}
          {c.lifetime_spend_cents>0?<span>{money.format(c.lifetime_spend_cents/100)} known spend</span>:null}
          {c.confirmation_code?<span>{c.confirmation_code}</span>:null}
          {c.tripworks_customer_id?<span>TW #{c.tripworks_customer_id}</span>:null}
        </div>
        <div className={styles.open}>Open EpicC360 →</div>
      </button>)}</section>}

    {selected?<Customer360Modal open={true} onClose={()=>setSelected(null)} contactId={selected.contact_id} reservationId={selected.reservation_id} reservationConfirmation={selected.confirmation_code} phone={selected.phone} email={selected.email}/>:null}
  </>;
}
