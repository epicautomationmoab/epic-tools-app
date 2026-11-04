import Link from "next/link";
import PhoneReportC360Link from "./PhoneReportC360Link";

type Report={date?:string;summary?:Record<string,number|null>;agents?:Array<Record<string,any>>;agent_events?:Array<Record<string,any>>;outbound_events?:Array<Record<string,any>>;missed?:Array<Record<string,any>>};
const BASE=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(new RegExp("/+$"),"");
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
const fmt=(n:number)=>new Intl.NumberFormat("en-US").format(n);
const dollars=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n/100);
const mins=(n:number)=>n>0?Math.round(n)+"s":"—";
const localDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const weekday=(date:string)=>new Date(date+"T12:00:00Z").getUTCDay();
function daysBefore(date:string,n:number){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);}
function datesFor(period:string,today:string){
  const count=period==="week"?weekday(today)+1:period==="7days"?7:period==="30days"?30:period==="month"?Number(today.slice(8)):1;
  return Array.from({length:count},(_,i)=>daysBefore(today,count-1-i));
}
async function loadDay(token:string,date:string):Promise<Report>{
  const r=await fetch(BASE+"/rest/v1/rpc/get_epic_phone_report_v5",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({p_local_date:date}),cache:"no-store"});
  if(!r.ok)throw Error("Phone report "+date+": "+(await r.text()).slice(0,250));
  return r.json();
}
function normalize(p:unknown){return String(p||"").replace(/\D/g,"").slice(-10);}
function summarize(r:Report,overrides:Set<string>){
  const events:any[]=(r.agent_events||[]).filter(e=>e.disposition==="ANSWERED"&&Number(e.billsec||0)>0).map(e=>{
    const k=String(e.session||"")+"|"+String(e.extension||"")+"|"+new Date(e.event_time).getTime();
    return {...e,is_sales_opportunity:e.call_outcome==="booked"?true:(!overrides.has(k)&&e.is_sales_opportunity)};
  });
  return events;
}
export default async function PhoneRangeReport({period,token,from,to}:{period:string;token:string;from?:string;to?:string}){
  const today=localDate();
  const valid=(value?:string)=>!!value && /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+"T12:00:00Z")) && new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value;
  const days=period==="custom"&&valid(from)&&valid(to)?Math.round((Date.parse(to+"T12:00:00Z")-Date.parse(from+"T12:00:00Z"))/86400000)+1:0;
  if(period==="custom"&&(days<1||days>31||to!>today))return <div style={{padding:20,background:"#fff",borderRadius:12}}>Choose a valid date range of 1–31 days, ending no later than today.</div>;
  const dates=period==="custom"?Array.from({length:days},(_,i)=>daysBefore(to!,days-1-i)):datesFor(period,today);
  const reports:Report[]=[];
  try {
    // Bounded fan-out avoids hammering the same reporting RPC with 30 simultaneous calls.
    for(let i=0;i<dates.length;i+=4)reports.push(...await Promise.all(dates.slice(i,i+4).map(d=>loadDay(token,d))));
  }catch(err){return <div style={{padding:22,color:"#9a3027",background:"#fff"}}>Unable to load the full reporting period: {String(err)}. No partial totals were displayed.</div>;}
  const overrides=new Set<string>();
  try {
    const r=await fetch(BASE+"/rest/v1/rpc/get_phone_sales_lead_overrides",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{}",cache:"no-store"});
    if(!r.ok)throw Error("Unable to retrieve corrections");
    for(const o of await r.json())overrides.add(String(o.call_session)+"|"+String(o.extension)+"|"+new Date(o.event_time).getTime());
  }catch {return <div style={{padding:20,background:"#fff"}}>Unable to load lead corrections. Report totals are withheld to avoid inaccurate conversion figures.</div>;}
  const agents=new Map<string,{name:string;calls:number;seconds:number;opportunities:Map<string,any[]>;revenue:number;booked:number}>();
  const daily=reports.map((r,i)=>{
    const events=summarize(r,overrides);
    let answered=0,opportunities=0,booked=0,revenue=0;
    for(const e of events){
      const ext=String(e.extension||"");
      const rep=String(e.employee_name||((r.agents||[]).find(x=>String(x.extension)===ext)?.agent_name)||"Ext. "+ext);
      const a=agents.get(rep)||{name:rep,calls:0,seconds:0,opportunities:new Map<string,any[]>(),revenue:0,booked:0};
      a.calls++;a.seconds+=Number(e.billsec||0);
      if(e.is_sales_opportunity){
        const p=normalize(e.caller_phone);
        const t=new Date(e.event_time).getTime();
        // Group repeat interactions to the same agent; never dedupe unrelated dates or representatives.
        const prefix=p.length===10?p:String(e.session||"");
        let key=prefix+"|"+dates[i];
        const list=a.opportunities.get(key)||[];
        if(list.length&&t-new Date(list[list.length-1].event_time).getTime()>90*60*1000)key+="|"+String(e.session||"");
        const group=a.opportunities.get(key)||[];
        group.push(e);a.opportunities.set(key,group);
      }
      agents.set(rep,a);
    }
    answered=events.length;
    return {date:dates[i],answered,missed:(r.missed||[]).length,events,report:r,opportunities,booked,revenue};
  });
  for(const a of agents.values()){
    a.booked=0;a.revenue=0;
    for(const g of a.opportunities.values()){
      const wins=g.filter(e=>e.call_outcome==="booked");
      if(wins.length){a.booked++;a.revenue+=Math.max(...wins.map(e=>Number(e.booking_revenue_cents||0)));}
    }
  }
  const sum=(f:(r:typeof daily[number])=>number)=>daily.reduce((n,d)=>n+f(d),0);
  const totalCalls=sum(d=>d.answered);
  const missed=sum(d=>d.missed);
  const totalOpp=[...agents.values()].reduce((s,a)=>s+a.opportunities.size,0);
  const totalBooked=[...agents.values()].reduce((s,a)=>s+a.booked,0);
  const totalRevenue=[...agents.values()].reduce((s,a)=>s+a.revenue,0);
  const secs=[...agents.values()].reduce((s,a)=>s+a.seconds,0);
  const label=period==="custom"?"Custom Range":period==="week"?"This Week":period==="7days"?"Last 7 Days":period==="30days"?"Last 30 Days":"This Month";
  const card=(title:string,value:string)=> <div style={{background:"white",border:"1px solid #e1e6eb",borderRadius:11,padding:15}}><div style={{fontSize:11,fontWeight:800,color:"#6a7684",textTransform:"uppercase"}}>{title}</div><div style={{fontWeight:900,fontSize:24,marginTop:7}}>{value}</div></div>;
  return <div style={{paddingTop:16}}>
    <div style={{marginBottom:15}}><h2 style={{margin:0}}>{label}</h2><p style={{color:"#697586",marginTop:5}}>{dates[0]} through {dates[dates.length-1]} · Moab time · {dates.length} calendar days</p></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}>
      {card("Answered Calls",fmt(totalCalls))}{card("Missed Calls",fmt(missed))}{card("Sales Opportunities",fmt(totalOpp))}{card("Booked",fmt(totalBooked))}{card("Attributed Revenue",dollars(totalRevenue))}{card("Conversion",totalOpp?Math.round(100*totalBooked/totalOpp)+"%":"—")}{card("Inbound Talk",Math.round(secs/60)+" min")}
    </div>
    <section style={{background:"white",border:"1px solid #e1e6eb",borderRadius:12,padding:18,marginBottom:16}}>
      <h3 style={{marginTop:0}}>Employee Performance</h3>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>{["Employee","Answered","Opportunities","Booked","Conversion","Revenue"].map(x=><th key={x} style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}}>{x}</th>)}</tr></thead>
        <tbody>{[...agents.entries()].sort((a,b)=>b[1].calls-a[1].calls).map(([ext,a])=><tr key={ext}>{[a.name,fmt(a.calls),fmt(a.opportunities.size),fmt(a.booked),a.opportunities.size?Math.round(100*a.booked/a.opportunities.size)+"%":"—",dollars(a.revenue)].map((value,i)=><td key={i} style={{padding:10,borderBottom:"1px solid #edf0f2"}}>{value}</td>)}</tr>)}</tbody>
      </table></div>
    </section>
    <section style={{background:"white",border:"1px solid #e1e6eb",borderRadius:12,padding:18,marginBottom:16}}>
      <h3 style={{marginTop:0}}>Daily Trend</h3>
      <div style={{display:"flex",gap:7,alignItems:"flex-end",height:136,overflowX:"auto",paddingTop:10}}>
        {daily.map(d=><Link key={d.date} title={d.date+" · "+d.answered+" answered"} href={"/sales/phone-report?date="+d.date} style={{flex:"1 0 "+(daily.length>15?"12px":"28px"),minWidth:12,textDecoration:"none",textAlign:"center"}}>
          <div style={{height:Math.max(4,105*d.answered/Math.max(1,...daily.map(x=>x.answered))),background:"#374e66",borderRadius:"4px 4px 0 0"}}/>
          {daily.length<=7?<div style={{fontSize:10,color:"#64748b",marginTop:5}}>{d.date.slice(5)}</div>:null}
        </Link>)}
      </div>
      <div style={{fontSize:12,color:"#657486",marginTop:10}}>Bar height represents answered calls. Select any bar to open its full daily report.</div>
    </section>
    {period==="week"?<section style={{background:"white",border:"1px solid #e1e6eb",borderRadius:12,padding:18}}>
      <h3 style={{marginTop:0}}>Individual Calls · This Week</h3>
      <p style={{fontSize:12,color:"#64748b"}}>All answered calls, grouped by day, with links to customer history and each full daily report.</p>
      {[...daily].reverse().map(d=><details key={d.date} open={d.date===today} style={{borderTop:"1px solid #e6eaf0",padding:"12px 0"}}>
        <summary style={{fontWeight:800,cursor:"pointer"}}>{d.date} · {d.answered} answered calls <Link href={"/sales/phone-report?date="+d.date} style={{marginLeft:10,fontSize:12}}>Full daily report</Link></summary>
        <div style={{marginTop:12}}>
          {d.events.map((e,i)=><div key={String(e.session)+i} style={{display:"grid",gridTemplateColumns:"minmax(160px,1.5fr) 100px minmax(140px,1fr)",gap:10,padding:"10px 0",borderBottom:"1px solid #edf0f3",fontSize:12,alignItems:"center"}}>
            <div><strong>{e.customer_name||normalize(e.caller_phone)||"Unknown"}</strong><div style={{color:"#64748b"}}>{normalize(e.caller_phone)} · {e.extension} · {e.employee_name||e.agent_name||""}</div><PhoneReportC360Link contactId={e.contact_id||null} reservationId={e.booking_reservation_id||e.existing_reservation_id||null} reservationConfirmation={e.booking_confirmation_code||e.existing_confirmation_code||null} phone={e.caller_phone||null}/></div>
            <div>{new Date(e.event_time).toLocaleTimeString("en-US",{timeZone:"America/Denver",hour:"numeric",minute:"2-digit"})}</div>
            <div style={{fontWeight:700}}>{e.call_outcome==="booked"?"Sale "+dollars(Number(e.booking_revenue_cents||0)):e.is_sales_opportunity?"Sales Lead":e.call_outcome==="existing_reservation_handled"?"Reservation Service":"Other"}</div>
          </div>)}{!d.events.length?<p>No answered calls.</p>:null}
        </div>
      </details>)}
    </section>:null}
  </div>;
}
