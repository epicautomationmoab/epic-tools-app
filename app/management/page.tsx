import EpicToolsHome from "@/app/team/EpicToolsHome";
import {requireUnifiedEmployee} from "@/lib/unified-session";
import styles from "@/app/team/EpicToolsHome.module.css";
export default async function Management(){const profile=await requireUnifiedEmployee(true);return <EpicToolsHome profile={profile} title="Management & Reports"><section className={styles.grid}><a className={styles.card} href="/management/sales"><div><h2>TripWorks Sales</h2><p>Bookings and sales by date</p></div></a><a className={styles.card} href="/sales/phone-report"><div><h2>Phone Report</h2><p>Call activity and team response</p></div></a></section></EpicToolsHome>}
