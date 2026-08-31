import { cookies } from "next/headers";
import TeamSidebar from "../TeamSidebar";
import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import TourDispatchTable, { type TourDispatchRow } from "./TourDispatchTable";
import { PrintAllVehicleTagsButton } from "./NativePrintButton";
import shellStyles from "../readiness/ReadinessShell.module.css";
import styles from "./TourDispatch.module.css";

function mountainDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default async function TourDispatchPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);

  const params = new URLSearchParams({
    select: "store_visit_id,readiness_id,confirmation_code,customer_name,product_display_name,visit_start_time,total_vehicle_count,vehicle_slot,vehicle_label,checkout_mileage,checkout_engine_hours,checkout_status,checkin_status",
    visit_date: `eq.${mountainDateString()}`,
    order: "visit_start_time.asc,customer_name.asc,vehicle_slot.asc",
    limit: "200",
  });

  let rows: TourDispatchRow[] = [];
  let error = "";
  try {
    rows = await supabaseSelect<TourDispatchRow>("tour_vehicle_dispatch_roster_v", params);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load today's tours.";
  }

  const printCards = rows.map((row) => ({
    customer_name: row.customer_name,
    product_display_name: row.product_display_name,
    visit_start_time: row.visit_start_time,
    confirmation_code: row.confirmation_code,
  }));

  return (
    <div className={shellStyles.page}>
      <TeamSidebar active="Tour Dispatch" />
      <main className={shellStyles.main}>
        <header className={shellStyles.topbar}>
          <div className={shellStyles.titleBlock}><h1>Tour Dispatch</h1><HeaderClock /></div>
          <div className={shellStyles.headerActions}>
            {profile ? <span>{profile.display_name}</span> : null}
            <LogoutButton />
          </div>
        </header>
        <section className={styles.content}>
          <div className={styles.introRow}>
            <div className={styles.intro}>Today’s guest-driven MPWR tour vehicles. Enter the assigned car number, starting mileage, and engine hours to prepare the vehicle checkout.</div>
            {!error && rows.length ? <div className={styles.printAllWrap}><PrintAllVehicleTagsButton className={styles.printAllButton} cards={printCards} /></div> : null}
          </div>
          {error ? <div className={shellStyles.error}>{error}</div> : <TourDispatchTable rows={rows} />}
        </section>
      </main>
    </div>
  );
}
