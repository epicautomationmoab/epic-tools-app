import TeamSidebar from "../TeamSidebar";
import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import TourDispatchTable, { type TourDispatchRow, type TourManifestGuide } from "./TourDispatchTable";
import { PrintAllVehicleTagsButton } from "./NativePrintButton";
import shellStyles from "../readiness/ReadinessShell.module.css";
import styles from "./TourDispatch.module.css";
import TourReturnExceptionActions from "../email-delivery/TourReturnExceptionActions";

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
  const today = mountainDateString();

  const params = new URLSearchParams({
    select: "store_visit_id,readiness_id,confirmation_code,customer_name,product_display_name,visit_start_time,visit_date,source_experience_ids,total_vehicle_count,vehicle_slot,vehicle_label,checkout_mileage,checkout_engine_hours,checkout_status,checkin_status",
    visit_date: `eq.${today}`,
    order: "visit_start_time.asc,customer_name.asc,vehicle_slot.asc",
    limit: "200",
  });

  const guideParams = new URLSearchParams({
    select: "visit_date,experience_key,visit_start_time,guide_name",
    visit_date: `eq.${today}`,
    order: "visit_start_time.asc,experience_key.asc",
    limit: "100",
  });

  let rows: TourDispatchRow[] = [];
  let outstandingReturns: TourDispatchRow[] = [];
  let guides: TourManifestGuide[] = [];
  let error = "";
  try {
    [rows, guides, outstandingReturns] = await Promise.all([
      supabaseSelect<TourDispatchRow>("tour_vehicle_dispatch_roster_v", params),
      supabaseSelect<TourManifestGuide>("tour_manifest_guides", guideParams),
      supabaseSelect<TourDispatchRow>("tour_vehicle_dispatch_roster_v", new URLSearchParams({
        select: params.get("select")!,
        visit_date: `lt.${today}`,
        checkout_status: "eq.out",
        checkin_status: "eq.checkin_queued",
        order: "visit_date.asc,customer_name.asc,vehicle_slot.asc",
        limit: "200",
      })),
    ]);
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
            <LogoutButton />
          </div>
        </header>
        <section className={styles.content}>
          {!error && outstandingReturns.length > 0 ? (
            <section aria-label="Unfinished returns from previous days" style={{ background: "#fff", border: "1px solid #e8c491", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 8px" }}>Unfinished returns from previous days</h2>
              <p>These vehicles were submitted for return, but check-in has not been confirmed. Try Again sends the existing job to Axel In.</p>
              {outstandingReturns.map((row) => (
                <div key={`${row.store_visit_id}:${row.vehicle_slot}`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: "1px solid #e7e9ec" }}>
                  <div><strong>{row.customer_name} · Vehicle {row.vehicle_label || row.vehicle_slot}</strong><div>{row.visit_date} · {row.confirmation_code}</div></div>
                  <TourReturnExceptionActions storeVisitId={row.store_visit_id} vehicleSlot={row.vehicle_slot} checkinStatus={row.checkin_status} />
                </div>
              ))}
            </section>
          ) : null}
          <div className={styles.introRow}>
            <div className={styles.intro}>Today’s MPWR tour manifest. Tours are grouped by experience and departure time, with guests alphabetized inside each manifest.</div>
            {!error && rows.length ? <div className={styles.printAllWrap}><PrintAllVehicleTagsButton className={styles.printAllButton} cards={printCards} /></div> : null}
          </div>
          {error ? <div className={shellStyles.error}>{error}</div> : <TourDispatchTable rows={rows} guides={guides} />}
        </section>
      </main>
    </div>
  );
}
