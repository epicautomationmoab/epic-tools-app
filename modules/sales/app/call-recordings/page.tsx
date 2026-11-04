import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedTeamProfile } from "../../lib/team-auth";
import EpicC360Sidebar from "../EpicC360Sidebar";
import CallRecordingsClient, { type Recording } from "./CallRecordingsClient";
import styles from "./CallRecordings.module.css";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function loadRecordings(accessToken: string) {
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_epic_sales_call_recordings`, {
    method: "POST",
    headers,
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json();
  const recordings = Array.isArray(payload) ? payload as Recording[] : [];

  try {
    const matchResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/callrail_calls?matched_reservation_id=not.is.null&select=callrail_call_id,matched_reservation_id`,
      { headers, cache: "no-store" },
    );
    if (!matchResponse.ok) return recordings;
    const matches = await matchResponse.json() as Array<{ callrail_call_id:string; matched_reservation_id:string|null }>;
    const reservationIds = [...new Set(matches.map(row=>row.matched_reservation_id).filter((id):id is string=>Boolean(id)))];
    if (!reservationIds.length) return recordings;

    const reservationResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/operational_reservations?id=in.(${reservationIds.map(encodeURIComponent).join(",")})&select=id,confirmation_code,business_line`,
      { headers, cache: "no-store" },
    );
    if (!reservationResponse.ok) return recordings;
    const reservations = await reservationResponse.json() as Array<{ id:string; confirmation_code:string|null; business_line:string|null }>;
    const byReservation = new Map(reservations.map(row=>[row.id,row]));
    const reservationIdByCall = new Map(matches.map(row=>[row.callrail_call_id,row.matched_reservation_id]));

    return recordings.map(recording=>{
      const reservationId = reservationIdByCall.get(recording.callrail_call_id) || null;
      const reservation = reservationId ? byReservation.get(reservationId) : null;
      return {
        ...recording,
        matched_reservation_id: reservationId,
        reservation_confirmation: reservation?.confirmation_code || null,
        reservation_business_line: reservation?.business_line || null,
      };
    });
  } catch {
    return recordings;
  }
}

export default async function CallRecordingsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !accessToken || profile.role === "workstation") redirect("/uui-login");

  let recordings: Recording[] = [];
  let error = "";
  try { recordings = await loadRecordings(accessToken); }
  catch (err) { error = err instanceof Error ? err.message : "Unable to load recordings."; }

  return (
    <main className={styles.shell}>
      <EpicC360Sidebar
        active="call-recordings"
        profileName={profile.display_name}
        className={styles.sidebar}
        navClassName={styles.nav}
        activeClassName={styles.active}
        footerClassName={styles.sidebarFooter}
      />
      <section className={styles.main}>
        <header className={styles.header}>
          <div><div className={styles.eyebrow}>EpicC360 · History</div><h1>Call Recordings</h1><p>Search and review recorded customer calls as part of the complete customer history.</p></div>
          <a className={styles.quoteButton} href="/sales/quote">+ Build Quote</a>
        </header>
        {error ? <div className={styles.error}>{error}</div> : <CallRecordingsClient recordings={recordings} />}
      </section>
    </main>
  );
}
