import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { SiteSummary } from "../../src/shared/types";
import { apiCall, reset, seedAccount, seedSite, sessionFor } from "./helpers";

const snapshot = () => env.DB.prepare("SELECT * FROM sites WHERE id = 'abc123'").first();

describe("account isolation", () => {
  let other = "";

  beforeEach(async () => {
    await reset();
    await seedSite();
    const id = await seedAccount("two@example.com", "a long enough password");
    await seedSite({ id: "b2site", account_id: id, name: "Two", share_nonce: "nonce2" });
    other = await sessionFor(id);
  });

  const routes: [string, string, unknown?][] = [
    ["GET", "/sites/abc123"],
    ["PATCH", "/sites/abc123", { name: "Hacked" }],
    ["DELETE", "/sites/abc123"],
    ["POST", "/sites/abc123/rotate-key", {}],
    ["POST", "/sites/abc123/share", { days: 1 }],
    ["POST", "/sites/abc123/share/revoke", {}],
    ["GET", "/sites/abc123/stats"],
    ["GET", "/sites/abc123/realtime"],
    ["GET", "/sites/abc123/export.csv"],
    ["DELETE", "/sites/abc123/data?all=1"],
  ];

  for (const [method, path, body] of routes) {
    it(`${method} ${path} from another account → 404, row unchanged`, async () => {
      const before = await snapshot();
      expect(before).not.toBeNull();
      expect((await apiCall(other, method, path, body)).status).toBe(404);
      expect(await snapshot()).toEqual(before);
    });
  }

  it("/sites lists only the caller's sites", async () => {
    const list = await (await apiCall(other, "GET", "/sites")).json<SiteSummary[]>();
    expect(list.map((s) => s.site.id)).toEqual(["b2site"]);
  });

  it("/sites/list lists only the caller's sites", async () => {
    const list = await (await apiCall(other, "GET", "/sites/list")).json<{ id: string }[]>();
    expect(list.map((s) => s.id)).toEqual(["b2site"]);
  });

  it("a new site belongs to the caller's account", async () => {
    const res = await apiCall(other, "POST", "/sites", { name: "New", domains: ["new.example"] });
    expect(res.status).toBe(201);
    const { id } = await res.json<{ id: string }>();
    const row = await env.DB.prepare("SELECT account_id FROM sites WHERE id = ?").bind(id).first<{ account_id: number }>();
    expect(row?.account_id).not.toBe(1);
  });

  it("the owner still reaches their own site", async () => {
    expect((await apiCall(await sessionFor(1), "GET", "/sites/abc123")).status).toBe(200);
    expect((await apiCall(await sessionFor(1), "GET", "/sites/b2site")).status).toBe(404);
  });
});
