const nf = new Intl.NumberFormat("en");

/** 950 · 1,204 · 12.4k · 1.2M */
export function num(n: number): string {
  if (n < 10_000) return nf.format(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** 0.42 → "42%" */
export function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  const p = (part / whole) * 100;
  return `${p < 10 && p > 0 ? p.toFixed(1).replace(/\.0$/, "") : Math.round(p)}%`;
}

/** 65_000 → "1m 05s" · 4_200 → "4s" */
export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Relative change, or null when there is nothing to compare. */
export function change(cur: number, prev: number | undefined): number | null {
  if (prev === undefined || prev === 0) return null;
  return (cur - prev) / prev;
}

export function signedPct(c: number): string {
  const v = Math.round(c * 100);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)}%`;
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-05-01" → "1 May" */
export function shortDay(day: string): string {
  return dayFmt.format(new Date(`${day}T00:00:00Z`));
}

export function longDay(day: string): string {
  return longFmt.format(new Date(`${day}T00:00:00Z`));
}

/** Today's date in a timezone, YYYY-MM-DD. */
export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  try {
    return COUNTRY.of(code) ?? code;
  } catch {
    return code;
  }
}
