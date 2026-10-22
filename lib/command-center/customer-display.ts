/**
 * Display helpers for the native Customer 360 read-only migration.
 * TripWorks reservation start/end values use a Moab wall-clock convention.
 * Do not run a UTC offset through them a second time.
 */
export function displayCustomerDate(value: unknown, source: "reservation" | "event"): string {
  if (typeof value !== "string" || !value.trim()) return "Date unavailable";
  if (source === "reservation") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (match) {
      const hour = Number(match[4]);
      const hh = hour % 12 || 12;
      return `${match[2]}/${match[3]}/${match[1]} ${hh}:${match[5]} ${hour < 12 ? "AM" : "PM"} (Moab)`;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function detailLabel(kind: string, item: Record<string, unknown>): string {
  const primary = kind === "reservations"
    ? item.experience_name || item.confirmation_code
    : item.experience_name || item.subject || item.customer_name || item.confirmation_code || item.direction || item.author_name;
  return String(primary || kind.replace(/s$/, ""));
}
