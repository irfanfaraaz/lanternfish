import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import type { Site } from "../../src/shared/types";
import { type EventRow, insertEventsStmt } from "../../src/worker/events";
import { clearSaltCache } from "../../src/worker/hash";
import worker from "../../src/worker/index";
import { resetRateLimits } from "../../src/worker/ratelimit";
import { clearSiteCache, insertSiteStmt } from "../../src/worker/sites";

export const SERVER_KEY = "S".repeat(32);

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

/** Empties every data table and in-isolate cache. */
export async function reset() {
  await env.DB.batch(["events", "daily", "salts", "usage", "rollups", "sites"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  clearSiteCache();
  clearSaltCache();
  resetRateLimits();
}

export async function seedSite(over: Partial<Site> = {}): Promise<Site> {
  const s = makeSite(over);
  await insertSiteStmt(env.DB, s).run();
  return s;
}

/** Calls the Worker and waits for its background work to finish. */
export async function call(req: Request): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
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
export function apiCall(cookie: string, method: string, path: string, body?: unknown): Promise<Response> {
  return call(
    new Request(`https://lf.test/api${path}`, {
      method,
      headers: { cookie, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
