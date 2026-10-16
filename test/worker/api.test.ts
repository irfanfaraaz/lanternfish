import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Site, SiteSummary, Usage } from "../../src/shared/types";
import { resetLoginFailures } from "../../src/worker/auth";
import { csvField } from "../../src/worker/csv";
import { apiCall, beacon, call, insertEvents, login, reset, storedEvents } from "./helpers";

let cookie = "";
const input = { name: "Portfolio", domains: ["Irfanfaraaz.IN", "www.irfanfaraaz.in"], timezone: "Asia/Kolkata", public: false, exclude_paths: ["/admin/*"], funnel: ["hero", "work"] };

describe("sites api", () => {
  beforeEach(async () => {
    await reset();
    resetLoginFailures();
    cookie = await login();
  });

  const create = async (body: unknown = input) => {
    const res = await apiCall(cookie, "POST", "/sites", body);
    return { res, site: res.status === 201 ? await res.json<Site>() : null };
  };

  it("create, list, patch, delete", async () => {
    const { res, site } = await create();
    expect(res.status).toBe(201);
    expect(site!.id).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(site!.server_key).toHaveLength(32);
    expect(site!.account_id).toBe(1);

    const list = await (await apiCall(cookie, "GET", "/sites")).json<SiteSummary[]>();
    expect(list).toHaveLength(1);
    expect(list[0]!.spark).toHaveLength(30);

    const patched = await (await apiCall(cookie, "PATCH", `/sites/${site!.id}`, { name: "Renamed", public: true })).json<Site>();
    expect(patched).toMatchObject({ name: "Renamed", public: true, timezone: "Asia/Kolkata" });

    expect((await apiCall(cookie, "DELETE", `/sites/${site!.id}`)).status).toBe(204);
    expect((await apiCall(cookie, "GET", `/sites/${site!.id}`)).status).toBe(404);
  });

  it("domains are lowercased and deduplicated", async () => {
    const { site } = await create({ ...input, domains: ["Example.com", "example.com"] });
    expect(site!.domains).toEqual(["example.com"]);
  });

  it("invalid timezone → 400", async () => {
    const { res } = await create({ ...input, timezone: "Mars/Olympus" });
    expect(res.status).toBe(400);
    expect((await res.json<{ error: string }>()).error).toMatch(/timezone/i);
  });

  it("bad domain → 400", async () => expect((await create({ ...input, domains: ["https://x.com/"] })).res.status).toBe(400));
  it("bad funnel name → 400", async () => expect((await create({ ...input, funnel: ["Hero Section"] })).res.status).toBe(400));

  it("rotate-key changes the key and the old one stops working on /s", async () => {
    const { site } = await create({ ...input, domains: ["example.com"] });
    const post = (key: string) =>
      call(new Request("https://lf.test/s", { method: "POST", headers: { "x-lf-key": key }, body: JSON.stringify({ site: site!.id, name: "agent", path: "/", ua: "GPTBot" }) }));
    await post(site!.server_key);
    expect(await storedEvents()).toHaveLength(1);
    const { server_key } = await (await apiCall(cookie, "POST", `/sites/${site!.id}/rotate-key`, {})).json<{ server_key: string }>();
    expect(server_key).not.toBe(site!.server_key);
    await post(site!.server_key);
    expect(await storedEvents()).toHaveLength(1);
    await post(server_key);
    expect(await storedEvents()).toHaveLength(2);
  });

  it("csv quotes commas, quotes and newlines", () => {
    expect(csvField('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvField("plain")).toBe("plain");
    expect(csvField(null)).toBe("");
  });

  it("csv export streams rows in range", async () => {
    const { site } = await create();
    const row = { site_id: site!.id, ts: Date.parse("2026-05-01T10:00:00Z"), day: "2026-05-01", name: "pageview", path: "/a,b", pl: "p", visitor: "v", ref: null, tag: null, country: "IN", city: null, device: "desktop", browser: "Chrome", os: "macOS", props: null };
    await insertEvents([row, { ...row, day: "2026-06-01", ts: Date.parse("2026-06-01T10:00:00Z") }]);
    const res = await apiCall(cookie, "GET", `/sites/${site!.id}/export.csv?from=2026-05-01&to=2026-05-31`);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"/a,b"');
  });

  it("delete data before a day", async () => {
    const { site } = await create();
    const row = { site_id: site!.id, ts: 0, day: "2026-01-01", name: "pageview", path: "/", pl: null, visitor: null, ref: null, tag: null, country: null, city: null, device: null, browser: null, os: null, props: null };
    await insertEvents([row, { ...row, day: "2026-03-01" }]);
    expect((await apiCall(cookie, "DELETE", `/sites/${site!.id}/data?before=2026-02-01`)).status).toBe(204);
    expect((await storedEvents()).map((r) => r.day)).toEqual(["2026-03-01"]);
    expect((await apiCall(cookie, "DELETE", `/sites/${site!.id}/data`)).status).toBe(400);
  });

  it("usage reflects ingest", async () => {
    const { site } = await create({ ...input, domains: ["example.com"] });
    await call(beacon({ s: site!.id, pl: "p1", e: [{ n: "pageview", p: "/" }] }));
    const u = await (await apiCall(cookie, "GET", "/usage")).json<Usage>();
    expect(u).toMatchObject({ requests: 1, events: 1, rows_written: 3, budget: 95000 });
  });

  it("unknown api path → 404 json", async () => {
    const res = await apiCall(cookie, "GET", "/nope");
    expect(res.status).toBe(404);
  });

  it("another account's site is invisible", async () => {
    await env.DB.prepare("INSERT OR IGNORE INTO accounts (id) VALUES (2)").run();
    await env.DB.prepare("INSERT INTO sites (id, account_id, name, domains) VALUES ('foreign1', 2, 'x', '[]')").run();
    expect((await apiCall(cookie, "GET", "/sites/foreign1")).status).toBe(404);
  });
});
