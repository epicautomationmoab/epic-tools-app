"use client";

import { useEffect } from "react";

type KioskReservation = {
  readinessId: string;
  confirmationCode: string;
};

export default function KioskHandoffEnhancer({
  reservations,
}: {
  reservations: KioskReservation[];
}) {
  useEffect(() => {
    const orderedReservations = [...reservations].sort(
      (a, b) => b.confirmationCode.length - a.confirmationCode.length,
    );

    async function handleChange(event: Event) {
      const select = event.target;

      if (!(select instanceof HTMLSelectElement)) return;
      if (!select.matches('select[aria-label^="Send "][aria-label$=" to kiosk"]')) {
        return;
      }

      const kioskNumber = Number(select.value);
      if (!Number.isInteger(kioskNumber) || kioskNumber < 1 || kioskNumber > 7) {
        return;
      }

      const rowText = select.closest("tr")?.textContent ?? "";
      const reservation = orderedReservations.find(({ confirmationCode }) =>
        rowText.includes(confirmationCode),
      );
      const placeholder = select.options[0];
      const originalLabel = placeholder?.textContent ?? "Select";

      if (!reservation || !placeholder) {
        select.value = "";
        return;
      }

      placeholder.textContent = "Sending…";
      select.value = "";
      select.disabled = true;

      try {
        const response = await fetch("/api/team/kiosk-handoffs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            readinessId: reservation.readinessId,
            kioskId: `kiosk-${kioskNumber}`,
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(data?.error || "Unable to send reservation to kiosk.");
        }

        placeholder.textContent = `Sent Kiosk ${kioskNumber}`;
      } catch (error) {
        console.error("Kiosk handoff failed:", error);
        placeholder.textContent = "Failed";
      } finally {
        window.setTimeout(() => {
          placeholder.textContent = originalLabel;
          select.disabled = false;
          select.value = "";
        }, 2200);
      }
    }

    document.addEventListener("change", handleChange, true);
    return () => document.removeEventListener("change", handleChange, true);
  }, [reservations]);

  return null;
}
