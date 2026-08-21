import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import ReadinessTable from "./ReadinessTable";
import HeaderClock from "./HeaderClock";
import AutoRefresh from "./AutoRefresh";
import AutoCancellationPopupWatcher from "./AutoCancellationPopupWatcher";
import LastSynced from "./LastSynced";
import PortalEmailEnhancer from "./PortalEmailEnhancer";
import DamageAcknowledgmentEnhancer from "./DamageAcknowledgmentEnhancer";
import OhvDrawerEnhancer from "./OhvDrawerEnhancer";
import SignedWaiverDrawerEnhancer from "./SignedWaiverDrawerEnhancer";
import LogoutButton from "./LogoutButton";
import SharedActionPinEnhancer from "./SharedActionPinEnhancer";
import AdventureAssureEnhancer from "./AdventureAssureEnhancer";
import ContactSaveEnhancer from "./ContactSaveEnhancer";
import EmailDeliveryAlert from "./EmailDeliveryAlert";
import EmailDeliveryDrawerEnhancer from "./EmailDeliveryDrawerEnhancer";
import ReservationDeepLinkEnhancer from "./ReservationDeepLinkEnhancer";
import { getReadinessRows, type ReadinessRow } from "@/lib/supabase";
import styles from "./ReadinessShell.module.css";

export default async function TeamReadinessPage() {
  let rows: ReadinessRow[] = [];
  let error = "";

  try {
    rows = await getReadinessRows();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load readiness rows.";
  }

  return (
    <div className={styles.page}>
      <AutoRefresh />
      <AutoCancellationPopupWatcher />
      <PortalEmailEnhancer />
      <DamageAcknowledgmentEnhancer />
      <EmailDeliveryDrawerEnhancer />
      <ReservationDeepLinkEnhancer />
      <OhvDrawerEnhancer />
      <SignedWaiverDrawerEnhancer rows={rows} />
      <SharedActionPinEnhancer />
      <AdventureAssureEnhancer rows={rows} />
      <ContactSaveEnhancer />

      <TeamSidebar active="Guest Readiness" />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}><h1>Guest Readiness</h1><HeaderClock /></div>
          <div className={styles.headerActions}>
            <div className={styles.sync}><LastSynced /></div>
            <Link className={styles.actionButton} href="/team/arrival-board">Arrival Board</Link>
            <Link className={`${styles.actionButton} ${styles.kioskButton}`} href="/kiosk">Kiosk</Link>
            <LogoutButton />
          </div>
        </header>

        <section className={styles.content}>
          {error ? <div className={styles.error}>{error}</div> : null}
          <EmailDeliveryAlert />
          <ReadinessTable rows={rows} />
        </section>
      </main>
    </div>
  );
}
