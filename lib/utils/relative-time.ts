// "3 minutes ago", "in 2 days". Uses the built-in Intl formatter rather than
// a date library, which keeps it out of the client bundle.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

let formatter: Intl.RelativeTimeFormat | null = null;

export function formatRelativeTime(date: Date, now: Date = new Date()) {
  formatter ??= new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const seconds = (date.getTime() - now.getTime()) / 1000;
  const absolute = Math.abs(seconds);

  if (absolute < 45) {
    return seconds < 0 ? "just now" : "in a moment";
  }

  for (const [unit, unitSeconds] of UNITS) {
    // Round up to the next unit once the value is most of the way there, so
    // that 50 minutes reads as "1 hour ago".
    if (absolute >= unitSeconds * 0.85) {
      return formatter.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return formatter.format(Math.round(seconds / 60), "minute");
}
