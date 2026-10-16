import { type Context, Hono } from "hono";
import { NAME_RE } from "../shared/constants";
import { FILTER_DIMS, type Filters, type Site, type SiteInput, type SiteSummary } from "../shared/types";
import { type ApiEnv, authenticate, login, logout } from "./auth";
import { retentionDays } from "./cron";
import { MAX_EXPORT_ROWS, exportCsv } from "./csv";
import { randomId } from "./hash";
import { getRealtime } from "./realtime";
import { makeShareToken } from "./share";
import { invalidateSite, insertSiteStmt, listSites, rowToSite, type SiteRow, updateSiteStmt } from "./sites";
import { getStats, siteSummaries } from "./stats";
import { addDays, isDay, localDay, utcDay, validTimezone } from "./time";
import { Meter, readBudget, recordMeter, todayUsage, usageStmt } from "./usage";

/** Version one has a single account. */
export const ACCOUNT_ID = 1;

export const api = new Hono<ApiEnv>();
api.use("*", authenticate);

api.get("/health", (c) => c.json({ ok: true }));
api.post("/login", login);
api.post("/logout", logout);
api.get("/me", (c) => c.json({ owner: c.get("owner"), shareSite: c.get("shareSite"), retentionDays: retentionDays(c.env) }));

type Fields = Partial<Record<keyof SiteInput, unknown>>;
const DOMAIN_RE = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

function strList(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v) || v.length > max || !v.every((x) => typeof x === "string")) return null;
  return v.map((x: string) => x.trim()).filter(Boolean);
}

/** Validates site fields; with `base`, missing fields keep their old values. */
export function parseSiteInput(body: Fields, base?: SiteInput): SiteInput | string {
  const name = body.name ?? base?.name;
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 80) return "Name must be 1 to 80 characters.";
  const domains = body.domains === undefined ? base?.domains : strList(body.domains, 20)?.map((d) => d.toLowerCase());
  if (!domains?.length) return "Add at least one domain.";
  const bad = domains.find((d) => !DOMAIN_RE.test(d));
  if (bad) return `"${bad}" is not a domain. Use a hostname like example.com or *.example.com.`;
  const timezone = body.timezone ?? base?.timezone ?? "UTC";
  if (typeof timezone !== "string" || !validTimezone(timezone)) return "Unknown timezone.";
  const exclude = body.exclude_paths === undefined ? (base?.exclude_paths ?? []) : strList(body.exclude_paths, 50);
  if (!exclude || exclude.some((p) => !p.startsWith("/"))) return "Excluded paths must start with /.";
  const funnel = body.funnel === undefined ? (base?.funnel ?? []) : strList(body.funnel, 20);
  if (!funnel || funnel.some((f) => !NAME_RE.test(f))) return "Funnel sections use lowercase letters, digits, _ and :.";
  const pub = body.public ?? base?.public ?? false;
  if (typeof pub !== "boolean") return "public must be true or false.";
  return { name: name.trim(), domains: [...new Set(domains)], timezone, exclude_paths: exclude, funnel, public: pub };
}

export async function ownedSite(db: D1Database, id: string): Promise<Site | null> {
  const row = await db.prepare("SELECT * FROM sites WHERE id = ? AND account_id = ?").bind(id, ACCOUNT_ID).first<SiteRow>();
  return row ? rowToSite(row) : null;
}

/** What a share-link viewer may see of a site. */
const publicView = (s: Site): Site => ({ ...s, server_key: "", share_nonce: "" });

async function siteOr404(c: Context<ApiEnv>): Promise<Site | Response> {
  const site = await ownedSite(c.env.DB, c.req.param("id") ?? "");
  return site ?? c.json({ error: "No such site" }, 404);
}

const ownerOnly = (c: Context<ApiEnv>) => (c.get("owner") ? null : c.json({ error: "Owner only" }, 403));

/**
 * D1's free plan allows 5 million rows read a day, shared with ingest. Past
 * the read budget the dashboard pauses so tracking never starves.
 */
async function readGuard(c: Context<ApiEnv>): Promise<Response | null> {
  const u = await todayUsage(c.env.DB, c.env, Date.now());
  if (u.rows_read < readBudget(c.env)) return null;
  return c.json({ error: "Today's database read budget is used up, so the dashboard is paused until 00:00 UTC. Tracking keeps working." }, 429);
}

/** Records a request's reads and writes after the response is sent. */
function settle(c: Context<ApiEnv>, meter: Meter) {
  c.executionCtx.waitUntil(recordMeter(c.env.DB, meter, Date.now()).catch(() => {}));
}

/** Adds rows written by owner deletes to today's usage. */
async function countWrites(c: Context<ApiEnv>, results: D1Result[]) {
  const n = results.reduce((a, r) => a + (r.meta.rows_written ?? 0), 0);
  if (n) await usageStmt(c.env.DB, utcDay(Date.now()), 0, 0, n).run();
}

api.get("/sites", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const guard = await readGuard(c);
  if (guard) return guard;
  const now = Date.now();
  const meter = new Meter();
  const sites = await listSites(c.env.DB, ACCOUNT_ID);
  const series = await siteSummaries(c.env.DB, sites, 30, now, meter);
  const out: SiteSummary[] = sites.map((site) => {
    const s = series.get(site.id) ?? { views: [], uniques: [] };
    return { site, views: s.views.reduce((a, b) => a + b, 0), uniques: s.uniques.reduce((a, b) => a + b, 0), spark: s.views };
  });
  out.sort((a, b) => b.views - a.views || a.site.name.localeCompare(b.site.name));
  settle(c, meter);
  return c.json(out);
});

