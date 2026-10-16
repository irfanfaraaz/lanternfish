// Tests pinning the final-review fixes: read budget, query counts, CSV safety,
// caching, fail-closed auth and range limits.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetLoginFailures } from "../../src/worker/auth";
import { csvField } from "../../src/worker/csv";
import worker from "../../src/worker/index";
import { rollupDay } from "../../src/worker/rollup";
import { getStats, siteSummaries } from "../../src/worker/stats";
import { localDay, utcDay } from "../../src/worker/time";
import { Meter } from "../../src/worker/usage";
import { apiCall, beacon, call, insertEvents, login, reset, seedSite, storedEvents } from "./helpers";
import { generateDay } from "./synthetic";

describe("final-review fixes", () => {
  beforeEach(async () => {
    await reset();
    resetLoginFailures();
  });
  afterEach(() => vi.restoreAllMocks());

  it("all-sites summaries use a fixed handful of statements for 30 sites", async () => {
    const sites = [];
    for (let i = 0; i < 30; i++) sites.push(await seedSite({ id: `site${String(i).padStart(2, "0")}`, timezone: i % 2 ? "UTC" : "Asia/Kolkata" }));
    const today = localDay(Date.now(), "UTC");
    await insertEvents(generateDay(1, "site01", today, 20));
    const prepare = vi.spyOn(env.DB, "prepare");
    const out = await siteSummaries(env.DB, sites, 30, Date.now());
    expect(prepare.mock.calls.length).toBeLessThanOrEqual(6);
    expect(out.get("site01")!.views.at(-1)).toBeGreaterThan(0);
    expect(out.get("site02")!.views.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("/api/sites works with 30 sites", async () => {
    for (let i = 0; i < 30; i++) await seedSite({ id: `s${String(i).padStart(2, "0")}`, name: `Site ${i}` });
    const cookie = await login();
    const res = await apiCall(cookie, "GET", "/sites");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(30);
  });

  it("stats read far fewer rows once days are rolled up", async () => {
    const site = await seedSite({ timezone: "UTC" });
    const days = ["2026-05-01", "2026-05-02", "2026-05-03"];
    for (const [i, d] of days.entries()) await insertEvents(generateDay(i, site.id, d, 200));
    const range = { from: days[0]!, to: days[2]! };
    const raw = new Meter();
    await getStats(env.DB, site, range, {}, false, Date.now(), raw);
    for (const d of days) await rollupDay(env.DB, site, d);
    const rolled = new Meter();
    await getStats(env.DB, site, range, {}, false, Date.now(), rolled);
    expect(raw.read).toBeGreaterThan(1000);
    expect(rolled.read).toBeLessThan(raw.read / 3);
  });

  it("dashboard reads are counted in usage", async () => {
    const site = await seedSite({ timezone: "UTC" });
    await insertEvents(generateDay(2, site.id, localDay(Date.now(), "UTC"), 30));
    const cookie = await login();
    expect((await apiCall(cookie, "GET", `/sites/${site.id}/stats`)).status).toBe(200);
    const u = await env.DB.prepare("SELECT rows_read FROM usage WHERE day = ?").bind(utcDay(Date.now())).first<{ rows_read: number }>();
    expect(u!.rows_read).toBeGreaterThan(0);
  });

  it("past the read budget the dashboard pauses but ingest keeps storing", async () => {
    await seedSite();
    await env.DB.prepare("INSERT INTO usage (day, rows_read) VALUES (?, 4000000)").bind(utcDay(Date.now())).run();
    const cookie = await login();
    const res = await apiCall(cookie, "GET", "/sites/abc123/stats");
    expect(res.status).toBe(429);
    expect((await res.json<{ error: string }>()).error).toMatch(/Tracking keeps working/);
    await call(beacon({ s: "abc123", pl: "p1", e: [{ n: "pageview", p: "/" }] }));
    expect(await storedEvents()).toHaveLength(1);
  });

  it("csv neutralises spreadsheet formulas", () => {
    expect(csvField("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("@a")).toBe("'@a");
    expect(csvField("/-not-a-formula")).toBe("/-not-a-formula");
    expect(csvField(-5)).toBe("-5");
  });

  it("stats ranges are capped at 400 days", async () => {
    await seedSite();
    const cookie = await login();
    expect((await apiCall(cookie, "GET", "/sites/abc123/stats?from=1900-01-01&to=2026-01-01")).status).toBe(400);
    expect((await apiCall(cookie, "GET", "/sites/abc123/stats?from=2025-01-01&to=2026-01-01")).status).toBe(200);
  });

  it("api refuses to run without a usable SESSION_SECRET", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request("https://lf.test/api/sites"), { ...env, SESSION_SECRET: "" }, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(503);
  });

  it("owner deletes are counted as rows written", async () => {
    await seedSite();
    const row = { site_id: "abc123", ts: 0, day: "2026-01-01", name: "pageview", path: "/", pl: null, visitor: null, ref: null, tag: null, country: null, city: null, device: null, browser: null, os: null, props: null };
    await insertEvents([row, row, row]);
    const cookie = await login();
    expect((await apiCall(cookie, "DELETE", "/sites/abc123/data?all=1")).status).toBe(204);
    const u = await env.DB.prepare("SELECT rows_written FROM usage WHERE day = ?").bind(utcDay(Date.now())).first<{ rows_written: number }>();
    expect(u!.rows_written).toBeGreaterThanOrEqual(3);
  });

  it("today with no events yet is a 24-hour series, not a single point", async () => {
    const site = await seedSite({ timezone: "UTC" });
    const today = localDay(Date.now(), "UTC");
    const s = await getStats(env.DB, site, { from: today, to: today }, {}, false, Date.now());
    expect(s.series).toHaveLength(24);
  });

  it("the switcher's site list is one light call", async () => {
    await seedSite({ id: "aaa", name: "B site" });
    await seedSite({ id: "bbb", name: "A site" });
    const cookie = await login();
    const list = await (await apiCall(cookie, "GET", "/sites/list")).json<{ id: string; name: string }[]>();
    expect(list).toEqual([
      { id: "bbb", name: "A site" },
      { id: "aaa", name: "B site" },
    ]);
  });

  it("public stats are cached at the edge", async () => {
    await seedSite({ public: true });
    expect((await call(new Request("https://lf.test/p/abc123"))).status).toBe(200);
    const prepare = vi.spyOn(env.DB, "prepare");
    const again = await call(new Request("https://lf.test/p/abc123"));
    expect(again.status).toBe(200);
    expect(prepare).not.toHaveBeenCalled();
  });
});
