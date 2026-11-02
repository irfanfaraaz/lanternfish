import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Me } from "../../src/shared/types";
import { normalizeEmail, validPassword } from "../../src/worker/accounts";
import { resetLoginFailures } from "../../src/worker/auth";
import type { Env } from "../../src/worker/env";
import { apiCall, call, insertEvents, reset, seedAccount, seedSite, sessionFor } from "./helpers";

const CLOUD: Partial<Env> = { MODE: "cloud" };
const PW = "correct horse battery";

function post(path: string, body: unknown, envOver: Partial<Env> = CLOUD, ip = "198.51.100.10"): Promise<Response> {
  return call(
    new Request(`https://lf.test/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify(body),
    }),
    envOver,
  );
}

const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;

describe("email and password checks", () => {
  it("normalizes and validates emails", () => {
    expect(normalizeEmail(" Me@X.com ")).toBe("me@x.com");
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail("a b@x.com")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@x.com`)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
  it("passwords are 12 to 200 characters", () => {
    expect(validPassword("x".repeat(11))).toBe(false);
    expect(validPassword("x".repeat(12))).toBe(true);
    expect(validPassword("x".repeat(200))).toBe(true);
    expect(validPassword("x".repeat(201))).toBe(false);
    expect(validPassword(null)).toBe(false);
  });
});