/** Names only, for the site switcher: one cheap query. */
api.get("/sites/list", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const { results } = await c.env.DB.prepare("SELECT id, name FROM sites WHERE account_id = ? ORDER BY name").bind(ACCOUNT_ID).all<{ id: string; name: string }>();
  return c.json(results);
});

api.post("/sites", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const input = parseSiteInput(await c.req.json<Fields>().catch(() => ({})));
  if (typeof input === "string") return c.json({ error: input }, 400);
  const site: Site = {
    ...input,
    id: randomId(8),
    account_id: ACCOUNT_ID,
    server_key: randomId(32),
    share_nonce: randomId(12),
    created: Math.floor(Date.now() / 1000),
  };
  await insertSiteStmt(c.env.DB, site).run();
  return c.json(site, 201);
});

api.get("/sites/:id", async (c) => {
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  return c.json(c.get("owner") ? site : publicView(site));
});

api.patch("/sites/:id", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  const input = parseSiteInput(await c.req.json<Fields>().catch(() => ({})), site);
  if (typeof input === "string") return c.json({ error: input }, 400);
  const next = { ...site, ...input };
  await updateSiteStmt(c.env.DB, next).run();
  invalidateSite(site.id);
  return c.json(next);
});

api.delete("/sites/:id", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  const db = c.env.DB;
  const res = await db.batch(["events", "daily", "rollups"].map((t) => db.prepare(`DELETE FROM ${t} WHERE site_id = ?`).bind(site.id)).concat(db.prepare("DELETE FROM sites WHERE id = ?").bind(site.id)));
  invalidateSite(site.id);
  await countWrites(c, res);
  return c.body(null, 204);
});

api.post("/sites/:id/rotate-key", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  const next = { ...site, server_key: randomId(32) };
  await updateSiteStmt(c.env.DB, next).run();
  invalidateSite(site.id);
  return c.json({ server_key: next.server_key });
});

api.post("/sites/:id/share", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  const { days } = await c.req.json<{ days?: unknown }>().catch(() => ({}) as { days?: unknown });
  if (days !== null && days !== undefined && !(Number.isInteger(days) && (days as number) > 0 && (days as number) <= 3650)) {
    return c.json({ error: "days must be a whole number from 1 to 3650, or null for no expiry" }, 400);
  }
  const exp = typeof days === "number" ? Math.floor(Date.now() / 1000) + days * 86_400 : 0;
  return c.json({ token: await makeShareToken(c.env, site, exp), exp });
});

api.post("/sites/:id/share/revoke", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  await updateSiteStmt(c.env.DB, { ...site, share_nonce: randomId(12) }).run();
  invalidateSite(site.id);
  return c.body(null, 204);
});

/** Longest range one request may ask for (about 13 months). */
const MAX_RANGE_DAYS = 400;

function rangeFrom(c: Context<ApiEnv>, site: Site, defaultDays: number): { from: string; to: string } | null {
  const today = localDay(Date.now(), site.timezone);
  const from = c.req.query("from") ?? addDays(today, -(defaultDays - 1));
  const to = c.req.query("to") ?? today;
  if (!isDay(from) || !isDay(to) || from > to || addDays(from, MAX_RANGE_DAYS) <= to) return null;
  return { from, to };
}

api.get("/sites/:id/stats", async (c) => {
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  const range = rangeFrom(c, site, 30);
  if (!range) return c.json({ error: `Use from and to as YYYY-MM-DD, from on or before to, at most ${MAX_RANGE_DAYS} days apart` }, 400);
  const guard = await readGuard(c);
  if (guard) return guard;
  const filters: Filters = {};
  for (const dim of FILTER_DIMS) {
    const v = c.req.query(`f.${dim}`);
    if (v) filters[dim] = v.slice(0, 200);
  }
  const meter = new Meter();
  const stats = await getStats(c.env.DB, site, range, filters, c.req.query("compare") === "1", Date.now(), meter);
  settle(c, meter);
  return c.json(stats);
});

api.get("/sites/:id/realtime", async (c) => {
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  const guard = await readGuard(c);
  if (guard) return guard;
  const meter = new Meter();
  const rt = await getRealtime(c.env.DB, site, Date.now(), meter);
  settle(c, meter);
  return c.json(rt);
});

api.get("/sites/:id/export.csv", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  const range = rangeFrom(c, site, 90);
  if (!range) return c.json({ error: "Use from and to as YYYY-MM-DD" }, 400);
  const guard = await readGuard(c);
  if (guard) return guard;
  const meter = new Meter();
  const stream = exportCsv(c.env.DB, site.id, range.from, range.to, meter, () => settle(c, meter));
  return new Response(stream, {
    headers: {
      "x-lf-max-rows": String(MAX_EXPORT_ROWS),
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="lanternfish-${site.id}-${range.from}-${range.to}.csv"`,
    },
  });
});

api.delete("/sites/:id/data", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  const site = await siteOr404(c);
  if (site instanceof Response) return site;
  const db = c.env.DB;
  const before = c.req.query("before");
  if (c.req.query("all") === "1") {
    await countWrites(c, await db.batch(["events", "daily", "rollups"].map((t) => db.prepare(`DELETE FROM ${t} WHERE site_id = ?`).bind(site.id))));
  } else if (isDay(before)) {
    await countWrites(c, await db.batch(["events", "daily", "rollups"].map((t) => db.prepare(`DELETE FROM ${t} WHERE site_id = ? AND day < ?`).bind(site.id, before))));
  } else {
    return c.json({ error: "Pass before=YYYY-MM-DD or all=1" }, 400);
  }
  return c.body(null, 204);
});

api.get("/usage", async (c) => {
  const denied = ownerOnly(c);
  if (denied) return denied;
  return c.json(await todayUsage(c.env.DB, c.env, Date.now()));
});
