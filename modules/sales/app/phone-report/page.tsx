import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedTeamProfile } from "../../lib/team-auth";
import EpicC360Sidebar from "../EpicC360Sidebar";
import PhoneReportC360Link from "./PhoneReportC360Link";
import PhoneLeadCorrection from "./PhoneLeadCorrection";
import PhoneRangeReport from "./PhoneRangeReport";
import styles from "../missed-calls/MissedCalls.module.css";

const SUPABASE_URL=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

type Report={date?:string;summary?:Record<string,number|null>;agents?:Array<Record<string,any>>;agent_events?:Array<Record<string,any>>;outbound_events?:Array<Record<string,any>>;pauses?:Array<Record<string,any>>;missed?:Array<Record<string,any>>};

function duration(v:any){const n=Number(v);if(!Number.isFinite(n))return "—";if(n>=3600)return Math.floor(n/3600)+"h "+Math.floor((n%3600)/60)+"m";if(n>=60)return Math.floor(n/60)+"m "+Math.round(n%60)+"s";return Math.round(n)+"s";}
function time(v:any){if(!v)return "—";const d=new Date(String(v));return Number.isNaN(d.getTime())?"—":d.toLocaleTimeString("en-US",{timeZone:"America/Denver",hour:"numeric",minute:"2-digit"});}
function phone(v:any){const d=String(v||"").replace(/\D/g,"").slice(-10);return d.length===10?"("+d.slice(0,3)+") "+d.slice(3,6)+"-"+d.slice(6):String(v||"Unknown");}

async function loadReport(token:string,date?:string){
  const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/get_epic_phone_report_v5",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({p_local_date:date||null}),cache:"no-store"});
  if(!r.ok)throw new Error(await r.text());
  return await r.json() as Report;
}

