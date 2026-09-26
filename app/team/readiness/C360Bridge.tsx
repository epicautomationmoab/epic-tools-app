"use client";

import { useEffect, useRef, useState } from "react";
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
  const onCloseRef = useRef(onClose);
  const [hydratedRow, setHydratedRow] = useState<ReadinessRow | null>(null);
  const effectiveRow = hydratedRow ?? row;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setHydratedRow(null);

    fetch(`/api/team/readiness-history?q=${encodeURIComponent(row.confirmation_code)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<{ rows?: ReadinessRow[] }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const candidates = payload.rows ?? [];
        const exactByReadinessId = row.readiness_id
          ? candidates.find((candidate) => candidate.readiness_id === row.readiness_id)
          : undefined;
        const exact =
          exactByReadinessId ??
          candidates.find(
            (candidate) =>
              candidate.confirmation_code === row.confirmation_code &&
              candidate.visit_start_time === row.visit_start_time,
          ) ??
          candidates.find(
            (candidate) => candidate.confirmation_code === row.confirmation_code,
          );
        if (exact) setHydratedRow(exact);
      })
      .catch(() => {
        // Fall back to the supplied row if historical hydration is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [row.readiness_id, row.confirmation_code, row.visit_start_time]);

  useEffect(() => {
    const root: HTMLDivElement = hostRef.current!;
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
        onCloseRef.current?.();
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
          .find((tr) => tr.textContent?.includes(effectiveRow.confirmation_code));
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
  }, [effectiveRow.readiness_id, effectiveRow.confirmation_code]);

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
      <SignedWaiverDrawerEnhancer rows={[effectiveRow]} />
      <SharedActionPinEnhancer />
      <AdventureAssureEnhancer rows={[effectiveRow]} />
      <RentalVehicleIssueEnhancer rows={[effectiveRow]} />
      <ContactSaveEnhancer />
      <StaffNotesDrawerEnhancer />
      <JourneyPreviewOverlay rows={[effectiveRow]} />
      <div ref={hostRef} data-c360-bridge-host>
        <ReadinessTable rows={[effectiveRow]} />
      </div>
    </>
  );
}
