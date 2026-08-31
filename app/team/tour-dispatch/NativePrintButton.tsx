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

function openNativePrint(cards: NativePrintCard[]) {
  if (!cards.length) return;
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    window.alert("Please allow pop-ups for Epic Tools so the print dialog can open.");
    return;
  }

  const pages = cards.map((card) => renderTourWindshieldCardSvg({
    guestLastName: lastName(card.customer_name),
    tourName: card.product_display_name,
    departureTime: card.visit_start_time,
    confirmationCode: card.confirmation_code,
  })).map((svg) => `<div class="tag-page">${svg}</div>`).join("");

  popup.document.open();
  popup.document.write(`<!doctype html><html><head><title>Vehicle Tags</title><style>
    @page { size: 11in 8.5in; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    .tag-page { width: 11in; height: 8.5in; break-after: page; page-break-after: always; overflow: hidden; }
    .tag-page:last-child { break-after: auto; page-break-after: auto; }
    .tag-page svg { display: block; width: 11in; height: 8.5in; }
    @media screen { body { background: #ddd; } .tag-page { margin: 12px auto; background: white; box-shadow: 0 2px 10px rgba(0,0,0,.18); } }
  </style></head><body>${pages}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),100));<\/script></body></html>`);
  popup.document.close();
}

export function PrintAllVehicleTagsButton({ cards }: { cards: NativePrintCard[] }) {
  return <button type="button" onClick={() => openNativePrint(cards)}>Print All Vehicle Tags</button>;
}

export function PrintSingleVehicleTagButton({ card, className }: { card: NativePrintCard; className?: string }) {
  return <button type="button" className={className} onClick={() => openNativePrint([card])}>○ Print Tag</button>;
}
