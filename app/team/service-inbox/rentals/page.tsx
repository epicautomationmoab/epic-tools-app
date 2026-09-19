import TeamSidebar from "../../TeamSidebar";
import HeaderClock from "../../readiness/HeaderClock";
import LogoutButton from "../../readiness/LogoutButton";
import ServiceInboxClient from "../ServiceInboxClient";
import styles from "../../readiness/ReadinessShell.module.css";
export default function RentalInboxPage(){return <div className={styles.page}><TeamSidebar active="Rental Inbox"/><main className={styles.main}><header className={styles.topbar}><div className={styles.titleBlock}><h1>Rental Inbox</h1><HeaderClock/><p>Guest conversations routed to HQ rental service.</p></div><div className={styles.headerActions}><LogoutButton/></div></header><section className={styles.content}><ServiceInboxClient queue="rental_service" title="Rental Service"/></section></main></div>;}
