import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { runCron } from "../../src/worker/cron";
import type { EventRow } from "../../src/worker/events";
import { computeDay, percentile, rollupDay } from "../../src/worker/rollup";
import { insertEvents, makeSite, reset, seedSite } from "./helpers";
import { generateDay } from "./synthetic";

const base: EventRow = { site_id: "abc123", ts: 0, day: "2026-05-01", name: "pageview", path: "/", pl: "L1", visitor: "v1", ref: null, tag: null, country: "IN", city: null, device: "desktop", browser: "Chrome", os: "macOS", props: null };
const ev = (over: Partial<EventRow>): EventRow => ({ ...base, ...over });
const metric = (rows: { metric: string; dim: string; value: number }[], m: string, dim = "") => rows.find((r) => r.metric === m && r.dim === dim)?.value;

async function daily(siteId: string, day: string) {
  const { results } = await env.DB.prepare("SELECT metric, dim, value FROM daily WHERE site_id = ? AND day = ?").bind(siteId, day).all<{ metric: string; dim: string; value: number }>();
  return results;
}

describe("computeDay", () => {
  it("bounce: one pageview and under 10 s visible", () => {
    const rows = computeDay([
      ev({ pl: "A" }),
      ev({ pl: "A", name: "leave", props: '{"ms":4000}' }),
      ev({ pl: "B" }),
      ev({ pl: "B", name: "leave", props: '{"ms":12000}' }),
      ev({ pl: "C" }),
      ev({ pl: "C", path: "/two" }),
    ]);
    expect(metric(rows, "loads")).toBe(3);
    expect(metric(rows, "bounces")).toBe(1);
  });

  it("funnel counts distinct loads per section", () => {
    const rows = computeDay([
      ev({ pl: "A", name: "section_seen", props: '{"section":"hero"}' }),
      ev({ pl: "A", name: "section_seen", props: '{"section":"hero"}' }),
      ev({ pl: "B", name: "section_seen", props: '{"section":"hero"}' }),
      ev({ pl: "B", name: "section_seen", props: '{"section":"work"}' }),
    ]);
    expect(metric(rows, "section:hero")).toBe(2);
    expect(metric(rows, "section:work")).toBe(1);
  });

  it("p75 is nearest-rank", () => {
    expect(percentile([1, 2, 3, 4], 0.75)).toBe(3);
    expect(percentile([10], 0.75)).toBe(10);
    expect(percentile([5, 1, 4, 2, 3], 0.5)).toBe(3);
    const rows = computeDay([1000, 2000, 3000, 4000].map((lcp) => ev({ name: "vitals", props: `{"lcp":${lcp},"cls":0.1}` })));
    expect(metric(rows, "vitals_p75:lcp", "/")).toBe(3000);
    expect(metric(rows, "vitals_p75:cls", "/")).toBe(100);
  });

  it("custom events with props, outbound, 404 and agents", () => {
    const rows = computeDay([
      ev({ name: "contact_click", props: '{"method":"email"}' }),
      ev({ name: "contact_click", props: '{"method":"email"}' }),
      ev({ name: "outbound", props: '{"host":"github.com"}' }),
      ev({ name: "not_found", path: "/gone" }),
      ev({ name: "agent", path: "/llms.txt", pl: null, visitor: null, props: '{"bot":"GPTBot","path":"/llms.txt"}' }),
    ]);
    expect(metric(rows, "event:contact_click")).toBe(2);
    expect(metric(rows, "prop:contact_click", "method=email")).toBe(2);
    expect(metric(rows, "outbound", "github.com")).toBe(1);
    expect(metric(rows, "not_found", "/gone")).toBe(1);
    expect(metric(rows, "agent:GPTBot", "/llms.txt")).toBe(1);
  });
});

