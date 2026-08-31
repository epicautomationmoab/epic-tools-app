export type TourWindshieldCardData = {
  guestLastName: string;
  tourName: string;
  departureTime: string;
  confirmationCode: string;
};

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;",
  })[char] ?? char);
}

function mountainTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function fitTextSize(value: string, preferred: number, minimum: number, maxCharsAtPreferred: number) {
  if (value.length <= maxCharsAtPreferred) return preferred;
  return Math.max(minimum, Math.floor(preferred * maxCharsAtPreferred / value.length));
}

function fitGuestLastName(value: string) {
  // Impact is condensed; this deliberately makes short and medium names huge while
  // reducing only when needed so the word stays inside roughly 720pt of usable width.
  const estimatedCharacterWidth = 0.56;
  const maxWidth = 720;
  return Math.max(58, Math.min(176, Math.floor(maxWidth / Math.max(1, value.length * estimatedCharacterWidth))));
}

export function renderTourWindshieldCardSvg(data: TourWindshieldCardData) {
  const lastName = escapeXml(data.guestLastName.trim().toUpperCase());
  const tourName = escapeXml(data.tourName.trim());
  const departure = escapeXml(mountainTimeLabel(data.departureTime));
  const confirmation = escapeXml(data.confirmationCode.trim().toUpperCase());
  const lastNameSize = fitGuestLastName(lastName);
  const tourSize = fitTextSize(tourName, 15, 10, 42);

  // US Letter landscape: 792 x 612 points. Fold line runs horizontally at 306 pt.
  // The guide half is rotated 180 degrees so both exposed faces read upright after folding.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="11in" height="8.5in" viewBox="0 0 792 612">
  <rect width="792" height="612" fill="white"/>

  <!-- Fold line -->
  <line x1="0" y1="306" x2="792" y2="306" stroke="black" stroke-width="1.5"/>

  <!-- Guest-facing half: oversized fitted last name, centered vertically and horizontally -->
  <text x="396" y="459" text-anchor="middle" dominant-baseline="middle" font-family="Impact, Haettenschweiler, 'Arial Narrow Bold', 'Arial Black', sans-serif" font-size="${lastNameSize}" font-weight="900">${lastName}</text>

  <!-- Guide-facing half, rotated for folding -->
  <g transform="rotate(180 396 153)" font-family="Arial, Helvetica, sans-serif" fill="black">
    <text x="396" y="92" text-anchor="middle" font-size="25" font-weight="700">Vehicle Number: __________________</text>

    <text x="110" y="175" font-size="15" font-weight="700">Departure Mileage: __________________</text>
    <text x="516" y="175" font-size="15" font-weight="700">Engine Hours: __________________</text>

    <text x="110" y="208" font-size="15" font-weight="700">Return Mileage: __________________</text>
    <text x="516" y="208" font-size="15" font-weight="700">Engine Hours: __________________</text>

    <!-- Guide identifier block: grouped together in one bottom corner -->
    <line x1="70" y1="257" x2="722" y2="257" stroke="black" stroke-width="0.8"/>
    <text x="70" y="275" font-size="${tourSize}" font-weight="700">${tourName}</text>
    <text x="70" y="294" font-size="13" font-weight="700">${departure}  ·  ${confirmation}</text>
  </g>
</svg>`;
}
