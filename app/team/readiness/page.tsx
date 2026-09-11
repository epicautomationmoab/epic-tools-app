import Link from "next/link";
import { Suspense } from "react";
import TeamSidebar from "../TeamSidebar";
import CallAttentionRowEnhancer from "../CallAttentionRowEnhancer";
import ReadinessTable from "./ReadinessTable";
import ReadinessDateFilterEnhancer from "./ReadinessDateFilterEnhancer";
import HeaderClock from "./HeaderClock";
import AutoRefresh from "./AutoRefresh";
import ReadinessRealtimeRefresh from "./ReadinessRealtimeRefresh";
import AutoCancellationPopupWatcher from "./AutoCancellationPopupWatcher";
import LastSynced from "./LastSynced";
import PortalEmailEnhancer from "./PortalEmailEnhancer";
import PortalQrEnhancer from "./PortalQrEnhancer";
import PortalQrRailEnhancer from "./PortalQrRailEnhancer";
import DamageAcknowledgmentEnhancer from "./DamageAcknowledgmentEnhancer";
import PostVisitReviewToggleEnhancer from "./PostVisitReviewToggleEnhancer";
import GuestPaymentVisibilityEnhancer from "./GuestPaymentVisibilityEnhancer";
import ReservationActionRailEnhancer from "./ReservationActionRailEnhancer";
import OhvDrawerEnhancer from "./OhvDrawerEnhancer";
import SignedWaiverDrawerEnhancer from "./SignedWaiverDrawerEnhancer";
import LogoutButton from "./LogoutButton";
import SharedActionPinEnhancer from "./SharedActionPinEnhancer";
import AdventureAssureEnhancer from "./AdventureAssureEnhancer";
import ContactSaveEnhancer from "./ContactSaveEnhancer";
import StaffNotesDrawerEnhancer from "./StaffNotesDrawerEnhancer";
import EmailDeliveryAlert from "./EmailDeliveryAlert";
import EmailDeliveryDrawerEnhancer from "./EmailDeliveryDrawerEnhancer";
import ReservationDeepLinkEnhancer from "./ReservationDeepLinkEnhancer";
import NoShowEnhancer from "./NoShowEnhancer";
import MpwrFinancePanel from "./MpwrFinancePanel";
import JourneyPreviewOverlay from "./journey-preview/JourneyPreviewOverlay";
import { getReadinessRows, type ReadinessRow } from "@/lib/supabase";
import { getTodayReadinessRows } from "@/lib/readiness-today";
import styles from "./ReadinessShell.module.css";
import "./journey-preview/preview.css";

function ReadinessData({ rows, error = "" }: { rows: ReadinessRow[]; error?: string }) {
  return (
    <>
      <SignedWaiverDrawerEnhancer rows={rows} />
      <AdventureAssureEnhancer rows={rows} />
      <NoShowEnhancer rows={rows} />
      <JourneyPreviewOverlay rows={rows} />
      <ReadinessDateFilterEnhancer rows={rows} />

      <section className={styles.content}>
        {error ? <div className={styles.error}>{error}</div> : null}
        <EmailDeliveryAlert />
        <MpwrFinancePanel rows={rows} />
        <ReadinessTable rows={rows} />
      </section>
    </>
  );
}

async function FullReadinessData() {
  try {
    const rows = await getReadinessRows();
    return <ReadinessData rows={rows} />;
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unable to load full readiness rows.";
    return <div className={styles.content}><div className={styles.error}>{error}</div></div>;
  }
}

export default async function TeamReadinessPage() {
  let todayRows: ReadinessRow[] = [];
  let todayError = "";

  try {
    todayRows = await getTodayReadinessRows();
  } catch (err) {
    todayError = err instanceof Error ? err.message : "Unable to load today's readiness rows.";
  }

  return (
    <div className={styles.page}>
      <AutoRefresh />
      <ReadinessRealtimeRefresh />
      <AutoCancellationPopupWatcher />
      <PortalEmailEnhancer />
      <PortalQrEnhancer />
      <PortalQrRailEnhancer />
      <DamageAcknowledgmentEnhancer />
      <PostVisitReviewToggleEnhancer />
      <GuestPaymentVisibilityEnhancer />
      <ReservationActionRailEnhancer />
      <EmailDeliveryDrawerEnhancer />
      <ReservationDeepLinkEnhancer />
      <OhvDrawerEnhancer />
      <SharedActionPinEnhancer />
      <ContactSaveEnhancer />
      <StaffNotesDrawerEnhancer />
      <CallAttentionRowEnhancer context="readiness" />

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

        <Suspense fallback={<ReadinessData rows={todayRows} error={todayError} />}>
          <FullReadinessData />
        </Suspense>
      </main>
    </div>
  );
}
