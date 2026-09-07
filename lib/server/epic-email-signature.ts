const EPIC_SIGNATURE_LOGO_URL = "https://team.myepicreservation.com/epic-logo.png?v=20260907";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function linkify(value: string) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#d9471c;text-decoration:underline">$1</a>')
    .replace(/\n/g, "<br>");
}

export function firstNameFromDisplayName(displayName?: string | null) {
  return String(displayName || "Epic Team").trim().split(/\s+/)[0] || "Epic Team";
}

export function renderEpicSignatureHtml(senderFirstName: string) {
  const firstName = escapeHtml(senderFirstName || "Epic Team");
  return `<div style="margin-top:28px;padding-top:18px;border-top:1px solid #e6e6e6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.5">
    <div style="font-weight:700;margin-bottom:10px">${firstName}</div>
    <img src="${EPIC_SIGNATURE_LOGO_URL}" alt="Epic 4X4 Adventures" width="320" style="display:block;width:320px;max-width:100%;height:auto;margin:0 0 12px 0;border:0">
    <div style="font-weight:700">Epic 4X4 Adventures</div>
    <div>Moab, Utah</div>
    <div><a href="tel:+14352202700" style="color:#1f2937;text-decoration:none">(435) 220-2700</a></div>
    <div><a href="https://epic4x4adventures.com" style="color:#d9471c;text-decoration:none">epic4x4adventures.com</a></div>
    <div><a href="mailto:hello@epic4x4adventures.com" style="color:#d9471c;text-decoration:none">hello@epic4x4adventures.com</a></div>
  </div>`;
}

export function renderEpicEmailHtml(body: string, senderFirstName: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:15px;line-height:1.6">${linkify(body)}${renderEpicSignatureHtml(senderFirstName)}</div>`;
}

export function renderEpicPlainTextSignature(senderFirstName: string) {
  return `${senderFirstName || "Epic Team"}\nEpic 4X4 Adventures\nMoab, Utah\n(435) 220-2700\nepic4x4adventures.com\nhello@epic4x4adventures.com`;
}
