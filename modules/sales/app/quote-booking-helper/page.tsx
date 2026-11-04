import {cookies} from "next/headers";
import {getAuthenticatedTeamProfile} from "../../lib/team-auth";
import styles from "../staff-booking/StaffBooking.module.css";
import CopyValue from "./CopyValue";

const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});

function dateLabel(value:string|null){
  if(!value)return "—";
  const date=new Date(value+"T12:00:00");
  return Number.isNaN(date.getTime())?value:date.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});
}

function splitCustomerName(value:string){
  const pieces=value.trim().split(/\s+/).filter(Boolean);
  if(pieces.length<=1)return {first:pieces[0]||"",last:""};
  const last=pieces[pieces.length-1];
  const firstParts=pieces.slice(0,-1);
  // Some older quote contact names repeat their surname. Do not copy it into the first-name field.
  if(firstParts.length>1 && firstParts[firstParts.length-1].toLocaleLowerCase()===last.toLocaleLowerCase()) firstParts.pop();
  return {first:firstParts.join(" "),last};
}

type Ticket={name:string;quantity:number};
function selectedLabel(selected:boolean){return <span className={selected?styles.selectedProtection:styles.unselectedProtection}><span aria-hidden="true">{selected?"✅":"🚫"}</span> {selected?"Selected":"Not selected"}</span>;}

export default async function QuoteBookingHelperPage({searchParams}:{searchParams:Promise<{quote?:string;customer?:string;email?:string;phone?:string;experience?:string;date?:string;time?:string;total?:string;tickets?:string;tripsafe?:string;premier?:string;priorpickup?:string;nextdropoff?:string;twcustomer?:string}>}){
  const params=await searchParams;
  const store=await cookies();
  const token=store.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(token);
  if(!profile||!token||profile.role==="workstation"){
    return <main className={styles.shell}><section className={styles.card}>Employee login required.</section></main>;
  }

  let tickets:Ticket[]=[];
  try{
    const parsed:unknown=JSON.parse(params.tickets||"[]");
    if(Array.isArray(parsed))tickets=parsed.filter((item):item is Ticket=>item&&typeof item.name==="string"&&typeof item.quantity==="number"&&item.quantity>0);
  }catch{}
  const totalCents=Number(params.total||0);
  const customer=splitCustomerName(params.customer||"");
  const totalLabel=Number.isFinite(totalCents)?money.format(totalCents/100):"—";

  return <main className={styles.shell}><section className={styles.card}>
    <div className={styles.top}>
      <div>
        <div className={styles.eyebrow}>EpicC360 · Staff Booking</div>
        <h1>Book It</h1>
      </div>
      <div className={styles.draft}>Quote</div>
    </div>
    <div className={styles.grid}>
      <div><span>Activity / Vehicle</span><strong>{params.experience||"—"}</strong></div>
      <div><span>Date</span><strong>{dateLabel(params.date||null)}</strong></div>
      <div><span>Time</span><strong>{params.time||"—"}</strong></div>
      {tickets.map((ticket,index)=><div key={index}><span>{tickets.length===1?"Duration / Ticket":"Duration / Ticket "+(index+1)}</span><strong>{ticket.name}</strong><span className={styles.quantity}>Qty {ticket.quantity}</span></div>)}
    </div>
    <section className={styles.section}><h2>TripWorks Customer</h2>
      <a className={styles.primary} target="_blank" rel="noopener noreferrer" href={params.twcustomer? `https://epic4x4.tripworks.com/customer/${encodeURIComponent(params.twcustomer)}/trips`:"https://epic4x4.tripworks.com/trips"}>{params.twcustomer?`Open TW Customer · ${params.twcustomer}`:"Open TripWorks"}</a>
    </section>
    <section className={styles.section}><h2>Guest</h2><div className={styles.copyFields}>
      <CopyValue label="First name" value={customer.first}/>
      <CopyValue label="Last name" value={customer.last}/>
      <CopyValue label="Phone" value={params.phone||""}/>
      <CopyValue label="Email" value={params.email||""}/>
    </div></section>
    <section className={styles.section}><h2>Protection</h2>
      <div className={styles.line}><div><strong>TripSafe</strong></div>{selectedLabel(params.tripsafe==="1")}</div>
      <div className={styles.line}><div><strong>Premier AdventureAssure</strong></div>{selectedLabel(params.premier==="1")}</div>
    </section>
    {params.priorpickup!==undefined||params.nextdropoff!==undefined?<section className={styles.section}><h2>Overnight Add-ons</h2>
      <div className={styles.line}><div><strong>Prior Evening Pickup</strong></div>{selectedLabel(params.priorpickup==="1")}</div>
      <div className={styles.line}><div><strong>Next Morning Drop-off</strong></div>{selectedLabel(params.nextdropoff==="1")}</div>
    </section>:null}
    <div className={styles.total}><span>Quote Total</span><strong>{totalLabel}</strong></div>
  </section></main>;
}
