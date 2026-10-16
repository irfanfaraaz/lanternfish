import type { Env } from "./env";
import { getSalt } from "./hash";
import { rollupDay } from "./rollup";
import { listSites } from "./sites";
import { addDays, localDay, utcDay } from "./time";
import { usageStmt } from "./usage";

const ACCOUNT_ID = 1;
const DELETE_CHUNK = 5000;
/** Free plan allows 50 D1 queries per invocation; leave headroom. */
const QUERY_BUDGET = 40;
/** Days back the cron will still catch up on if a run was missed. */
const CATCH_UP_DAYS = 7;

export function retentionDays(env: Pick<Env, "RETENTION_DAYS">): number {
  const n = Number(env.RETENTION_DAYS);
  return Number.isInteger(n) && n >= 0 ? n : 90;
}

/**
 * The hourly job (`10 * * * *`). Each site's local day is rolled up in the
 * first run after that site's midnight, so every site keeps its own day
 * boundaries; missed days are caught up for a few days. Raw events past
 * retention are pruned up to 5,000 per site per run, independently of rollups. Rows written here are
 * added to today's usage so the ingest budget accounts for them. Work that
 * would pass the per-invocation query budget waits for the next hour.
 */
export async function runCron(env: Env, nowMs: number): Promise<void> {
  const db = env.DB;
  const keep = retentionDays(env);
  const todayUtc = utcDay(nowMs);
  let queries = 0;
  let written = 0;

  await getSalt(db, todayUtc);
  const maint = await db.batch([
    db.prepare("DELETE FROM salts WHERE day < ?").bind(utcDay(nowMs - 86_400_000)),
    db.prepare("DELETE FROM usage WHERE day < ?").bind(utcDay(nowMs - 60 * 86_400_000)),
  ]);
  written += maint.reduce((n, r) => n + (r.meta.rows_written ?? 0), 0);
  queries += 4;

  const sites = await listSites(db, ACCOUNT_ID);
  const { results: done } = await db
    .prepare("SELECT site_id, day FROM rollups WHERE day >= ?")
    .bind(addDays(todayUtc, -(CATCH_UP_DAYS + 2)))
    .all<{ site_id: string; day: string }>();
  const isDone = new Set(done.map((r) => `${r.site_id} ${r.day}`));
  queries += 2;

  // Prune first and on its own: a failing rollup must not let raw events pile up.
  if (keep > 0) {
    for (const site of sites) {
      if (queries + 1 > QUERY_BUDGET) break;
      try {
        const r = await db
          .prepare(`DELETE FROM events WHERE id IN (SELECT id FROM events WHERE site_id = ? AND day < ? LIMIT ${DELETE_CHUNK})`)
          .bind(site.id, addDays(localDay(nowMs, site.timezone), -keep))
          .run();
        queries++;
        written += r.meta.rows_written ?? 0;
      } catch (err) {
        console.error(`cron: prune failed for site ${site.id}`, err instanceof Error ? err.message : err);
      }
    }
  }

  // Every site's yesterday first, then older missed days, newest first.
  outer: for (let back = 1; back <= CATCH_UP_DAYS; back++) {
    for (const site of sites) {
      const day = addDays(localDay(nowMs, site.timezone), -back);
      const created = localDay(Math.max(0, site.created) * 1000, site.timezone);
      if (day < created || isDone.has(`${site.id} ${day}`)) continue;
      if (queries + 4 > QUERY_BUDGET) break outer;
      try {
        written += await rollupDay(db, site, day, nowMs);
      } catch (err) {
        console.error(`cron: site ${site.id} day ${day} failed`, err instanceof Error ? err.message : err);
      }
      queries += 4;
    }
  }

  if (written > 0) await usageStmt(db, todayUtc, 0, 0, written).run();
}
