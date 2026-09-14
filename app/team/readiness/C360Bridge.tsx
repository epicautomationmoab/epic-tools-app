"use client";

import { useEffect, useRef } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import ReadinessTable from "./ReadinessTable";
import PortalEmailEnhancer from "./PortalEmailEnhancer";
import PortalQrEnhancer from "./PortalQrEnhancer";
import PortalQrRailEnhancer from "./PortalQrRailEnhancer";
import DamageAcknowledgmentEnhancer from "./DamageAcknowledgmentEnhancer";
import PostVisitReviewToggleEnhancer from "./PostVisitReviewToggleEnhancer";
import GuestPaymentVisibilityEnhancer from "./GuestPaymentVisibilityEnhancer";
import ReservationActionRailEnhancer from "./ReservationActionRailEnhancer";
import EmailDeliveryDrawerEnhancer from "./EmailDeliveryDrawerEnhancer";
import OhvDrawerEnhancer from "./OhvDrawerEnhancer";
import SignedWaiverDrawerEnhancer from "./SignedWaiverDrawerEnhancer";
import SharedActionPinEnhancer from "./SharedActionPinEnhancer";
import AdventureAssureEnhancer from "./AdventureAssureEnhancer";
import ContactSaveEnhancer from "./ContactSaveEnhancer";
import StaffNotesDrawerEnhancer from "./StaffNotesDrawerEnhancer";
import RentalVehicleIssueEnhancer from "./RentalVehicleIssueEnhancer";
import JourneyPreviewOverlay from "./journey-preview/JourneyPreviewOverlay";

type Props = {
  row: ReadinessRow;
  onClose?: () => void;
};

function buttonText(button: HTMLButtonElement) {
  return button.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export default function C360Bridge({ row, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;

    let stopped = false;
    let attempts = 0;

    function hideReadinessChrome() {
      for (const child of Array.from(root.children) as HTMLElement[]) {
        const containsDialog = Boolean(child.querySelector('[role="dialog"]'));
        child.style.display = containsDialog ? "" : "none";
      }

      const dialog = root.querySelector<HTMLElement>('[role="dialog"][aria-label$="reservation details"]');
      if (dialog) {
        openedRef.current = true;
      } else if (openedRef.current) {
        openedRef.current = false;
        onClose?.();
      }
    }

    function openReservation() {
      if (stopped) return;
      attempts += 1;

      const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"))
        .filter((button) => buttonText(button) === "All");
      for (const button of allButtons) button.click();

      window.requestAnimationFrame(() => {
        if (stopped) return;
        const target = Array.from(root.querySelectorAll<HTMLTableRowElement>("tbody tr"))
          .find((tr) => tr.textContent?.includes(row.confirmation_code));
        if (target) {
          target.click();
          hideReadinessChrome();
          return;
        }

        if (attempts < 5) window.setTimeout(openReservation, 40);
      });
    }

    const observer = new MutationObserver(hideReadinessChrome);
    observer.observe(root, { childList: true, subtree: true });
    hideReadinessChrome();
    window.requestAnimationFrame(openReservation);

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, [row.readiness_id, row.confirmation_code, onClose]);

  return (
    <>
      <PortalEmailEnhancer />
      <PortalQrEnhancer />
      <PortalQrRailEnhancer />
      <DamageAcknowledgmentEnhancer />
      <PostVisitReviewToggleEnhancer />
      <GuestPaymentVisibilityEnhancer />
      <ReservationActionRailEnhancer />
      <EmailDeliveryDrawerEnhancer />
      <OhvDrawerEnhancer />
      <SignedWaiverDrawerEnhancer rows={[row]} />
      <SharedActionPinEnhancer />
      <AdventureAssureEnhancer rows={[row]} />
      <RentalVehicleIssueEnhancer rows={[row]} />
      <ContactSaveEnhancer />
      <StaffNotesDrawerEnhancer />
      <JourneyPreviewOverlay rows={[row]} />
      <div ref={hostRef} data-c360-bridge-host>
        <ReadinessTable rows={[row]} />
      </div>
    </>
  );
}
