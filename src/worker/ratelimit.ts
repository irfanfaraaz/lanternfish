import { RATE_PER_MIN } from "../shared/constants";

/** Per-isolate counters: key `${site}:${visitor}` → minute and count. A soft guard only. */
const buckets = new Map<string, { minute: number; count: number }>();
let lastSweep = 0;

/** Returns how many of `n` events this visitor may still send this minute. */
export function allow(siteId: string, visitor: string, n: number, nowMs: number): number {
  const minute = Math.floor(nowMs / 60_000);
  if (minute - lastSweep >= 2) {
    for (const [k, b] of buckets) if (minute - b.minute >= 2) buckets.delete(k);
    lastSweep = minute;
  }
  const key = `${siteId}:${visitor}`;
  let b = buckets.get(key);
  if (!b || b.minute !== minute) {
    b = { minute, count: 0 };
    buckets.set(key, b);
  }
  const ok = Math.max(0, Math.min(n, RATE_PER_MIN - b.count));
  b.count += ok;
  return ok;
}

export function resetRateLimits() {
  buckets.clear();
}
