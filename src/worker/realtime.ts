import type { Realtime, Site } from "../shared/types";
import { addDays, localDay } from "./time";
import type { Meter } from "./usage";

const WINDOW_MS = 5 * 60_000;

/**
 * Visitors and their pages over the last five minutes. The (site_id, day,
 * name, ts) index turns this into a short range scan, not a read of the day.
 */
export async function getRealtime(db: D1Database, site: Site, nowMs: number, meter?: Meter): Promise<Realtime> {
  const today = localDay(nowMs, site.timezone);
  const since = nowMs - WINDOW_MS;
  const days = [today, addDays(today, -1)];
  const res = await db.batch([
    db
      .prepare("SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE site_id = ? AND day IN (?, ?) AND name IN ('pageview', 'leave') AND ts > ? AND visitor IS NOT NULL")
      .bind(site.id, ...days, since),
    db
      .prepare(
        "SELECT path AS key, COUNT(DISTINCT visitor) AS value FROM events WHERE site_id = ? AND day IN (?, ?) AND name = 'pageview' AND ts > ? GROUP BY path ORDER BY value DESC, path LIMIT 10",
      )
      .bind(site.id, ...days, since),
  ]);
  meter?.addAll(res);
  const [count, pages] = res;
  return {
    visitors: (count!.results[0] as { n: number } | undefined)?.n ?? 0,
    pages: pages!.results as { key: string; value: number }[],
  };
}
