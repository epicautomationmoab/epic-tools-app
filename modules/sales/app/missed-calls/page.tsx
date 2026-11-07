import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedTeamProfile } from "../../lib/team-auth";
import EpicC360Sidebar from "../EpicC360Sidebar";
import MissedCallsClient, { type MissedCallItem } from "./MissedCallsClient";
import styles from "./MissedCalls.module.css";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function loadItems(accessToken: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_epic_sales_missed_calls`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json();
  return Array.isArray(payload) ? payload as MissedCallItem[] : [];
}

export default async function MissedCallsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !accessToken || profile.role === "workstation") redirect("/uui-login");

  let items: MissedCallItem[] = [];
  let error = "";
  try { items = await loadItems(accessToken); }
  catch (err) { error = err instanceof Error ? err.message : "Unable to load missed calls."; }

  return (
    <main className={styles.shell}>
      <EpicC360Sidebar
        active="missed-calls"
        profileName={profile.display_name}
        className={styles.sidebar}
        navClassName={styles.nav}
        activeClassName={styles.active}
        footerClassName={styles.sidebarFooter}
      />
      <section className={styles.main}>
        <header className={styles.header}>
          <div><div className={styles.eyebrow}>EpicC360 · Attention Queue</div><h1>Missed Calls</h1><p>Calls that still need a human follow-up decision.</p></div>
          <a className={styles.quoteButton} href="/sales/quote">+ Build Quote</a>
        </header>
        {error ? <div className={styles.error}>{error}</div> : <MissedCallsClient initialItems={items} />}
      </section>
    </main>
  );
}