describe("cloud accounts", () => {
  beforeEach(async () => {
    await reset();
    resetLoginFailures();
  });

  it("GET /api/config is public", async () => {
    expect(await (await call(new Request("https://lf.test/api/config"), CLOUD)).json()).toEqual({ mode: "cloud", signups: true });
    expect(await (await call(new Request("https://lf.test/api/config"), { MODE: "cloud", SIGNUPS: "closed" })).json()).toEqual({
      mode: "cloud",
      signups: false,
    });
    expect(await (await call(new Request("https://lf.test/api/config"))).json()).toEqual({ mode: "self", signups: false });
  });

  it("sign-up sets a cookie and /me shows the email and limits", async () => {
    const res = await post("/signup", { email: " New@Example.com ", password: PW });
    expect(res.status).toBe(201);
    const me = await (await apiCall(cookieOf(res), "GET", "/me", undefined, CLOUD)).json<Me>();
    expect(me).toMatchObject({ owner: true, shareSite: null, mode: "cloud", email: "new@example.com", signups: true });
    expect(typeof me.retentionDays).toBe("number");
    expect(me.limits).toEqual({ events: 10_000, reads: 500_000, sites: 10 });
  });

  it("self-mode /me keeps its fields with mode self and no limits", async () => {
    const me = await (await apiCall(await sessionFor(1), "GET", "/me")).json<Me>();
    expect(me).toMatchObject({ owner: true, shareSite: null, mode: "self", email: null, signups: false, limits: null });
    expect(typeof me.retentionDays).toBe("number");
  });

  it("the same email in another case or with spaces → 409", async () => {
    expect((await post("/signup", { email: " Me@X.com ", password: PW })).status).toBe(201);
    const res = await post("/signup", { email: "me@x.com", password: PW });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "That email already has an account. Sign in instead." });
    const { n } = (await env.DB.prepare("SELECT COUNT(*) AS n FROM accounts WHERE email = 'me@x.com'").first<{ n: number }>())!;
    expect(n).toBe(1);
  });

  it("short password or bad email → 400", async () => {
    expect((await post("/signup", { email: "a@b.co", password: "short" })).status).toBe(400);
    expect((await post("/signup", { email: "not-an-email", password: PW })).status).toBe(400);
  });

  it("SIGNUPS closed → 403", async () => {
    const res = await post("/signup", { email: "a@b.co", password: PW }, { MODE: "cloud", SIGNUPS: "closed" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Sign-ups are closed." });
  });

  it("self mode /signup → 404", async () => {
    expect((await post("/signup", { email: "a@b.co", password: PW }, {})).status).toBe(404);
  });

  it("6th sign-up from one IP → 429", async () => {
    for (let i = 0; i < 5; i++) expect((await post("/signup", { email: `u${i}@b.co`, password: PW }, CLOUD, "203.0.113.50")).status).toBe(201);
    expect((await post("/signup", { email: "u6@b.co", password: PW }, CLOUD, "203.0.113.50")).status).toBe(429);
    expect((await post("/signup", { email: "u6@b.co", password: PW }, CLOUD, "203.0.113.51")).status).toBe(201);
  });

  it("successful logins do not clear the sign-up limit", async () => {
    const ip = "203.0.113.60";
    await seedAccount("in@example.com", PW);
    for (let i = 0; i < 4; i++) expect((await post("/signup", { email: `s${i}@b.co`, password: PW }, CLOUD, ip)).status).toBe(201);
    expect((await post("/login", { email: "in@example.com", password: PW }, CLOUD, ip)).status).toBe(204);
    expect((await post("/signup", { email: "s4@b.co", password: PW }, CLOUD, ip)).status).toBe(201);
    expect((await post("/signup", { email: "s5@b.co", password: PW }, CLOUD, ip)).status).toBe(429);
  });

  it("sign-ups do not count toward the login limit", async () => {
    const ip = "203.0.113.61";
    await seedAccount("in@example.com", PW);
    for (let i = 0; i < 5; i++) expect((await post("/signup", { email: `t${i}@b.co`, password: PW }, CLOUD, ip)).status).toBe(201);
    expect((await post("/login", { email: "in@example.com", password: PW }, CLOUD, ip)).status).toBe(204);
  });

  it("an old cookie fails for a new account that reuses a deleted account's id", async () => {
    const idOf = async (email: string) => (await env.DB.prepare("SELECT id FROM accounts WHERE email = ?").bind(email).first<{ id: number }>())!.id;
    const first = await post("/signup", { email: "first@example.com", password: PW });
    expect(first.status).toBe(201);
    const oldCookie = cookieOf(first);
    const oldId = await idOf("first@example.com");
    expect((await apiCall(oldCookie, "DELETE", "/account", { password: PW }, CLOUD)).status).toBe(204);

    const second = await post("/signup", { email: "second@example.com", password: PW });
    expect(second.status).toBe(201);
    expect(await idOf("second@example.com")).toBe(oldId);
    expect((await apiCall(oldCookie, "GET", "/me", undefined, CLOUD)).status).toBe(401);
    expect((await apiCall(cookieOf(second), "GET", "/me", undefined, CLOUD)).status).toBe(200);
  });

  it("a new account starts at a random positive session generation", async () => {
    const gens = new Set<number>();
    for (let i = 0; i < 3; i++) {
      expect((await post("/signup", { email: `g${i}@example.com`, password: PW }, CLOUD, `203.0.113.7${i}`)).status).toBe(201);
      const { session_gen } = (await env.DB.prepare("SELECT session_gen FROM accounts WHERE email = ?").bind(`g${i}@example.com`).first<{ session_gen: number }>())!;
      expect(session_gen).toBeGreaterThan(0);
      expect(session_gen).toBeLessThan(2 ** 31);
      gens.add(session_gen);
    }
    expect(gens.size).toBe(3);
  });

  it("cloud login: right password → 204 + cookie, wrong → 401", async () => {
    const id = await seedAccount("you@example.com", PW);
    const ok = await post("/login", { email: " You@Example.com", password: PW });
    expect(ok.status).toBe(204);
    const me = await (await apiCall(cookieOf(ok), "GET", "/me", undefined, CLOUD)).json<Me>();
    expect(me.email).toBe("you@example.com");
    expect(id).toBeGreaterThan(1);

    const bad = await post("/login", { email: "you@example.com", password: "wrong password!!" });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: "Wrong email or password" });
    expect((await post("/login", { email: "nobody@example.com", password: PW })).status).toBe(401);
  });

  it("cloud login with the owner password and no email → 401", async () => {
    expect((await post("/login", { password: "test-password" })).status).toBe(401);
    expect((await post("/login", { email: "", password: "test-password" })).status).toBe(401);
  });

  it("an owner (account 1) cookie stops working in cloud mode", async () => {
    const owner = await sessionFor(1);
    expect((await apiCall(owner, "GET", "/me")).status).toBe(200);
    expect((await apiCall(owner, "GET", "/me", undefined, CLOUD)).status).toBe(401);
    expect((await apiCall(owner, "GET", "/sites", undefined, CLOUD)).status).toBe(401);
  });

  it("password change: old cookie 401, returned cookie 200, new password signs in", async () => {
    const id = await seedAccount("pw@example.com", PW);
    const old = await sessionFor(id);
    expect((await apiCall(old, "POST", "/account/password", { current: "wrong password!!", next: "another long password" }, CLOUD)).status).toBe(401);
    expect((await apiCall(old, "POST", "/account/password", { current: PW, next: "short" }, CLOUD)).status).toBe(400);
    const res = await apiCall(old, "POST", "/account/password", { current: PW, next: "another long password" }, CLOUD);
    expect(res.status).toBe(204);
    expect((await apiCall(old, "GET", "/me", undefined, CLOUD)).status).toBe(401);
    expect((await apiCall(cookieOf(res), "GET", "/me", undefined, CLOUD)).status).toBe(200);
    expect((await post("/login", { email: "pw@example.com", password: PW })).status).toBe(401);
    expect((await post("/login", { email: "pw@example.com", password: "another long password" })).status).toBe(204);
  });

  it("password change and delete are 404 in self mode", async () => {
    const owner = await sessionFor(1);
    expect((await apiCall(owner, "POST", "/account/password", { current: "test-password", next: "another long password" })).status).toBe(404);
    expect((await apiCall(owner, "DELETE", "/account", { password: "test-password" })).status).toBe(404);
  });

  it("delete account removes its sites, data and row; leaves other accounts alone; old cookie 401", async () => {
    const gone = await seedAccount("gone@example.com", PW);
    const kept = await seedAccount("kept@example.com", PW);
    await seedSite({ id: "gone1", account_id: gone, share_nonce: "n1" });
    await seedSite({ id: "kept1", account_id: kept, share_nonce: "n2" });
    const ev = { ts: 1, day: "2026-11-01", name: "pageview", path: "/", pl: null, visitor: "v", ref: null, tag: null, country: null, city: null, device: null, browser: null, os: null, props: null };
    await insertEvents([
      { ...ev, site_id: "gone1" },
      { ...ev, site_id: "kept1" },
    ]);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO daily (site_id, day, metric, dim, value) VALUES ('gone1', '2026-11-01', 'views', '', 1), ('kept1', '2026-11-01', 'views', '', 1)"),
      env.DB.prepare("INSERT INTO rollups (site_id, day, done) VALUES ('gone1', '2026-11-01', 1), ('kept1', '2026-11-01', 1)"),
      env.DB.prepare("INSERT INTO account_usage (account_id, day, events) VALUES (?, '2026-11-01', 5), (?, '2026-11-01', 5)").bind(gone, kept),
    ]);
    const cookie = await sessionFor(gone);

    expect((await apiCall(cookie, "DELETE", "/account", { password: "wrong password!!" }, CLOUD)).status).toBe(401);
    const res = await apiCall(cookie, "DELETE", "/account", { password: PW }, CLOUD);
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/lf_session=;/);

    const count = async (sql: string, ...args: unknown[]) => (await env.DB.prepare(sql).bind(...args).first<{ n: number }>())!.n;
    expect(await count("SELECT COUNT(*) AS n FROM accounts WHERE id = ?", gone)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM sites WHERE id = 'gone1'")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM events WHERE site_id = 'gone1'")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM daily WHERE site_id = 'gone1'")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM rollups WHERE site_id = 'gone1'")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM account_usage WHERE account_id = ?", gone)).toBe(0);

    expect(await count("SELECT COUNT(*) AS n FROM sites WHERE id = 'kept1'")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM events WHERE site_id = 'kept1'")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM daily WHERE site_id = 'kept1'")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM rollups WHERE site_id = 'kept1'")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM account_usage WHERE account_id = ?", kept)).toBe(1);

    expect((await apiCall(cookie, "GET", "/me", undefined, CLOUD)).status).toBe(401);
    expect((await apiCall(await sessionFor(kept), "GET", "/sites/kept1", undefined, CLOUD)).status).toBe(200);
  });

  it("delete account adds the rows it wrote to today's install usage", async () => {
    const gone = await seedAccount("gone@example.com", PW);
    await seedSite({ id: "gone1", account_id: gone, share_nonce: "n1" });
    const ev = { ts: 1, day: "2026-11-01", name: "pageview", path: "/", pl: null, visitor: "v", ref: null, tag: null, country: null, city: null, device: null, browser: null, os: null, props: null };
    await insertEvents([{ ...ev, site_id: "gone1" }]);
    expect((await apiCall(await sessionFor(gone), "DELETE", "/account", { password: PW }, CLOUD)).status).toBe(204);
    const day = new Date().toISOString().slice(0, 10);
    const u = await env.DB.prepare("SELECT rows_written FROM usage WHERE day = ?").bind(day).first<{ rows_written: number }>();
    expect(u?.rows_written ?? 0).toBeGreaterThan(0);
  });
});