describe("rollupDay and cron", () => {
  beforeEach(reset);

  it("rollup is idempotent", async () => {
    const site = await seedSite({ timezone: "UTC" });
    await insertEvents([ev({}), ev({ pl: "L2", visitor: "v2" })]);
    await rollupDay(env.DB, site, "2026-05-01");
    const first = await daily(site.id, "2026-05-01");
    await rollupDay(env.DB, site, "2026-05-01");
    expect(await daily(site.id, "2026-05-01")).toEqual(first);
    expect(metric(first, "views")).toBe(2);
    expect(metric(first, "uniques")).toBe(2);
  });

  it("cron rolls up each site's own local yesterday", async () => {
    const hnl = await seedSite({ id: "hnl", timezone: "Pacific/Honolulu" });
    const akl = await seedSite({ id: "akl", timezone: "Pacific/Auckland" });
    // 2026-01-15T11:10Z is 01:10 on the 15th in Honolulu and 00:10 on the 16th in Auckland.
    const now = Date.parse("2026-01-15T11:10:00Z");
    await insertEvents([ev({ site_id: hnl.id, day: "2026-01-14" }), ev({ site_id: akl.id, day: "2026-01-15" }), ev({ site_id: akl.id, day: "2026-01-16" })]);
    await runCron(env, now);
    const { results } = await env.DB.prepare("SELECT site_id, day FROM rollups ORDER BY site_id, day").all<{ site_id: string; day: string }>();
    const done = results.map((r) => `${r.site_id} ${r.day}`);
    expect(done).toContain("hnl 2026-01-14");
    expect(done).toContain("akl 2026-01-15");
    expect(done).not.toContain("akl 2026-01-16");
    expect(metric(await daily("akl", "2026-01-15"), "views")).toBe(1);
  });

  it("cron prunes raw events past retention and counts its writes", async () => {
    await seedSite({ timezone: "UTC" });
    const now = Date.parse("2026-06-01T00:10:00Z");
    await insertEvents([ev({ day: "2026-02-01" }), ev({ day: "2026-03-03" }), ev({ day: "2026-05-31" })]);
    await runCron({ ...env, RETENTION_DAYS: "90" }, now);
    const { results } = await env.DB.prepare("SELECT day FROM events ORDER BY day").all<{ day: string }>();
    expect(results.map((r) => r.day)).toEqual(["2026-03-03", "2026-05-31"]);
    const u = await env.DB.prepare("SELECT rows_written FROM usage WHERE day = '2026-06-01'").first<{ rows_written: number }>();
    expect(u!.rows_written).toBeGreaterThan(0);
  });

  it("salt rotation keeps yesterday and today only", async () => {
    const now = Date.parse("2026-06-10T00:10:00Z");
    await env.DB.batch(["2026-06-07", "2026-06-08", "2026-06-09"].map((d) => env.DB.prepare("INSERT INTO salts (day, salt) VALUES (?, 'x')").bind(d)));
    await runCron(env, now);
    const { results } = await env.DB.prepare("SELECT day FROM salts ORDER BY day").all<{ day: string }>();
    expect(results.map((r) => r.day)).toEqual(["2026-06-09", "2026-06-10"]);
  });

  it("load sanity: 2000 synthetic visits roll up to the raw counts", async () => {
    const site = await seedSite({ timezone: "UTC", funnel: ["hero", "work", "contact"] });
    await insertEvents(generateDay(42, site.id, "2026-05-01", 2000));
    await rollupDay(env.DB, site, "2026-05-01");
    const d = await daily(site.id, "2026-05-01");
    const q = (sql: string) => env.DB.prepare(sql).first<{ n: number }>().then((r) => r!.n);
    expect(metric(d, "views")).toBe(await q("SELECT COUNT(*) AS n FROM events WHERE name = 'pageview'"));
    expect(metric(d, "uniques")).toBe(await q("SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE name = 'pageview'"));
    expect(metric(d, "loads")).toBe(2000);
    expect(metric(d, "event:contact_click")).toBe(await q("SELECT COUNT(*) AS n FROM events WHERE name = 'contact_click'"));
    expect(metric(d, "section:hero")).toBe(await q("SELECT COUNT(DISTINCT pl) AS n FROM events WHERE name = 'section_seen' AND props LIKE '%\"hero\"%'"));
    const paths = d.filter((r) => r.metric === "path").reduce((a, r) => a + r.value, 0);
    expect(paths).toBe(metric(d, "views"));
    void makeSite;
  });
});
