import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { EventRow } from "../../src/worker/events";
import { getRealtime } from "../../src/worker/realtime";
import { rollupDay } from "../../src/worker/rollup";
import { getStats, previousRange } from "../../src/worker/stats";
import { localDay } from "../../src/worker/time";
import { call, insertEvents, reset, seedSite } from "./helpers";
import { generateDay } from "./synthetic";

const range = { from: "2026-05-01", to: "2026-05-03" };

describe("stats engine", () => {
  beforeEach(reset);

  it("rolled-up and raw days give identical results", async () => {
    const site = await seedSite({ timezone: "UTC" });
    for (const [i, day] of ["2026-05-01", "2026-05-02", "2026-05-03"].entries()) await insertEvents(generateDay(i + 1, site.id, day, 150));
    const raw = await getStats(env.DB, site, range, {}, false, Date.now());
    for (const day of ["2026-05-01", "2026-05-02", "2026-05-03"]) await rollupDay(env.DB, site, day);
    const rolled = await getStats(env.DB, site, range, {}, false, Date.now());
    expect(rolled).toEqual(raw);
    expect(raw.totals.views).toBeGreaterThan(150);
  });

  it("range spanning rolled and unrolled days", async () => {
    const site = await seedSite({ timezone: "UTC" });
    for (const [i, day] of ["2026-05-01", "2026-05-02", "2026-05-03"].entries()) await insertEvents(generateDay(i + 10, site.id, day, 80));
    const all = await getStats(env.DB, site, range, {}, false, Date.now());
    await rollupDay(env.DB, site, "2026-05-01");
    const mixed = await getStats(env.DB, site, range, {}, false, Date.now());
    expect(mixed.totals).toEqual(all.totals);
    expect(mixed.series).toEqual(all.series);
  });

  it("compare period is the preceding equal range", async () => {
    expect(previousRange(range)).toEqual({ from: "2026-04-28", to: "2026-04-30" });
    const site = await seedSite({ timezone: "UTC" });
    await insertEvents(generateDay(5, site.id, "2026-04-29", 40));
    const s = await getStats(env.DB, site, range, {}, true, Date.now());
    expect(s.compare).toEqual({ from: "2026-04-28", to: "2026-04-30" });
    expect(s.prevTotals!.views).toBeGreaterThan(0);
    expect(s.prevSeries).toHaveLength(3);
  });

  it("filter by country narrows everything", async () => {
    const site = await seedSite({ timezone: "UTC" });
    await insertEvents(generateDay(7, site.id, "2026-05-02", 300));
    const all = await getStats(env.DB, site, range, {}, false, Date.now());
    const de = await getStats(env.DB, site, range, { country: "DE" }, false, Date.now());
    expect(de.filtered).toBe(true);
    expect(de.totals.views).toBeGreaterThan(0);
    expect(de.totals.views).toBeLessThan(all.totals.views);
    expect(de.countries.map((r) => r.key)).toEqual(["DE"]);
  });

  it("filter by ref keeps whole page loads", async () => {
    const site = await seedSite({ timezone: "UTC" });
    const base: EventRow = { site_id: site.id, ts: Date.parse("2026-05-02T10:00:00Z"), day: "2026-05-02", name: "pageview", path: "/", pl: "A", visitor: "v", ref: "x.com", tag: null, country: null, city: null, device: null, browser: null, os: null, props: null };
    await insertEvents([base, { ...base, path: "/two", ref: null }, { ...base, pl: "B", ref: "google.com" }]);
    const s = await getStats(env.DB, site, range, { ref: "x.com" }, false, Date.now());
    expect(s.totals.views).toBe(2);
    expect(s.pages.map((r) => r.key).sort()).toEqual(["/", "/two"]);
  });

  it("single-day range has a 24-point hourly series", async () => {
    const site = await seedSite({ timezone: "UTC" });
    await insertEvents(generateDay(9, site.id, "2026-05-02", 50));
    const s = await getStats(env.DB, site, { from: "2026-05-02", to: "2026-05-02" }, {}, true, Date.now());
    expect(s.series).toHaveLength(24);
    expect(s.series[0]!.t).toBe("00:00");
    expect(s.series.reduce((a, p) => a + p.views, 0)).toBe(s.totals.views);
    expect(s.prevSeries).toHaveLength(24);
  });

  it("funnel follows the site's section order", async () => {
    const site = await seedSite({ timezone: "UTC", funnel: ["hero", "work", "contact"] });
    await insertEvents(generateDay(3, site.id, "2026-05-02", 100));
    const s = await getStats(env.DB, site, range, {}, false, Date.now());
    expect(s.funnel.map((f) => f.section)).toEqual(["hero", "work", "contact"]);
    expect(s.funnel[0]!.loads).toBeGreaterThan(0);
  });

  it("realtime counts the last five minutes only", async () => {
    const site = await seedSite({ timezone: "UTC" });
    const now = Date.now();
    const row: EventRow = { site_id: site.id, ts: now - 60_000, day: localDay(now, "UTC"), name: "pageview", path: "/", pl: "A", visitor: "v1", ref: null, tag: null, country: null, city: null, device: null, browser: null, os: null, props: null };
    await insertEvents([row, { ...row, visitor: "v2", path: "/b" }, { ...row, visitor: "old", ts: now - 6 * 60_000 }]);
    const r = await getRealtime(env.DB, site, now);
    expect(r.visitors).toBe(2);
    expect(r.pages).toHaveLength(2);
  });

  it("/p for a private site → 404", async () => {
    await seedSite({ public: false });
    expect((await call(new Request("https://lf.test/p/abc123"))).status).toBe(404);
  });

  it("/p for a public site has CORS and cache headers", async () => {
    await seedSite({ public: true });
    const res = await call(new Request("https://lf.test/p/abc123"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const body = await res.json<{ name: string; series: unknown[] }>();
    expect(body.name).toBe("Example");
    expect(body.series).toHaveLength(30);
  });
});
