import Link from "next/link";
import TeamSidebar from "../../TeamSidebar";
import InboxTable from "./InboxTable";
import styles from "../Leads.module.css";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function getItems() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  const select = encodeURIComponent("id,contact_id,opportunity_id,source,source_record_id,work_type,status,subject,summary,assigned_profile_id,assigned_name,created_at,updated_at,metadata");
  const response = await fetch(`${url}/rest/v1/customer_work_items?status=eq.open&select=${select}&order=created_at.desc&limit=500`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export default async function SalesInboxPage() {
  let items = [];
  let loadError = "";
  try { items = await getItems(); } catch (error) { loadError = error instanceof Error ? error.message : "Unable to load Sales Inbox."; }

  return <div className={styles.shell}>
    <TeamSidebar active="Sales & Leads" />
    <main className={styles.main}>
      <header className={styles.header}>
        <div><div className={styles.eyebrow}>Epic Tools Sales</div><h1>Sales Inbox</h1><p>New customer contacts that Epic cannot yet confidently attach to an open sales opportunity.</p></div>
        <Link className={styles.back} href="/team/leads">Open Leads</Link>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <Link className={styles.tab} href="/team/leads">Open Leads</Link>
          <span className={`${styles.tab} ${styles.tabActive}`}>Inbox / Needs Review</span>
        </div>
        <div className={styles.muted}>CallRail intake · classify before promoting to a lead</div>
      </div>
      {loadError ? <div style={{padding:14,borderRadius:10,background:"#fff1ef",border:"1px solid #efb9b2",color:"#97372f",fontWeight:800}}>{loadError}</div> : <InboxTable initialItems={items} />}
    </main>
  </div>;
}
