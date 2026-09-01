import Link from "next/link";
import TeamSidebar from "../../TeamSidebar";
import MissedCallsTable from "./MissedCallsTable";
import styles from "../Leads.module.css";

function requiredEnv(name:string){const value=process.env[name]?.trim();if(!value)throw new Error(`Missing required environment variable: ${name}`);return value}
async function getItems(){
  const rawUrl=requiredEnv("NEXT_PUBLIC_SUPABASE_URL"); const url=(/^https?:\/\//i.test(rawUrl)?rawUrl:`https://${rawUrl}`).replace(/\/+$/,""); const key=requiredEnv("SUPABASE_SECRET_KEY");
  const select=encodeURIComponent("id,source_record_id,work_type,status,subject,summary,assigned_profile_id,assigned_name,created_at,metadata");
  const response=await fetch(`${url}/rest/v1/customer_work_items?status=eq.open&source=eq.callrail_call&select=${select}&order=created_at.desc&limit=500`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store"});
  if(!response.ok)throw new Error(await response.text());
  const items=await response.json();
  return items.filter((item:any)=>{const m=item.metadata||{};const type=String(m.call_type||"").toLowerCase();return m.channel==="call"&&(m.answered===false||type==="missed"||type==="abandoned")});
}
export default async function MissedCallsPage(){let items:any[]=[];let loadError="";try{items=await getItems()}catch(error){loadError=error instanceof Error?error.message:"Unable to load missed calls."}
return <div className={styles.shell}><TeamSidebar active="Sales & Leads"/><main className={styles.main}><header className={styles.header}><div><div className={styles.eyebrow}>Epic Tools Sales</div><h1>Missed / Abandoned Calls</h1><p>Unmatched inbound calls that need a callback or classification.</p></div><Link className={styles.back} href="/team/leads">Open Leads</Link></header><div className={styles.toolbar}><div className={styles.tabs}><Link className={styles.tab} href="/team/leads">Open Leads</Link><span className={`${styles.tab} ${styles.tabActive}`}>Missed Calls {items.length}</span><Link className={styles.tab} href="/team/leads/inbox">Inbox / Needs Review</Link></div><div className={styles.muted}>Call back · create a lead · or archive</div></div>{loadError?<div style={{padding:14,borderRadius:10,background:"#fff1ef",border:"1px solid #efb9b2",color:"#97372f",fontWeight:800}}>{loadError}</div>:<MissedCallsTable initialItems={items}/>}</main></div>}
