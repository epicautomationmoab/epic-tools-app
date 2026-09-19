import TeamSidebar from "../../TeamSidebar";
import HeaderClock from "../../readiness/HeaderClock";
import LogoutButton from "../../readiness/LogoutButton";
import ServiceInboxClient from "../ServiceInboxClient";
import styles from "../../readiness/ReadinessShell.module.css";
export default function TourInboxPage(){return <div className={styles.page}><TeamSidebar active="Tour Inbox"/><main className={styles.main}><header className={styles.topbar}><div className={styles.titleBlock}><h1>Tour Inbox</h1><HeaderClock/><p>Guest conversations routed to tour service.</p></div><div className={styles.headerActions}><LogoutButton/></div></header><section className={styles.content}><ServiceInboxClient queue="tour_service" title="Tour Service"/></section></main></div>;}
