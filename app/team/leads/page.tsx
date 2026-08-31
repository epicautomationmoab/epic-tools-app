import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import LeadsTable, { type LeadDraft, type LeadNote, type LeadRow } from "./LeadsTable";
import styles from "./Leads.module.css";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseConfig() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  return { url, key };
}

function dollars(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
}

async function supabaseRest<T>(path: string): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return response.json() as Promise<T>;
}

async function getLeads() {
  const all = await supabaseRest<Array<{ id: string; status: string; captured_value_cents: number }>>(
    `sales_opportunities?select=${encodeURIComponent("id,status,captured_value_cents")}`,
  );
  const openSelect = encodeURIComponent("id,customer_name,email,phone_e164,activity_date,activity_window_start,activity_window_end,shopping_started_at,shopping_last_activity_at,lead_value_cents,draft_count,source_method,assigned_rep_name,primary_draft_trip_id,contact_id,claimed_at,claimed_by_profile_id,claimed_by_name,is_past_guest,prior_booking_count,last_prior_booking_at,tripworks_customer_code,tripworks_is_opt_in,tripworks_identity_verified_at,new_unclaimed_at");
  const open = await supabaseRest<LeadRow[]>(`sales_open_leads_enriched?select=${openSelect}`);
  open.sort((a, b) => a.activity_window_start.localeCompare(b.activity_window_start) || Number(b.lead_value_cents || 0) - Number(a.lead_value_cents || 0));

  const booked = all.filter((row) => row.status === "booked");
  const lost = all.filter((row) => row.status === "lost");
  const retired = all.filter((row) => row.status === "retired");
  const openIds = open.map((row) => row.id);
  let draftsByLead: Record<string, LeadDraft[]> = {};
  let notesByLead: Record<string, LeadNote[]> = {};

  if (openIds.length) {
    const quoted = openIds.map((id) => `"${id}"`).join(",");
    const links = await supabaseRest<Array<{ opportunity_id: string; draft_id: string }>>(`sales_opportunity_drafts?select=${encodeURIComponent("opportunity_id,draft_id")}&opportunity_id=in.(${quoted})`);
    const draftIds = [...new Set(links.map((link) => link.draft_id))];
    if (draftIds.length) {
      const draftQuoted = draftIds.map((id) => `"${id}"`).join(",");
      const drafts = await supabaseRest<LeadDraft[]>(`sales_drafts?select=${encodeURIComponent("id,tripworks_trip_id,confirmation_code,customer_name,email,phone_e164,activity_date,start_time,experience_name,option_name,value_cents,trip_method,created_by_name,tripworks_created_at,last_seen_at")}&id=in.(${draftQuoted})`);
      const draftMap = new Map(drafts.map((draft) => [draft.id, draft]));
      draftsByLead = Object.fromEntries(open.map((lead) => [lead.id, links.filter((link) => link.opportunity_id === lead.id).map((link) => draftMap.get(link.draft_id)).filter((draft): draft is LeadDraft => Boolean(draft)).sort((a, b) => Number(b.value_cents || 0) - Number(a.value_cents || 0))]));
    }
    const notes = await supabaseRest<LeadNote[]>(`sales_opportunity_notes?select=${encodeURIComponent("id,opportunity_id,author_name,note_text,created_at")}&opportunity_id=in.(${quoted})&order=created_at.desc`);
    notesByLead = Object.fromEntries(open.map((lead) => [lead.id, notes.filter((note) => note.opportunity_id === lead.id)]));
  }
  return { open, booked, lost, retired, draftsByLead, notesByLead };
}

export default async function LeadsPage() {
  let open: LeadRow[] = [];
  let booked: Array<{ captured_value_cents: number }> = [];
  let lost: Array<{ captured_value_cents: number }> = [];
  let retired: Array<{ captured_value_cents: number }> = [];
  let draftsByLead: Record<string, LeadDraft[]> = {};
  let notesByLead: Record<string, LeadNote[]> = {};
  let loadError = "";
  try {
    const loaded = await getLeads();
    open = loaded.open; booked = loaded.booked; lost = loaded.lost; retired = loaded.retired; draftsByLead = loaded.draftsByLead; notesByLead = loaded.notesByLead;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load Sales & Leads data.";
    console.error("Sales & Leads load error:", error);
  }
  const openValue = open.reduce((sum, row) => sum + Number(row.lead_value_cents || 0), 0);
  const capturedValue = booked.reduce((sum, row) => sum + Number(row.captured_value_cents || 0), 0);
  const legitimatePool = open.length + booked.length + lost.length;
  const conversion = legitimatePool ? Math.round((booked.length / legitimatePool) * 100) : 0;

  return <div className={styles.shell}>
    <TeamSidebar active="Sales & Leads" />
    <main className={styles.main}>
      <header className={styles.header}><div><div className={styles.eyebrow}>Epic Tools Sales</div><h1>Sales &amp; Leads</h1><p>Open TripWorks shopping opportunities that still belong to the sales team.</p></div><Link className={styles.back} href="/team/readiness">Guest Readiness</Link></header>
      {loadError ? <div style={{ marginBottom: 18, padding: 16, background: "#fff1ef", border: "1px solid #efc0ba", borderRadius: 12, color: "#8c2f24", fontWeight: 750 }}>Sales data could not load: {loadError}</div> : null}
      <section className={styles.kpis}>
        <div className={`${styles.kpi} ${styles.kpiPrimary}`}><div className={styles.kpiLabel}>Open Lead Value</div><div className={styles.kpiValue}>{dollars(openValue)}</div><div className={styles.kpiSub}>{open.length} active shopping episodes</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Captured Lead Value</div><div className={styles.kpiValue}>{dollars(capturedValue)}</div><div className={styles.kpiSub}>{booked.length} converted shopping episodes</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Open Leads</div><div className={styles.kpiValue}>{open.length}</div><div className={styles.kpiSub}>Future opportunities still with sales</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Lead Conversion</div><div className={styles.kpiValue}>{conversion}%</div><div className={styles.kpiSub}>{booked.length} booked of {legitimatePool} legitimate leads · {retired.length} retired excluded</div></div>
      </section>
      <div className={styles.toolbar}><div className={styles.tabs}><span className={`${styles.tab} ${styles.tabActive}`}>Open Leads {open.length}</span><Link className={styles.tab} href="/team/leads/inbox">Inbox / Needs Review</Link></div><div className={styles.muted}>30-day shopping episodes · click a lead to work it</div></div>
      {!loadError ? <LeadsTable leads={open} draftsByLead={draftsByLead} notesByLead={notesByLead} /> : null}
    </main>
  </div>;
}
