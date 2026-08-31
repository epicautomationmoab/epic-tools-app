"use client";

import { renderTourWindshieldCardSvg } from "@/lib/tour-windshield-card";

export type NativePrintCard = {
  customer_name: string;
  product_display_name: string;
  visit_start_time: string;
  confirmation_code: string;
};

function lastName(fullName: string) {
  const value = fullName.trim();
  const parts = value.split(/\s+/);
  return parts.at(-1) ?? value;
}

function buildPrintDocument(cards: NativePrintCard[]) {
  const pages = cards.map((card) => renderTourWindshieldCardSvg({
    guestLastName: lastName(card.customer_name),
    tourName: card.product_display_name,
    departureTime: card.visit_start_time,
    confirmationCode: card.confirmation_code,
  })).map((svg) => `<div class="tag-page">${svg}</div>`).join("");

  return `<!doctype html><html><head><title>Vehicle Tags</title><style>
    @page { size: 11in 8.5in; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    .tag-page { width: 11in; height: 8.5in; break-after: page; page-break-after: always; overflow: hidden; }
    .tag-page:last-child { break-after: auto; page-break-after: auto; }
    .tag-page svg { display: block; width: 11in; height: 8.5in; }
  </style></head><body>${pages}</body></html>`;
}

function openNativePrint(cards: NativePrintCard[]) {
  if (!cards.length) return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  const printDocument = iframe.contentDocument;
  if (!printWindow || !printDocument) {
    iframe.remove();
    window.alert("Unable to open the print dialog on this device.");
    return;
  }

  printDocument.open();
  printDocument.write(buildPrintDocument(cards));
  printDocument.close();

  const printAndCleanUp = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 1500);
    }
  };

  if (printDocument.readyState === "complete") {
    window.setTimeout(printAndCleanUp, 50);
  } else {
    iframe.onload = () => window.setTimeout(printAndCleanUp, 50);
  }
}

function PrinterIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
}

export function PrintAllVehicleTagsButton({ cards, className }: { cards: NativePrintCard[]; className?: string }) {
  return <button type="button" className={className} onClick={() => openNativePrint(cards)}><PrinterIcon /><span>Print All Vehicle Tags</span></button>;
}

export function PrintSingleVehicleTagButton({ card, className }: { card: NativePrintCard; className?: string }) {
  return <button type="button" className={className} onClick={() => openNativePrint([card])}><PrinterIcon /><span>Print tag</span></button>;
}
