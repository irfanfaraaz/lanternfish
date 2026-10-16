const dayFmt = new Map<string, Intl.DateTimeFormat>();
const hourFmt = new Map<string, Intl.DateTimeFormat>();

function fmt(cache: Map<string, Intl.DateTimeFormat>, tz: string, opts: Intl.DateTimeFormatOptions) {
  let f = cache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...opts });
    cache.set(tz, f);
  }
  return f;
}

/** `YYYY-MM-DD` of the instant in the given IANA timezone. */
export function localDay(tsMs: number, tz: string): string {
  return fmt(dayFmt, tz, { year: "numeric", month: "2-digit", day: "2-digit" }).format(tsMs);
}

/** Hour 0–23 of the instant in the given timezone. */
export function localHour(tsMs: number, tz: string): number {
  return Number(fmt(hourFmt, tz, { hour: "2-digit", hourCycle: "h23" }).format(tsMs));
}

export function utcDay(tsMs: number): string {
  return new Date(tsMs).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of days from `from` to `to`. Empty if `to` is before `from`. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isDay(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
