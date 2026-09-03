import { cookies } from "next/headers";
import TeamSidebar from "../TeamSidebar";
import AutoRefresh from "../readiness/AutoRefresh";
import HeaderClock from "../readiness/HeaderClock";
import LastSynced from "../readiness/LastSynced";
import LogoutButton from "../readiness/LogoutButton";
import DepositsOnHoldPanel from "./DepositsOnHoldPanel";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import styles from "../readiness/ReadinessShell.module.css";

function getSupabaseAdminConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase admin configuration is missing.");
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: url.replace(/\/+$/, ""), key };
}

async function loadDeposits() {
  const { url, key } = getSupabaseAdminConfig();
  const response = await fetch(`${url}/rest/v1/rpc/list_rental_damage_deposits_active`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error((await response.text()) || "Unable to load deposits.");
  return response.json();
}

export default async function DepositsOnHoldPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);

  let rows = [];
  let error = "";
  try {
    const result = await loadDeposits();
    rows = Array.isArray(result) ? result : [];
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load deposits.";
  }

  const canOverrideHold = profile?.role === "manager" || profile?.role === "admin";

  return (
    <div className={styles.page}>
      <AutoRefresh />
      <TeamSidebar active="Deposits On-Hold" />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Deposits On-Hold</h1>
            <HeaderClock />
          </div>
          <div className={styles.headerActions}>
            <div className={styles.sync}><LastSynced /></div>
            <LogoutButton />
          </div>
        </header>

        <section className={styles.content}>
          <div style={{ marginBottom: 14, color: "#667085", fontWeight: 700 }}>
            Daily MPWR deposit queue. Release deposits when they are due. Deposits marked <strong>Do Not Release</strong> stay blocked unless a Manager or Admin overrides the hold.
          </div>
          {error ? <div className={styles.error}>{error}</div> : null}
          <DepositsOnHoldPanel initialRows={rows} canOverrideHold={canOverrideHold} />
        </section>
      </main>
    </div>
  );
}
