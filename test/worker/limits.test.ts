import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Usage } from "../../src/shared/types";
import type { Env } from "../../src/worker/env";
import { utcDay } from "../../src/worker/time";
import { SERVER_KEY, apiCall, beacon, call, insertEvents, reset, seedAccount, seedSite, sessionFor, storedEvents } from "./helpers";

const CLOUD: Partial<Env> = { MODE: "cloud" };
const pv = (p = "/") => ({ n: "pageview", p });
const batch = (n: number, s = "abc123") => ({ s, pl: "load000001", e: Array.from({ length: n }, (_, i) => pv(`/p${i}`)) });
const serverEvent = (site = "abc123") =>
  new Request("https://lf.test/s", {
    method: "POST",
    headers: { "x-lf-key": SERVER_KEY, "content-type": "application/json" },
    body: JSON.stringify({ site, name: "signup", props: {} }),
  });

const accountRows = async () => (await env.DB.prepare("SELECT * FROM account_usage ORDER BY account_id").all<{ account_id: number; day: string; events: number; rows_written: number; rows_read: number }>()).results;
const countFor = async (site: string) => (await storedEvents()).filter((r) => r.site_id === site).length;

describe("per-account limits", () => {
  let one = 0;
  let two = 0;

  beforeEach(async () => {
    await reset();
    one = await seedAccount("one@example.com", "a long enough password");
    two = await seedAccount("two@example.com", "a long enough password");
    await seedSite({ account_id: one });
    await seedSite({ id: "b2site", account_id: two, name: "Two", share_nonce: "nonce2" });
  });

  it("self mode: ingest and server events write no account_usage row", async () => {
    await call(beacon(batch(2)));
    await call(serverEvent());
    expect(await storedEvents()).toHaveLength(3);
    expect(await accountRows()).toHaveLength(0);
  });

  it("cloud mode: ingest counts events to the site's account", async () => {
    await call(beacon(batch(3)), CLOUD);
    await call(serverEvent(), CLOUD);
    const stored = await storedEvents();
    expect(stored).toHaveLength(4);
    const rows = await accountRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ account_id: one, day: utcDay(Date.now()), events: stored.length, rows_read: 0 });
    expect(rows[0]!.rows_written).toBeGreaterThan(0);
  });

  it("an account at its event cap is dropped while another account still stores", async () => {
    const over = { ...CLOUD, ACCOUNT_DAILY_EVENTS: "3" };
    await call(beacon(batch(5)), over);
    expect(await countFor("abc123")).toBe(5);
    await call(beacon(batch(1)), over);
    await call(serverEvent(), over);
    expect(await countFor("abc123")).toBe(5);
    await call(beacon(batch(2, "b2site")), over);
    expect(await countFor("b2site")).toBe(2);
    // The install-wide budget is far from used up.
    const u = await env.DB.prepare("SELECT rows_written FROM usage").first<{ rows_written: number }>();
    expect(u!.rows_written).toBeLessThan(95_000);
  });

  it("an account past its read limit gets 429 on stats", async () => {
    const today = utcDay(Date.now());
    const row = { site_id: "abc123", ts: Date.now(), day: today, name: "pageview", path: "/", pl: null, visitor: "v", ref: null, tag: null, country: null, city: null, device: null, browser: null, os: null, props: null };
    await insertEvents([row, row, row]);
    const over = { ...CLOUD, ACCOUNT_DAILY_READS: "1" };
    const cookie = await sessionFor(one);
    expect((await apiCall(cookie, "GET", "/sites/abc123/stats", undefined, over)).status).toBe(200);
    const res = await apiCall(cookie, "GET", "/sites/abc123/stats", undefined, over);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "This account's dashboard read limit for today is used up. It resets at 00:00 UTC." });
    // Another account is unaffected.
    expect((await apiCall(await sessionFor(two), "GET", "/sites/b2site/stats", undefined, over)).status).toBe(200);
  });

  it("an account at its site limit gets 403 on POST /sites", async () => {
    const over = { ...CLOUD, ACCOUNT_MAX_SITES: "1" };
    const res = await apiCall(await sessionFor(one), "POST", "/sites", { name: "More", domains: ["more.example"] }, over);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "This account has reached its limit of 1 sites." });
    const fresh = await seedAccount("three@example.com", "a long enough password");
    expect((await apiCall(await sessionFor(fresh), "POST", "/sites", { name: "First", domains: ["first.example"] }, over)).status).toBe(201);
  });

  it("GET /usage in cloud mode returns the account's numbers", async () => {
    await call(beacon(batch(2)), CLOUD);
    const over = { ...CLOUD, ACCOUNT_DAILY_EVENTS: "500", ACCOUNT_DAILY_READS: "9000" };
    const u = await (await apiCall(await sessionFor(one), "GET", "/usage", undefined, over)).json<Usage>();
    const [row] = await accountRows();
    expect(u).toEqual({ day: utcDay(Date.now()), requests: 0, events: 2, rows_written: row!.rows_written, rows_read: row!.rows_read, budget: 500, read_budget: 9000, scope: "account" });
    const other = await (await apiCall(await sessionFor(two), "GET", "/usage", undefined, over)).json<Usage>();
    expect(other).toMatchObject({ events: 0, rows_written: 0, rows_read: 0, scope: "account" });
  });

  it("GET /usage in self mode returns the install's numbers", async () => {
    await call(beacon(batch(2)));
    const u = await (await apiCall(await sessionFor(1), "GET", "/usage")).json<Usage>();
    expect(u).toMatchObject({ requests: 1, events: 2, budget: 95000, scope: "install" });
  });
});
