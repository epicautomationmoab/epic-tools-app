// EXP opens at 8:00 AM Moab time on the calendar day before the rental.
// Use local calendar dates rather than a 24-hour difference (DST-safe).
const MOAB_ZONE = "America/Denver";
function moabParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MOAB_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour") };
}
export function withinExpWindow(start: number, now: number) {
  if (!Number.isFinite(start) || start - now <= 30 * 60 * 1000) return false;
  const visit = moabParts(start);
  const today = moabParts(now);
  const dayDifference = Math.round((Date.UTC(visit.year, visit.month - 1, visit.day) -
    Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000);
  return dayDifference === 0 || (dayDifference === 1 && today.hour >= 8);
}


export function denverWallTimeToIso(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?/,
  );
  if (!match) return value;
  const [, year, month, day, hour, minute, rawSecond = "00"] = match;
  const second = Number.parseFloat(rawSecond);
  const wholeSecond = Math.floor(second);
  const millisecond = Math.round((second - wholeSecond) * 1000);
  const wallClockAsUtc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), wholeSecond, millisecond));
  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", timeZoneName: "longOffset" })
    .formatToParts(wallClockAsUtc)
    .find((part) => part.type === "timeZoneName")?.value;
  const offsetMatch = offsetName?.match(/^GMT([+-]\d{2}:\d{2})$/);
  if (!offsetMatch) return value;
  const seconds = String(wholeSecond).padStart(2, "0");
  const fraction = millisecond ? `.${String(millisecond).padStart(3, "0")}` : "";
  return `${year}-${month}-${day}T${hour}:${minute}:${seconds}${fraction}${offsetMatch[1]}`;
}

