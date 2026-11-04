import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedTeamProfile } from "../../lib/team-auth";
import EpicC360Sidebar from "../EpicC360Sidebar";
import LeadsClient, { type SalesLead } from "./LeadsClient";
import styles from "./Leads.module.css";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function loadOpenLeads(accessToken: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_epic_sales_open_leads`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Unable to load Sales leads (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response.json() as Promise<{ profile: { display_name: string }; leads: SalesLead[] }>;
}

export default async function LeadsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !accessToken) redirect("/uui-login");

  let leads: SalesLead[] = [];
  let error = "";
  try { const payload = await loadOpenLeads(accessToken); leads = payload.leads || []; }
  catch (err) { error = err instanceof Error ? err.message : "Unable to load Sales leads."; }

  const openValue = leads.reduce((sum, lead) => sum + Number(lead.lead_value_cents || 0), 0);
  const claimed = leads.filter((lead) => Boolean(lead.claimed_by_name || lead.assigned_rep_name)).length;
  const unclaimed = leads.length - claimed;

  return (
    <main className={styles.shell}>
      <EpicC360Sidebar
        active="leads"
        profileName={profile.display_name}
        className={styles.sidebar}
        navClassName={styles.nav}
        activeClassName={styles.active}
        footerClassName={styles.sidebarFooter}
      />
      <section className={styles.main}>
        <header className={styles.header}><div><div className={styles.eyebrow}>EpicC360</div><h1>Sales Opportunities</h1></div><a className={styles.quoteButton} href="/sales/quote">+ Build Quote</a></header>
        <section className={styles.kpis}><div className={`${styles.kpi} ${styles.kpiPrimary}`}><span>Open Opportunity Value</span><strong>${(openValue / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div><div className={styles.kpi}><span>Sales Opportunities</span><strong>{leads.length}</strong></div><div className={styles.kpi}><span>Claimed</span><strong>{claimed}</strong></div><div className={styles.kpi}><span>Unclaimed</span><strong>{unclaimed}</strong></div></section>
        {error ? <div className={styles.error}>{error}</div> : <LeadsClient leads={leads} profileName={profile.display_name} />}
      </section>
    </main>
  );
}
