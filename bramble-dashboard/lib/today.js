export const CAFE_TIMEZONE = "America/Los_Angeles";

function part(parts, type) {
  return parts.find((item) => item.type === type)?.value ?? "";
}

/** Today's date in the cafe's timezone, as YYYY-MM-DD. */
export function cafeToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAFE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

export function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
