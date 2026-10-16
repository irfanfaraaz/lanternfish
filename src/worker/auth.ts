import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "./env";
import { b64url, fromB64url, hmacB64url, timingSafeEqual } from "./hash";
import { readShareToken } from "./share";

export const SESSION_COOKIE = "lf_session";
const SESSION_DAYS = 30;
// Free Workers get 10 ms of CPU per request; 100k iterations measured ~50 ms,
// 10k ~5 ms. Online guessing is rate-limited and the hash only lives in
// Worker secrets, so 10k is the right trade here. Stored hashes carry their
// count, so it can be raised on the paid plan.
const PBKDF2_ITER = 10_000;
const MAX_ITER = 100_000;
/** Refuse to sign or check anything with a missing or short secret. */
export const secretOk = (s: string | undefined): s is string => typeof s === "string" && s.length >= 16;

async function pbkdf2(pw: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

/** `pbkdf2$<iterations>$<salt b64url>$<hash b64url>` */
export async function hashPassword(pw: string, iterations = PBKDF2_ITER): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(await pbkdf2(pw, salt, iterations))}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  const n = Number(iter);
  if (scheme !== "pbkdf2" || !salt || !hash || !Number.isInteger(n) || n < 1 || n > MAX_ITER) return false;
  return timingSafeEqual(b64url(await pbkdf2(pw, fromB64url(salt), n)), hash);
}

export async function issueSession(secret: string, nowSec: number): Promise<string> {
  const exp = nowSec + SESSION_DAYS * 86_400;
  return `${exp}.${await hmacB64url(secret, `session:${exp}`)}`;
}

export async function verifySession(token: string | undefined, secret: string, nowSec: number): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  const n = Number(exp);
  if (!sig || !Number.isInteger(n) || n < nowSec) return false;
  return timingSafeEqual(sig, await hmacB64url(secret, `session:${n}`));
}

export type AuthVars = { owner: boolean; shareSite: string | null };
export type ApiEnv = { Bindings: Env; Variables: AuthVars };

// Read-only routes a share link may reach, for its own site only.
const SHARE_ROUTE = /^\/api\/sites\/([^/]+)(?:\/(?:stats|realtime))?$/;
const PUBLIC_API = new Set(["/api/login", "/api/health"]);

/** Sets c.var.owner / c.var.shareSite and blocks anything the caller may not reach. */
export const authenticate: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;
  if (["POST", "PATCH", "PUT"].includes(method) && !(c.req.header("content-type") ?? "").startsWith("application/json")) {
    return c.json({ error: "Send JSON" }, 415);
  }
  if (!secretOk(c.env.SESSION_SECRET)) return c.json({ error: "Lanternfish isn't set up yet: run `bun run setup`." }, 503);
  if (PUBLIC_API.has(path)) return next();

  const nowSec = Math.floor(Date.now() / 1000);
  const owner = await verifySession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET, nowSec);
  c.set("owner", owner);
  c.set("shareSite", null);
  if (owner) return next();

  const auth = c.req.header("authorization") ?? "";
  if (auth.startsWith("Share ") && method === "GET") {
    const site = await readShareToken(c.env, auth.slice(6), nowSec);
    const m = SHARE_ROUTE.exec(path);
    if (site && m?.[1] === site) {
      c.set("shareSite", site);
      return next();
    }
  }
  return c.json({ error: "Not signed in" }, 401);
};

const failures = new Map<string, { count: number; since: number }>();
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;

export function resetLoginFailures() {
  failures.clear();
}

export async function login(c: Context<ApiEnv>) {
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const now = Date.now();
  const f = failures.get(ip);
  if (f && now - f.since < WINDOW_MS && f.count >= MAX_FAILS) return c.json({ error: "Too many attempts. Try again in 15 minutes." }, 429);

  const body = await c.req.json<{ password?: unknown }>().catch(() => ({}) as { password?: unknown });
  const ok = typeof body.password === "string" && body.password.length <= 200 && (await verifyPassword(body.password, c.env.OWNER_PASSWORD_HASH ?? ""));
  if (!ok) {
    const cur = f && now - f.since < WINDOW_MS ? f : { count: 0, since: now };
    cur.count++;
    failures.set(ip, cur);
    return c.json({ error: "Wrong password" }, 401);
  }
  failures.delete(ip);
  setCookie(c, SESSION_COOKIE, await issueSession(c.env.SESSION_SECRET, Math.floor(now / 1000)), {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return c.body(null, 204);
}

export function logout(c: Context<ApiEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
  return c.body(null, 204);
}
