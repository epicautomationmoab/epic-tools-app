import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import CallAttentionRowEnhancer from "../CallAttentionRowEnhancer";
import ReadinessTable from "./ReadinessTable";
import ReadinessDateFilterEnhancer from "./ReadinessDateFilterEnhancer";
import PriorEveningPickupEnhancer from "./PriorEveningPickupEnhancer";
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
import RentalVehicleIssueEnhancer from "./RentalVehicleIssueEnhancer";
import MpwrFinancePanel from "./MpwrFinancePanel";
import JourneyPreviewOverlay from "./journey-preview/JourneyPreviewOverlay";
import { getReadinessRows, type ReadinessRow } from "@/lib/supabase";
import {
  getPriorEveningReadinessIds,
  shiftWallDateBackOneDay,
} from "@/lib/readinessPriorEvening";
import styles from "./ReadinessShell.module.css";
import "./journey-preview/preview.css";

type OperationalReadinessRow = ReadinessRow & {
  pickup_prior_evening?: boolean | null;
  original_visit_start_time?: string | null;
};

export default async function TeamReadinessPage() {
  let rows: OperationalReadinessRow[] = [];
  let error = "";
  const startedAt = Date.now();
  let loadOutcome: "success" | "error" = "success";

  try {
    const sourceRows = await getReadinessRows();
    const priorEveningIds = await getPriorEveningReadinessIds(
      sourceRows
        .map((row) => row.readiness_id)
        .filter((id): id is string => Boolean(id)),
    );

    rows = sourceRows
      .map((row): OperationalReadinessRow => {
        const isPriorEvening = Boolean(
          row.readiness_id && priorEveningIds.has(row.readiness_id),
        );

        if (!isPriorEvening) return row;

        return {
          ...row,
          pickup_prior_evening: true,
          original_visit_start_time: row.visit_start_time,
          visit_start_time: shiftWallDateBackOneDay(row.visit_start_time),
        };
      })
      .sort(
        (a, b) =>
          a.visit_start_time.localeCompare(b.visit_start_time) ||
          a.customer_name.localeCompare(b.customer_name),
      );
  } catch (err) {
    loadOutcome = "error";
    error = err instanceof Error ? err.message : "Unable to load readiness rows.";
  } finally {
    console.info(
      JSON.stringify({
        event: "guest_readiness_load_timing",
        measured_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        row_count: rows.length,
        outcome: loadOutcome,
      }),
    );
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
      <SignedWaiverDrawerEnhancer rows={rows} />
      <SharedActionPinEnhancer />
      <AdventureAssureEnhancer rows={rows} />
      <NoShowEnhancer rows={rows} />
      <RentalVehicleIssueEnhancer rows={rows} />
      <PriorEveningPickupEnhancer rows={rows} />
      <ContactSaveEnhancer />
      <StaffNotesDrawerEnhancer />
      <JourneyPreviewOverlay rows={rows} />
      <CallAttentionRowEnhancer context="readiness" />
      <ReadinessDateFilterEnhancer rows={rows} />

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
          <MpwrFinancePanel rows={rows} />
          <ReadinessTable rows={rows} />
        </section>
      </main>
    </div>
  );
}
