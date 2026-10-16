import type { PublicStats } from "../shared/types";
import type { Env } from "./env";
import { getSite } from "./sites";
import { getStats } from "./stats";
import { addDays, localDay } from "./time";
import { Meter, readBudget, recordMeter, todayUsage } from "./usage";

const TTL_S = 300;
const HEADERS = { "access-control-allow-origin": "*", "cache-control": `public, max-age=${TTL_S}` };

/**
 * GET /p/:site — last 30 days' totals for a site that opted in. Anyone can
 * call it, so answers are kept in the edge cache for five minutes and the
 * D1 work runs at most once per site per colo in that time.
 */
export async function publicStats(req: Request, env: Env, siteId: string, nowMs: number, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const key = new Request(new URL(`/p/${encodeURIComponent(siteId)}`, req.url).toString());
  const hit = await cache?.match(key);
  if (hit) return hit;

  const site = await getSite(env.DB, siteId, nowMs);
  if (!site?.public) return Response.json({ error: "Not found" }, { status: 404, headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=60" } });
  const usage = await todayUsage(env.DB, env, nowMs);
  if (usage.rows_read >= readBudget(env)) return Response.json({ error: "Try again later" }, { status: 503, headers: { "retry-after": "3600" } });

  const to = localDay(nowMs, site.timezone);
  const range = { from: addDays(to, -29), to };
  const meter = new Meter();
  const s = await getStats(env.DB, site, range, {}, false, nowMs, meter);
  const body: PublicStats = { name: site.name, range, totals: s.totals, series: s.series, pages: s.pages.slice(0, 10) };
  const res = Response.json(body, { headers: HEADERS });
  ctx.waitUntil(recordMeter(env.DB, meter, nowMs));
  if (cache) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
