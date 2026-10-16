import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hmacHex } from "../../src/worker/hash";
import { proxySigMessage } from "../../src/worker/origin";
import { localDay, utcDay } from "../../src/worker/time";
import { SERVER_KEY, beacon, call, reset, seedSite, storedEvents } from "./helpers";

const pv = (p = "/", extra: Record<string, unknown> = {}) => ({ n: "pageview", p, ...extra });
const batch = (e: unknown[], s = "abc123") => ({ s, pl: "load000001", e });

describe("POST /e", () => {
  beforeEach(async () => {
    await reset();
    await seedSite();
  });
  afterEach(() => vi.restoreAllMocks());

  it("stores a pageview with the site's local day", async () => {
    const res = await call(beacon(batch([pv("/work", { r: "news.ycombinator.com", t: "hn", pr: { w: "lg" } })])));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://example.com");
    const [row] = await storedEvents();
    expect(row).toMatchObject({
      site_id: "abc123",
      name: "pageview",
      path: "/work",
      pl: "load000001",
      ref: "news.ycombinator.com",
      tag: "hn",
      device: "desktop",
      browser: "Safari",
      os: "macOS",
      props: '{"w":"lg"}',
    });
    expect(row?.visitor).toMatch(/^[0-9a-f]{16}$/);
    expect(row?.day).toBe(localDay(row!.ts, "Pacific/Auckland"));
  });

  it("unknown site → 204, nothing stored", async () => {
    expect((await call(beacon(batch([pv()], "nope")))).status).toBe(204);
    expect(await storedEvents()).toHaveLength(0);
  });

  it("foreign origin → nothing", async () => {
    await call(beacon(batch([pv()]), { origin: "https://evil.com" }));
    expect(await storedEvents()).toHaveLength(0);
  });

  it("Origin null → nothing", async () => {
    await call(beacon(batch([pv()]), { origin: "null" }));
    expect(await storedEvents()).toHaveLength(0);
  });

  it("subdomain wildcard accepted", async () => {
    await call(beacon(batch([pv()]), { origin: "https://blog.example.org" }));
    expect(await storedEvents()).toHaveLength(1);
  });

  it("8193-byte body → nothing", async () => {
    const body = JSON.stringify(batch([pv(`/${"x".repeat(8192)}`)]));
    expect((await call(beacon(body))).status).toBe(204);
    expect(await storedEvents()).toHaveLength(0);
  });

  it("51 events → nothing", async () => {
    await call(beacon(batch(Array.from({ length: 51 }, () => pv()))));
    expect(await storedEvents()).toHaveLength(0);
  });

  it("bad json → 204", async () => {
    expect((await call(beacon("{not json"))).status).toBe(204);
    expect(await storedEvents()).toHaveLength(0);
  });

  it("invalid sibling dropped, valid kept", async () => {
    await call(beacon(batch([pv(), { n: "Bad Name", p: "/" }, { n: "x", p: "/", pr: { a: { b: 1 } } }, { n: "signup", p: "/" }])));
    expect((await storedEvents()).map((r) => r.name)).toEqual(["pageview", "signup"]);
  });

  it("bot UA dropped", async () => {
    await call(beacon(batch([pv()]), { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2)" }));
    expect(await storedEvents()).toHaveLength(0);
  });

  it("excluded path dropped", async () => {
    await call(beacon(batch([pv("/admin"), pv("/admin/users"), pv("/about")])));
    expect((await storedEvents()).map((r) => r.path)).toEqual(["/about"]);
  });

  it("300 events a minute per visitor, then capped", async () => {
    for (let i = 0; i < 6; i++) await call(beacon(batch(Array.from({ length: 50 }, () => pv()))));
    expect(await storedEvents()).toHaveLength(300);
    await call(beacon(batch([pv()])));
    expect(await storedEvents()).toHaveLength(300);
  });

  it("usage row counts requests, events and rows written", async () => {
    await call(beacon(batch([pv(), pv("/b")])));
    const u = await env.DB.prepare("SELECT * FROM usage WHERE day = ?").bind(utcDay(Date.now())).first();
    expect(u).toMatchObject({ requests: 1, events: 2, rows_written: 5 });
  });

  it("budget spent → nothing stored", async () => {
    await env.DB.prepare("INSERT INTO usage (day, rows_written) VALUES (?, 95000)").bind(utcDay(Date.now())).run();
    expect((await call(beacon(batch([pv()])))).status).toBe(204);
    expect(await storedEvents()).toHaveLength(0);
  });

  it("D1 batch throws → still 204", async () => {
    vi.spyOn(env.DB, "batch").mockRejectedValue(new Error("D1 limit reached"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(beacon(batch([pv()])))).status).toBe(204);
  });

  it("OPTIONS preflight headers", async () => {
    const res = await call(new Request("https://lf.test/e", { method: "OPTIONS", headers: { origin: "https://example.com" } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toBe("POST");
    expect(res.headers.get("access-control-max-age")).toBe("86400");
  });

  it("proxy-signed request uses x-lf-ip, ua and country", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const origin = "https://example.com";
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    const sig = await hmacHex(SERVER_KEY, proxySigMessage(ts, origin, "198.51.100.1", ua));
    await call(
      beacon(batch([pv()]), {
        origin: "https://irrelevant.test",
        "x-lf-ts": ts,
        "x-lf-origin": origin,
        "x-lf-ip": "198.51.100.1",
        "x-lf-ua": ua,
        "x-lf-country": "in",
        "x-lf-city": "Hyderabad",
        "x-lf-sig": sig,
      }),
    );
    expect(await storedEvents()).toMatchObject([{ device: "mobile", os: "iOS", country: "IN", city: "Hyderabad" }]);
  });

  it("forged proxy signature → nothing", async () => {
    await call(
      beacon(batch([pv()]), {
        "x-lf-ts": String(Math.floor(Date.now() / 1000)),
        "x-lf-origin": "https://example.com",
        "x-lf-ip": "1.2.3.4",
        "x-lf-ua": "x",
        "x-lf-sig": "00".repeat(32),
      }),
    );
    expect(await storedEvents()).toHaveLength(0);
  });

  it("IP is never stored", async () => {
    await call(beacon(batch([pv()])));
    const [row] = await storedEvents();
    expect(JSON.stringify(row)).not.toContain("203.0.113.7");
  });
});

describe("POST /s", () => {
  beforeEach(async () => {
    await reset();
    await seedSite();
  });

  const post = (body: unknown, key = SERVER_KEY) =>
    call(new Request("https://lf.test/s", { method: "POST", headers: { "x-lf-key": key, "content-type": "application/json" }, body: JSON.stringify(body) }));

  it("wrong key → nothing", async () => {
    expect((await post({ site: "abc123", name: "agent", path: "/llms.txt", ua: "GPTBot/1.2" }, "wrong")).status).toBe(204);
    expect(await storedEvents()).toHaveLength(0);
  });

  it("agent bot detected from ua when missing", async () => {
    await post({ site: "abc123", name: "agent", path: "/llms.txt", ua: "Mozilla/5.0 (compatible; ClaudeBot/1.0)", ip: "192.0.2.55" });
    const [row] = await storedEvents();
    expect(row).toMatchObject({ name: "agent", path: "/llms.txt", visitor: null });
    expect(JSON.parse(row!.props!)).toEqual({ bot: "ClaudeBot", path: "/llms.txt" });
    expect(JSON.stringify(row)).not.toContain("192.0.2.55");
  });

  it("explicit bot prop kept", async () => {
    await post({ site: "abc123", name: "agent", props: { bot: "GPTBot", path: "/" } });
    expect(JSON.parse((await storedEvents())[0]!.props!)).toEqual({ bot: "GPTBot", path: "/" });
  });

  it("custom server event with ip + ua gets a visitor hash", async () => {
    await post({ site: "abc123", name: "signup", props: { plan: "free" }, ip: "192.0.2.1", ua: "Mozilla/5.0" });
    expect((await storedEvents())[0]?.visitor).toMatch(/^[0-9a-f]{16}$/);
  });

  it("invalid name → nothing", async () => {
    await post({ site: "abc123", name: "Bad!" });
    expect(await storedEvents()).toHaveLength(0);
  });
});
