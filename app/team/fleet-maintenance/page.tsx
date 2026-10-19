import TeamSidebar from "../TeamSidebar";
import { getActiveTechTimeRows, getFleetVehicles } from "@/lib/fleet-maintenance";
import FleetDashboardClient from "./FleetDashboardClient";
import styles from "../readiness/ReadinessShell.module.css";

export default async function FleetMaintenancePage() {
  const [vehicles, activeTech] = await Promise.all([getFleetVehicles(), getActiveTechTimeRows()]);

  return (
    <div className={styles.page}>
      <TeamSidebar active="Fleet Maintenance" />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Fleet Maintenance</h1>
            <div style={{ color:"#7a8490", fontSize:13, marginTop:4 }}>2027 Fleet · Vehicles 1–72</div>
          </div>
        </header>

        <section className={styles.content}>
          <FleetDashboardClient initialVehicles={vehicles} activeTechRows={activeTech} />
        </section>
      </main>
    </div>
  );
}
