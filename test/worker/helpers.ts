import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import type { Site } from "../../src/shared/types";
import { hashPassword, issueSession } from "../../src/worker/auth";
import type { Env } from "../../src/worker/env";
import { type EventRow, insertEventsStmt } from "../../src/worker/events";
import { clearSaltCache } from "../../src/worker/hash";
import worker from "../../src/worker/index";
import { resetRateLimits } from "../../src/worker/ratelimit";
import { clearSiteCache, insertSiteStmt } from "../../src/worker/sites";

export const SERVER_KEY = "S".repeat(32);
export const TEST_SECRET = "test-secret-0123456789";

export function makeSite(over: Partial<Site> = {}): Site {
  return {
    id: "abc123",
    account_id: 1,
    name: "Example",
    domains: ["example.com", "*.example.org"],
    timezone: "Pacific/Auckland",
    public: false,
    server_key: SERVER_KEY,
    exclude_paths: ["/admin/*"],
    funnel: ["hero", "work", "contact"],
    share_nonce: "nonce1",
    created: 1,
    ...over,
  };
}

/** Empties every data table and in-isolate cache, leaving only account 1 (session_gen 0). */
export async function reset() {
  await env.DB.batch([
    ...["events", "daily", "salts", "usage", "rollups", "sites", "account_usage"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
    env.DB.prepare("DELETE FROM accounts WHERE id <> 1"),
    env.DB.prepare("UPDATE accounts SET session_gen = 0 WHERE id = 1"),
  ]);
  clearSiteCache();
  clearSaltCache();
  resetRateLimits();
}

export async function seedSite(over: Partial<Site> = {}): Promise<Site> {
  const s = makeSite(over);
  await insertSiteStmt(env.DB, s).run();
  return s;
}

/** Adds an account with an email and password; returns its id. */
export async function seedAccount(email: string, password: string): Promise<number> {
  const row = await env.DB.prepare("INSERT INTO accounts (email, password_hash, created) VALUES (?, ?, unixepoch()) RETURNING id")
    .bind(email, await hashPassword(password))
    .first<{ id: number }>();
  return row!.id;
}

/** A session cookie (`lf_session=...`) for the account at its current session_gen. */
export async function sessionFor(accountId: number): Promise<string> {
  const row = await env.DB.prepare("SELECT session_gen FROM accounts WHERE id = ?").bind(accountId).first<{ session_gen: number }>();
  if (!row) throw new Error(`no account ${accountId}`);
  return `lf_session=${await issueSession(TEST_SECRET, accountId, row.session_gen, Math.floor(Date.now() / 1000))}`;
}

/** Calls the Worker and waits for its background work to finish. `envOver` is merged onto the test env. */
export async function call(req: Request, envOver: Partial<Env> = {}): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, { ...env, ...envOver }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

export function beacon(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://lf.test/e", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      origin: "https://example.com",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      "cf-connecting-ip": "203.0.113.7",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export async function storedEvents(): Promise<(EventRow & { id: number })[]> {
  const { results } = await env.DB.prepare("SELECT * FROM events ORDER BY id").all<EventRow & { id: number }>();
  return results;
}

export async function insertEvents(rows: EventRow[]) {
  for (let i = 0; i < rows.length; i += 500) await insertEventsStmt(env.DB, rows.slice(i, i + 500)).run();
}

/** Logs in as the owner and returns the session cookie. */
export async function login(ip = "198.51.100.200"): Promise<string> {
  const res = await call(
    new Request("https://lf.test/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify({ password: "test-password" }),
    }),
  );
  if (res.status !== 204) throw new Error(`login failed: ${res.status}`);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

/** Calls /api with the session cookie. */
export function apiCall(cookie: string, method: string, path: string, body?: unknown, envOver?: Partial<Env>): Promise<Response> {
  return call(
    new Request(`https://lf.test/api${path}`, {
      method,
      headers: { cookie, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    envOver,
  );
}
