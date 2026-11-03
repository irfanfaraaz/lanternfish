import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { issueSession, readSession, resetLoginFailures } from "../../src/worker/auth";
import { hmacB64url } from "../../src/worker/hash";
import { makeShareToken } from "../../src/worker/share";
import { TEST_SECRET, apiCall, call, login, makeSite, reset, seedAccount, seedSite, sessionFor } from "./helpers";

const loginReq = (password: string, ip: string) =>
  new Request("https://lf.test/api/login", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ password }),
  });

describe("auth", () => {
  beforeEach(async () => {
    await reset();
    resetLoginFailures();
    await seedSite();
    await seedSite({ id: "other1", name: "Other" });
  });

  it("wrong password → 401", async () => expect((await call(loginReq("nope", "10.0.0.1"))).status).toBe(401));

  it("right password sets a strict, http-only cookie", async () => {
    const res = await call(loginReq("test-password", "10.0.0.2"));
    expect(res.status).toBe(204);
    const c = res.headers.get("set-cookie")!;
    expect(c).toMatch(/^lf_session=/);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Strict/);
    expect(c).toMatch(/Max-Age=2592000/);
  });

  it("api without cookie → 401", async () => expect((await call(new Request("https://lf.test/api/sites"))).status).toBe(401));

  it("valid cookie reaches the api", async () => {
    const cookie = await login("10.0.0.3");
    expect((await apiCall(cookie, "GET", "/sites")).status).toBe(200);
  });

  it("tampered cookie → 401", async () => {
    const cookie = await login("10.0.0.4");
    expect((await apiCall(`${cookie}x`, "GET", "/sites")).status).toBe(401);
  });

  it("login issues an account 1 session carrying its session_gen", async () => {
    await env.DB.prepare("UPDATE accounts SET session_gen = 3 WHERE id = 1").run();
    const cookie = await login("10.0.0.8");
    const token = cookie.slice("lf_session=".length);
    expect(token.split(".")).toHaveLength(4);
    expect(await readSession(token, TEST_SECRET, Math.floor(Date.now() / 1000))).toEqual({ accountId: 1, gen: 3 });
    expect((await apiCall(cookie, "GET", "/sites")).status).toBe(200);
  });

  it("expired cookie → 401", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await issueSession(TEST_SECRET, 1, 0, now - 31 * 86_400);
    expect(await readSession(token, TEST_SECRET, now)).toBeNull();
    expect((await apiCall(`lf_session=${token}`, "GET", "/sites")).status).toBe(401);
  });

  it("legacy exp.sig cookie → 401", async () => {
    const exp = Math.floor(Date.now() / 1000) + 86_400;
    const token = `${exp}.${await hmacB64url(TEST_SECRET, `session:${exp}`)}`;
    expect(await readSession(token, TEST_SECRET, Math.floor(Date.now() / 1000))).toBeNull();
    expect((await apiCall(`lf_session=${token}`, "GET", "/sites")).status).toBe(401);
  });

  it("session from an older session_gen → 401", async () => {
    const cookie = await sessionFor(1);
    expect((await apiCall(cookie, "GET", "/sites")).status).toBe(200);
    await env.DB.prepare("UPDATE accounts SET session_gen = 1 WHERE id = 1").run();
    expect((await apiCall(cookie, "GET", "/sites")).status).toBe(401);
  });

  it("session for a missing account → 401", async () => {
    const token = await issueSession(TEST_SECRET, 99, 0, Math.floor(Date.now() / 1000));
    expect((await apiCall(`lf_session=${token}`, "GET", "/sites")).status).toBe(401);
  });

  it("session signed for one account cannot be relabelled as another", async () => {
    const token = await issueSession(TEST_SECRET, 1, 0, Math.floor(Date.now() / 1000));
    const forged = `2${token.slice(1)}`;
    expect(await readSession(forged, TEST_SECRET, Math.floor(Date.now() / 1000))).toBeNull();
  });

  it("6th failed login from one IP → 429", async () => {
    for (let i = 0; i < 5; i++) expect((await call(loginReq("bad", "10.0.0.5"))).status).toBe(401);
    expect((await call(loginReq("test-password", "10.0.0.5"))).status).toBe(429);
  });

  it("POST without JSON content-type → 415", async () => {
    const cookie = await login("10.0.0.6");
    const res = await call(new Request("https://lf.test/api/sites", { method: "POST", headers: { cookie, "content-type": "text/plain" }, body: "{}" }));
    expect(res.status).toBe(415);
  });

  it("share token reads only its own site, without secrets", async () => {
    const token = await makeShareToken(env, makeSite(), 0);
    const get = (path: string) => call(new Request(`https://lf.test/api${path}`, { headers: { authorization: `Share ${token}` } }));
    const own = await get("/sites/abc123");
    expect(own.status).toBe(200);
    const site = await own.json<{ server_key: string; share_nonce: string }>();
    expect(site.server_key).toBe("");
    expect(site.share_nonce).toBe("");
    expect((await get("/sites/abc123/stats")).status).toBe(200);
    expect((await get("/sites/abc123/realtime")).status).toBe(200);
    expect((await get("/sites/other1/stats")).status).toBe(401);
    expect((await get("/sites")).status).toBe(401);
    expect((await get("/sites/abc123/export.csv")).status).toBe(401);
  });

  it("a share link works while signed in to another account", async () => {
    const token = await makeShareToken(env, makeSite(), 0);
    const two = await seedAccount("two@example.com", "a long enough password");
    const cookie = await sessionFor(two);
    const get = (path: string) => call(new Request(`https://lf.test/api${path}`, { headers: { cookie, authorization: `Share ${token}` } }), { MODE: "cloud" });
    expect((await get("/sites/abc123/stats")).status).toBe(200);
    const site = await (await get("/sites/abc123")).json<{ server_key: string }>();
    expect(site.server_key).toBe("");
    // Off the share's routes the cookie still applies.
    expect((await get("/sites")).status).toBe(200);
  });

  it("expired share token → 401", async () => {
    const token = await makeShareToken(env, makeSite(), Math.floor(Date.now() / 1000) - 1);
    const res = await call(new Request("https://lf.test/api/sites/abc123/stats", { headers: { authorization: `Share ${token}` } }));
    expect(res.status).toBe(401);
  });

  it("rotated share_nonce revokes", async () => {
    const token = await makeShareToken(env, makeSite(), 0);
    const cookie = await login("10.0.0.7");
    expect((await apiCall(cookie, "POST", "/sites/abc123/share/revoke", {})).status).toBe(204);
    const res = await call(new Request("https://lf.test/api/sites/abc123/stats", { headers: { authorization: `Share ${token}` } }));
    expect(res.status).toBe(401);
  });

  it("share token cannot PATCH", async () => {
    const token = await makeShareToken(env, makeSite(), 0);
    const res = await call(
      new Request("https://lf.test/api/sites/abc123", {
        method: "PATCH",
        headers: { authorization: `Share ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Hacked" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