export default async function PhoneReportPage({searchParams}:{searchParams:Promise<{date?:string;extension?:string;metric?:string;session?:string;period?:string;from?:string;to?:string}>}){
  const params=await searchParams;
  const store=await cookies();
  const token=store.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(token);
  if(!profile||!token||profile.role==="workstation")redirect("/uui-login");

  const period=["week","7days","30days","month","custom"].includes(params.period||"")?String(params.period):"";
  if(period)return <main className={styles.shell}><EpicC360Sidebar active="phone-report" profileName={profile.display_name} className={styles.sidebar} navClassName={styles.nav} activeClassName={styles.active} footerClassName={styles.sidebarFooter}/><section className={styles.main}><header className={styles.header}><div><div className={styles.eyebrow}>EpicC360 · Phone Operations</div><h1>Phone Report</h1></div></header><nav style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{[["Today","/sales/phone-report"],["Yesterday","/sales/phone-report?date="+new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(Date.now()-86400000))],["This Week","/sales/phone-report?period=week"],["Last 7 Days","/sales/phone-report?period=7days"],["Last 30 Days","/sales/phone-report?period=30days"],["This Month","/sales/phone-report?period=month"]].map(([label,url])=><a key={url} href={url} style={{padding:"10px 13px",borderRadius:9,background:url.endsWith("period="+period)?"#263d52":"#fff",color:url.endsWith("period="+period)?"#fff":"#263d52",textDecoration:"none",border:"1px solid #dde4ec",fontSize:12,fontWeight:800}}>{label}</a>)}</nav><form action="/sales/phone-report" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"end",marginBottom:12}}><input type="hidden" name="period" value="custom"/><label style={{fontSize:12}}>From <input type="date" name="from" required defaultValue={params.from||""} style={{display:"block",height:38,border:"1px solid #d6dde5",borderRadius:8,padding:"0 8px"}}/></label><label style={{fontSize:12}}>Through <input type="date" name="to" required defaultValue={params.to||""} style={{display:"block",height:38,border:"1px solid #d6dde5",borderRadius:8,padding:"0 8px"}}/></label><button type="submit" style={{height:38,padding:"0 13px",borderRadius:8,background:"#263d52",color:"white",border:0,fontWeight:800}}>View Custom Range</button></form><PhoneRangeReport period={period} token={token} from={params.from} to={params.to}/></section></main>;
  let report:Report={summary:{},agents:[],agent_events:[],outbound_events:[],pauses:[],missed:[]};
  let error="";
  try{report=await loadReport(token,params.date);}catch(e){error=e instanceof Error?e.message:"Unable to load report.";}
  // Manual corrections are layered over automatic classification, never changing source CallRail/PBX records.
  let overrides:Array<{call_session:string;extension:string;event_time:string;reason:string;changed_by_name:string;changed_at:string}>=[];
  try{
    const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/get_phone_sales_lead_overrides",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{}",cache:"no-store"});
    if(!r.ok)throw new Error("Unable to load lead corrections: "+await r.text());
    overrides=await r.json();
  }catch(e){error=error||String(e);}
  const overrideMap=new Map(overrides.map(o=>[o.call_session+"|"+o.extension+"|"+new Date(o.event_time).getTime(),o]));
  const resolveOverride=(e:any)=>overrideMap.get(String(e.session||"")+"|"+String(e.extension||"")+"|"+new Date(e.event_time).getTime());
  report.agent_events=(report.agent_events||[]).map((e:any)=>({
    ...e,manual_override:resolveOverride(e)||null,
    is_sales_opportunity:e.call_outcome==="booked"?true:(resolveOverride(e)?false:e.is_sales_opportunity),
    call_outcome:e.call_outcome==="booked"?"booked":(resolveOverride(e)?"not_sales_lead":e.call_outcome)
  }));
  const s=report.summary||{};
  const pauseTotals=new Map<string,{seconds:number,count:number}>();
  const selectedExtension=params.extension||"";
  const selectedMetric=params.metric||"";
  const selectedSession=params.session||"";
  const answeredEvents=(report.agent_events||[]).filter((e:any)=>String(e.extension||"")===selectedExtension&&e.disposition==="ANSWERED"&&Number(e.billsec||0)>0);
  // Keep every phone interaction visible, but count closely spaced repeat calls
  // to the same extension from the same number as one sales opportunity.
  // Only group sales inquiries; never combine calls across extensions or days.
  const salesCalls=answeredEvents.filter((e:any)=>e.is_sales_opportunity)
    .sort((a:any,b:any)=>new Date(a.event_time).getTime()-new Date(b.event_time).getTime());
  const opportunityGroups:Array<Array<any>>=[];
  const callGroup=new Map<string,Array<any>>();
  const normalizedPhone=(v:any)=>String(v||"").replace(/\D/g,"").slice(-10);
  for(const e of salesCalls){
    const number=normalizedPhone(e.caller_phone);
    const at=new Date(e.event_time).getTime();
    const existing=number.length===10?opportunityGroups.find(g=>{
      const last=g[g.length-1];
      return normalizedPhone(last.caller_phone)===number &&
        at-new Date(last.event_time).getTime()<=90*60*1000 &&
        at>=new Date(last.event_time).getTime();
    }):undefined;
    if(existing){existing.push(e);callGroup.set(String(e.session),existing);}
    else {const group=[e];opportunityGroups.push(group);callGroup.set(String(e.session),group);}
  }
  const salesOpportunities=opportunityGroups.map(g=>g.find(e=>e.call_outcome==="booked")||g[0]);
  const bookedSales=opportunityGroups.map(g=>g.find(e=>e.call_outcome==="booked")).filter(Boolean);
  const attributedRevenue=bookedSales.reduce((sum:number,e:any)=>sum+Number(e.booking_revenue_cents||0),0);
  const conversionRate=salesOpportunities.length?Math.round((bookedSales.length/salesOpportunities.length)*100):0;
  const money=(cents:any)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(cents||0)/100);
  const statusLabel=(e:any)=>e.customer_status==="new_caller"?"NEW CALLER":e.customer_status==="existing_customer"?"EXISTING CUSTOMER":e.customer_status==="returning_caller"?"RETURNING CALLER":"CALLER";
  const purposeLabel=(e:any)=>e.call_purpose==="sales_inquiry"?"Sales Inquiry":e.call_purpose==="existing_reservation"?"Reservation Service":"Other";
  const outcomeLabel=(e:any)=>e.call_outcome==="booked"?`💫 Sale ${money(e.booking_revenue_cents)}`:callGroup.get(String(e.session))?.some((other:any)=>other.call_outcome==="booked")?"Converted on return call":e.call_outcome==="existing_reservation_handled"?"Reservation Service":e.call_outcome==="no_booking_yet"?"Sales Lead":e.call_outcome==="not_sales_lead"?"Not a Sales Lead":"Other";
  const outboundPurposeLabel=(e:any)=>e.outbound_purpose==="courtesy_call"?"Courtesy Call":e.outbound_purpose==="voicemail_return"?"Returned Voicemail":e.outbound_purpose==="missed_call_recovery"?"Recovered Missed Call":e.outbound_purpose==="abandoned_cart"?"Abandoned Cart Lead":"";
  const selectedEvents=(selectedMetric==="outbound"?report.outbound_events||[]:report.agent_events||[]).filter((e:any)=>{
    if(String(e.extension||"")!==selectedExtension)return false;
    if(selectedMetric==="answered")return e.disposition==="ANSWERED"&&Number(e.billsec||0)>0;
    if(selectedMetric==="no-answer")return e.disposition==="NO ANSWER";
    if(selectedMetric==="outbound")return true;
    return false;
  });
  const outboundCalls=(report.outbound_events||[]).filter((e:any)=>String(e.extension||"")===selectedExtension);
  const outboundCourtesy=outboundCalls.filter((e:any)=>e.is_courtesy_call);
  const outboundAbandoned=outboundCalls.filter((e:any)=>e.is_abandoned_cart_lead);
  const outboundRecovered=outboundCalls.filter((e:any)=>e.is_missed_call_recovery);
  const outboundSales=outboundCalls.filter((e:any)=>e.is_sale);
  const outboundRevenue=outboundSales.reduce((sum:number,e:any)=>sum+Number(e.sale_revenue_cents||0),0);
  for(const p of report.pauses||[]){const k=String(p.extension||"");const x=pauseTotals.get(k)||{seconds:0,count:0};x.seconds+=Number(p.paused_seconds||0);x.count+=1;pauseTotals.set(k,x);}

  return <main className={styles.shell}>
    <EpicC360Sidebar active="phone-report" profileName={profile.display_name} className={styles.sidebar} navClassName={styles.nav} activeClassName={styles.active} footerClassName={styles.sidebarFooter}/>
    <section className={styles.main}>
      <header className={styles.header}>
        <div><div className={styles.eyebrow}>EpicC360 · Phone Operations</div><h1>Phone Report</h1><p>Grandstream PBX performance and queue activity.</p></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{[["Today","/sales/phone-report"],["Yesterday","/sales/phone-report?date="+new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(Date.now()-86400000))],["This Week","/sales/phone-report?period=week"],["Last 7 Days","/sales/phone-report?period=7days"],["Last 30 Days","/sales/phone-report?period=30days"],["This Month","/sales/phone-report?period=month"]].map(([label,url])=><a key={url} href={url} style={{fontSize:12,padding:"9px 10px",background:"#fff",border:"1px solid #d6dde5",borderRadius:8,color:"#263d52",fontWeight:800,textDecoration:"none"}}>{label}</a>)}<form action="/sales/phone-report" style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><input type="hidden" name="period" value="custom"/><input type="date" name="from" required aria-label="Custom range start date" style={{height:40,border:"1px solid #d6dde5",borderRadius:9,padding:"0 8px"}}/><span>to</span><input type="date" name="to" required aria-label="Custom range end date" style={{height:40,border:"1px solid #d6dde5",borderRadius:9,padding:"0 8px"}}/><button className={styles.quoteButton} type="submit">View Range</button></form><form style={{display:"flex",gap:8}}><input type="date" name="date" defaultValue={String(report.date||params.date||"")} style={{height:40,border:"1px solid #d6dde5",borderRadius:9,padding:"0 10px"}}/><button className={styles.quoteButton} type="submit">View Date</button></form></div>
      </header>
      {error?<div className={styles.error}>{error}</div>:<>
        <section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:18}}>
          {[
            ["Total Calls",s.inbound_queue_calls??0],
            ["Median Answer",duration(s.median_answer_wait_seconds)],
            ["Average Answer",duration(s.avg_answer_wait_seconds)],
            ["Longest Wait",duration(s.longest_answer_wait_seconds)]
          ].map(([label,value])=><div key={String(label)} style={{background:"#fff",border:"1px solid #dfe5eb",borderRadius:12,padding:14}}><div style={{fontSize:10,fontWeight:900,color:"#7c8793",textTransform:"uppercase"}}>{label}</div><div style={{fontSize:26,fontWeight:900,marginTop:6}}>{String(value)}</div></div>)}
        </section>

        <section style={{background:"#fff",border:"1px solid #dfe5eb",borderRadius:14,overflow:"hidden",marginBottom:16}}>
          <div style={{padding:16,borderBottom:"1px solid #e7ebef"}}><h2 style={{margin:0}}>Team Phone Activity</h2></div>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Agent","Inbound Answered","Unanswered Rings","Inbound Talk","Outbound Calls","Outbound Talk","Out of Queue"].map(h=><th key={h} style={{textAlign:"left",padding:12,fontSize:10,textTransform:"uppercase",color:"#7c8793",borderBottom:"1px solid #edf0f3"}}>{h}</th>)}</tr></thead><tbody>
            {(report.agents||[]).map((a:any)=>{const p=pauseTotals.get(String(a.extension));return <tr key={String(a.extension)}><td style={{padding:12,borderBottom:"1px solid #edf0f3"}}><strong>{a.agent_name||"Ext. "+a.extension}</strong><div style={{fontSize:11,color:"#87919b"}}>{a.extension==="106"?"Main Street · ":""}Ext. {a.extension}</div></td><td style={{padding:12}}><a href={`/sales/phone-report?date=${encodeURIComponent(String(report.date||params.date||""))}&extension=${encodeURIComponent(String(a.extension))}&metric=answered`} style={{fontWeight:900,color:"#18202b",textDecoration:"underline",textUnderlineOffset:3}}>{a.inbound_answered_calls||0}</a></td><td style={{padding:12}}><a href={`/sales/phone-report?date=${encodeURIComponent(String(report.date||params.date||""))}&extension=${encodeURIComponent(String(a.extension))}&metric=no-answer`} style={{fontWeight:900,color:"#b9471f",textDecoration:"underline",textUnderlineOffset:3}}>{a.true_no_answer_rings||0}</a></td><td style={{padding:12}}>{duration(a.inbound_talk_seconds)}</td><td style={{padding:12}}><a href={`/sales/phone-report?date=${encodeURIComponent(String(report.date||params.date||""))}&extension=${encodeURIComponent(String(a.extension))}&metric=outbound`} style={{fontWeight:900,color:"#18202b",textDecoration:"underline",textUnderlineOffset:3}}>{a.outbound_calls??a.outbound_answered_calls??0}</a></td><td style={{padding:12}}>{duration(a.outbound_talk_seconds)}</td><td style={{padding:12}}>{p?duration(p.seconds)+" · "+p.count+"x":"—"}</td></tr>})}
          </tbody></table></div>
        </section>

        {selectedExtension&&selectedMetric?<section style={{background:"#fff",border:"1px solid #dfe5eb",borderRadius:14,overflow:"hidden",marginBottom:16}}>
          <div style={{padding:16,borderBottom:"1px solid #e7ebef",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <div><h2 style={{margin:0}}>{selectedMetric==="answered"?"Answered Calls":selectedMetric==="outbound"?"Outbound Calls":"Unanswered Rings"} · Ext. {selectedExtension}</h2><div style={{fontSize:12,color:"#788290",marginTop:4}}>{selectedEvents.length} event{selectedEvents.length===1?"":"s"} for the selected date.</div></div>
            <a href={`/sales/phone-report?date=${encodeURIComponent(String(report.date||params.date||""))}`} style={{fontWeight:800,color:"#56606d"}}>Close</a>
          </div>
          {selectedMetric==="answered"?<div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,padding:"14px 16px",background:"#f8fafb",borderBottom:"1px solid #e7ebef"}}>
            {[
              ["Sales Opportunities",salesOpportunities.length],
              ["Booked",bookedSales.length],
              ["Attributed Revenue",money(attributedRevenue)],
              ["Conversion",salesOpportunities.length?conversionRate+"%":"—"]
            ].map(([label,value])=><div key={String(label)} style={{background:"#fff",border:"1px solid #e2e7ec",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:9,fontWeight:900,color:"#7c8793",textTransform:"uppercase"}}>{label}</div><div style={{fontSize:20,fontWeight:900,marginTop:4}}>{String(value)}</div></div>)}
          </div>:null}
          {selectedMetric==="outbound"?<div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,padding:"14px 16px",background:"#f8fafb",borderBottom:"1px solid #e7ebef"}}>
            {[
              ["Courtesy Calls",outboundCourtesy.length],
              ["Abandoned Cart",outboundAbandoned.length],
              ["Missed Recovered",outboundRecovered.length],
              ["Sales",outboundSales.length],
              ["Sales Revenue",money(outboundRevenue)]
            ].map(([label,value])=><div key={String(label)} style={{background:"#fff",border:"1px solid #e2e7ec",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:9,fontWeight:900,color:"#7c8793",textTransform:"uppercase"}}>{label}</div><div style={{fontSize:20,fontWeight:900,marginTop:4}}>{String(value)}</div></div>)}
          </div>:null}
          <div style={{padding:"0 16px"}}>
            {selectedEvents.length?selectedEvents.map((e:any,i:number)=><div key={String(e.session)+String(e.event_time)+i} style={{display:"grid",gridTemplateColumns:selectedMetric==="answered"||selectedMetric==="outbound"?"minmax(320px,1.5fr) 130px minmax(190px,1fr)":"220px 1fr auto",gap:16,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #edf0f3"}}>
              {selectedMetric==="outbound"?<div>
                <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}><strong style={{color:"#18202b"}}>{e.matched_customer_name||phone(e.called_phone)}</strong>{e.matched_customer_name?<span style={{fontSize:11,color:"#788290"}}>{phone(e.called_phone)}</span>:null}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
                  {e.is_courtesy_call?<span style={{fontSize:9,fontWeight:900,color:"#53606e",background:"#f2f4f6",borderRadius:999,padding:"3px 7px"}}>COURTESY CALL</span>:null}
                  {e.is_abandoned_cart_lead?<span style={{fontSize:9,fontWeight:900,color:"#a94720",background:"#fff2ed",borderRadius:999,padding:"3px 7px"}}>ABANDONED CART</span>:null}
                  {e.returned_voicemail?<span style={{fontSize:9,fontWeight:900,color:"#6b4a00",background:"#fff7da",borderRadius:999,padding:"3px 7px"}}>RETURNED VOICEMAIL</span>:e.is_missed_call_recovery?<span style={{fontSize:9,fontWeight:900,color:"#25693b",background:"#eef8f1",borderRadius:999,padding:"3px 7px"}}>RECOVERED MISSED CALL</span>:null}
                </div>
                <div style={{marginTop:5}}><PhoneReportC360Link contactId={e.contact_id||null} reservationId={e.sale_reservation_id||e.matched_reservation_id||null} reservationConfirmation={e.sale_confirmation_code||e.matched_confirmation_code||null} phone={e.called_phone||null}/>{e.sale_confirmation_code?<span style={{fontSize:11,color:"#788290",marginLeft:8}}>{e.sale_confirmation_code}</span>:e.matched_confirmation_code?<span style={{fontSize:11,color:"#788290",marginLeft:8}}>{e.matched_confirmation_code}</span>:null}</div>
              </div>:selectedMetric==="answered"?<div>
                <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}><strong style={{color:"#18202b"}}>{e.customer_name||phone(e.caller_phone)}</strong>{e.customer_name?<span style={{fontSize:11,color:"#788290"}}>{phone(e.caller_phone)}</span>:null}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}><span style={{fontSize:9,fontWeight:900,color:e.customer_status==="new_caller"?"#a94720":"#53606e",background:"#f2f4f6",borderRadius:999,padding:"3px 7px"}}>{statusLabel(e)}</span><span style={{fontSize:10,fontWeight:800,color:"#53606e"}}>{purposeLabel(e)}</span>{e.booking_experience?<span style={{fontSize:10,color:"#788290"}}>· {e.booking_experience}</span>:e.existing_experience?<span style={{fontSize:10,color:"#788290"}}>· {e.existing_experience}</span>:null}</div>
                <div style={{marginTop:5}}><PhoneReportC360Link contactId={e.contact_id||null} reservationId={e.booking_reservation_id||e.existing_reservation_id||null} reservationConfirmation={e.booking_confirmation_code||e.existing_confirmation_code||null} phone={e.caller_phone||null}/>{e.booking_confirmation_code?<span style={{fontSize:11,color:"#788290",marginLeft:8}}>{e.booking_confirmation_code}</span>:e.existing_confirmation_code?<span style={{fontSize:11,color:"#788290",marginLeft:8}}>{e.existing_confirmation_code}</span>:null}</div>
              </div>:<a href={`/sales/phone-report?date=${encodeURIComponent(String(report.date||params.date||""))}&session=${encodeURIComponent(String(e.session||""))}`} style={{fontWeight:900,color:"#18202b",textDecoration:"underline",textUnderlineOffset:3}}>{phone(e.caller_phone)}</a>}
              <span style={{color:"#56606d"}}>{time(e.event_time)}{selectedMetric==="answered"||selectedMetric==="outbound"?<div style={{fontSize:11,color:"#87919b",marginTop:2}}>{duration(e.billsec)}</div>:null}</span>
              <span style={{fontWeight:900,color:selectedMetric==="no-answer"?"#b9471f":(e.call_outcome==="booked"||e.is_sale)?"#25693b":"#56606d"}}>
                {selectedMetric==="outbound"?(e.is_sale?`💫 Sale ${money(e.sale_revenue_cents)}`:e.disposition==="ANSWERED"?outboundPurposeLabel(e):`Attempt · ${String(e.disposition||"No answer").toLowerCase()}`):selectedMetric==="answered"?outcomeLabel(e):"Unanswered ring · "+duration(e.duration_seconds)+(e.action_note==="answered elsewhere"?" · answered elsewhere":"")}
                {selectedMetric==="answered"&&e.disposition==="ANSWERED"&&e.call_outcome!=="booked"&&(e.is_sales_opportunity||e.manual_override)?<PhoneLeadCorrection session={String(e.session||"")} extension={String(e.extension||"")} eventTime={String(e.event_time||"")} override={e.manual_override} eligible={!!e.is_sales_opportunity}/>:null}
                {selectedMetric==="outbound"&&e.is_missed_call_recovery?<div style={{fontSize:10,fontWeight:700,color:"#788290",marginTop:3}}>Recovered in {duration(e.missed_call_recovery_seconds)}</div>:null}
              </span>
            </div>):<div style={{padding:18,color:"#788290"}}>No matching events.</div>}
          </div>
        </section>:null}

        {selectedSession?<section style={{background:"#fff",border:"1px solid #dfe5eb",borderRadius:14,overflow:"hidden",marginBottom:16}}>
          <div style={{padding:16,borderBottom:"1px solid #e7ebef",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <div><h2 style={{margin:0}}>Call Path</h2><div style={{fontSize:12,color:"#788290",marginTop:4}}>Every queue phone this call touched, in order.</div></div>
            <a href={`/sales/phone-report?date=${encodeURIComponent(String(report.date||params.date||""))}`} style={{fontWeight:800,color:"#56606d"}}>Close</a>
          </div>
          <div style={{padding:"0 16px"}}>
            {(report.agent_events||[]).filter((e:any)=>String(e.session||"")===selectedSession).map((e:any,i:number)=><div key={String(e.event_time)+String(e.extension)+i} style={{display:"grid",gridTemplateColumns:"110px 130px 1fr auto",gap:14,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #edf0f3"}}>
              <strong>Ext. {e.extension}</strong><span>{time(e.event_time)}</span><span>{phone(e.caller_phone)}</span><b style={{color:e.disposition==="ANSWERED"?"#25693b":"#b9471f"}}>{e.disposition==="ANSWERED"?"Answered · "+duration(e.billsec):"No answer · rang "+duration(e.duration_seconds)}</b>
            </div>)}
          </div>
        </section>:null}

        <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={{background:"#fff",border:"1px solid #dfe5eb",borderRadius:14,padding:16}}>
            <h2 style={{marginTop:0}}>Queue Timeline</h2>
            {(report.pauses||[]).length?(report.pauses||[]).map((p:any,i:number)=><div key={String(p.extension)+String(p.paused_at)+i} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,padding:"10px 0",borderBottom:"1px solid #edf0f3"}}><div><strong>{p.agent_name||"Ext. "+p.extension}</strong><div style={{fontSize:12,color:"#788290"}}>{time(p.paused_at)} OutOfQ → {time(p.resumed_at)} InQ</div></div><b>{duration(p.paused_seconds)}</b></div>):<div>No queue pauses recorded.</div>}
          </div>
          <div style={{background:"#fff",border:"1px solid #dfe5eb",borderRadius:14,padding:16}}>
            <h2 style={{marginTop:0}}>Missed Calls</h2>
            {(report.missed||[]).length?(report.missed||[]).map((m:any)=><div key={String(m.session)} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,padding:"10px 0",borderBottom:"1px solid #edf0f3"}}><div><strong>{phone(m.customer_phone)}</strong><div style={{fontSize:12,color:"#788290"}}>{time(m.started_at)} · waited {duration(m.queue_wait_seconds)} · {m.ring_attempts||0} queue rings</div>{m.voicemail_left?<div style={{fontSize:12,fontWeight:800,color:"#6b4a00",marginTop:3}}>Voicemail left{m.voicemail_transcription?" · transcription available":""}</div>:<div style={{fontSize:12,color:"#8a93a0",marginTop:3}}>No voicemail left</div>}</div></div>):<div>No missed queue calls.</div>}
          </div>
        </section>
      </>}
    </section>
  </main>;
}
