import type { Context } from "hono";
import type { Me } from "../shared/types";
import { type ApiEnv, TOO_MANY, blocked, clearSessionCookie, clientIp, hashPassword, noteAttempt, noteSignup, setSessionCookie, signupBlocked, verifyPassword } from "./auth";
import { accountDailyEvents, accountDailyReads, accountMaxSites, isCloud, signupsOpen } from "./config";
import { retentionDays } from "./cron";
import { invalidateSite } from "./sites";
import { utcDay } from "./time";
import { usageStmt } from "./usage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAD_EMAIL = "Enter a valid email address.";
const BAD_PASSWORD = "Password must be 12 to 200 characters.";

/** Trimmed, lower-cased email, or null when it is not a plausible address. */
export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export const validPassword = (v: unknown): v is string => typeof v === "string" && v.length >= 12 && v.length <= 200;

const readBody = <T>(c: Context<ApiEnv>) => c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);

/** Sign-ups are possible only in cloud mode with SIGNUPS not "closed". */
const signupsOn = (c: Context<ApiEnv>) => isCloud(c.env) && signupsOpen(c.env);

/** Public: what the login page needs before anyone signs in. */
export function config(c: Context<ApiEnv>) {
  return c.json({ mode: isCloud(c.env) ? "cloud" : "self", signups: signupsOn(c) } satisfies Pick<Me, "mode" | "signups">);
}

export async function me(c: Context<ApiEnv>) {
  const cloud = isCloud(c.env);
  const accountId = c.get("accountId");
  const email =
    cloud && accountId !== null
      ? ((await c.env.DB.prepare("SELECT email FROM accounts WHERE id = ?").bind(accountId).first<{ email: string | null }>())?.email ?? null)
      : null;
  const body: Me = {
    owner: c.get("owner"),
    shareSite: c.get("shareSite"),
    retentionDays: retentionDays(c.env),
    mode: cloud ? "cloud" : "self",
    email,
    signups: signupsOn(c),
    limits: cloud && accountId !== null ? { events: accountDailyEvents(c.env), reads: accountDailyReads(c.env), sites: accountMaxSites(c.env) } : null,
  };
  return c.json(body);
}

/**
 * A random starting session generation (1 to 2^31 - 1). Account ids can be
 * reused after a delete, so a fresh account must not share a generation with
 * a deleted one's old cookies.
 */
export function freshSessionGen(): number {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return (n % 0x7fff_ffff) + 1;
}

/** POST /api/signup {email, password}: creates a cloud account and signs it in. Every attempt counts toward the sign-up limiter. */
export async function signup(c: Context<ApiEnv>) {
  if (!isCloud(c.env)) return c.json({ error: "Not found" }, 404);
  if (!signupsOpen(c.env)) return c.json({ error: "Sign-ups are closed." }, 403);
  const ip = clientIp(c);
  if (signupBlocked(ip)) return c.json({ error: TOO_MANY }, 429);
  noteSignup(ip);

  const body = await readBody<{ email: unknown; password: unknown }>(c);
  const email = normalizeEmail(body.email);
  if (!email) return c.json({ error: BAD_EMAIL }, 400);
  if (!validPassword(body.password)) return c.json({ error: BAD_PASSWORD }, 400);

  const row = await c.env.DB.prepare(
    "INSERT INTO accounts (email, password_hash, session_gen, created) VALUES (?, ?, ?, unixepoch()) ON CONFLICT (email) DO NOTHING RETURNING id, session_gen",
  )
    .bind(email, await hashPassword(body.password), freshSessionGen())
    .first<{ id: number; session_gen: number }>();
  if (!row) return c.json({ error: "That email already has an account. Sign in instead." }, 409);
  await setSessionCookie(c, row.id, row.session_gen);
  return c.json({ ok: true }, 201);
}

/** The signed-in cloud account's password hash, or null (self mode, share viewer, or no row). */
async function cloudAccount(c: Context<ApiEnv>): Promise<{ id: number; password_hash: string | null } | null> {
  const accountId = c.get("accountId");
  if (!isCloud(c.env) || accountId === null) return null;
  return c.env.DB.prepare("SELECT id, password_hash FROM accounts WHERE id = ?").bind(accountId).first<{ id: number; password_hash: string | null }>();
}

/** Checks `password` against the account, counting a wrong one toward the IP limiter. */
async function recheck(c: Context<ApiEnv>, hash: string | null, password: unknown): Promise<Response | null> {
  const ip = clientIp(c);
  if (blocked(ip)) return c.json({ error: TOO_MANY }, 429);
  if (typeof password === "string" && password.length <= 200 && hash && (await verifyPassword(password, hash))) return null;
  noteAttempt(ip);
  return c.json({ error: "Wrong password" }, 401);
}

/** POST /api/account/password {current, next}: signs out every other session and re-signs this one. */
export async function changePassword(c: Context<ApiEnv>) {
  if (!isCloud(c.env)) return c.json({ error: "Not found" }, 404);
  const acct = await cloudAccount(c);
  if (!acct) return c.json({ error: "Not signed in" }, 401);
  const body = await readBody<{ current: unknown; next: unknown }>(c);
  if (!validPassword(body.next)) return c.json({ error: BAD_PASSWORD }, 400);
  const wrong = await recheck(c, acct.password_hash, body.current);
  if (wrong) return wrong;

  const row = await c.env.DB.prepare("UPDATE accounts SET password_hash = ?, session_gen = session_gen + 1 WHERE id = ? RETURNING session_gen")
    .bind(await hashPassword(body.next), acct.id)
    .first<{ session_gen: number }>();
  if (!row) return c.json({ error: "Not signed in" }, 401);
  await setSessionCookie(c, acct.id, row.session_gen);
  return c.body(null, 204);
}

/** DELETE /api/account {password}: removes the account, its sites and all their data in one batch. */
export async function deleteAccount(c: Context<ApiEnv>) {
  if (!isCloud(c.env)) return c.json({ error: "Not found" }, 404);
  const acct = await cloudAccount(c);
  if (!acct) return c.json({ error: "Not signed in" }, 401);
  const body = await readBody<{ password: unknown }>(c);
  const wrong = await recheck(c, acct.password_hash, body.password);
  if (wrong) return wrong;

  const db = c.env.DB;
  const { results } = await db.prepare("SELECT id FROM sites WHERE account_id = ?").bind(acct.id).all<{ id: string }>();
  const ofAccount = "site_id IN (SELECT id FROM sites WHERE account_id = ?)";
  const res = await db.batch([
    db.prepare(`DELETE FROM events WHERE ${ofAccount}`).bind(acct.id),
    db.prepare(`DELETE FROM daily WHERE ${ofAccount}`).bind(acct.id),
    db.prepare(`DELETE FROM rollups WHERE ${ofAccount}`).bind(acct.id),
    db.prepare("DELETE FROM sites WHERE account_id = ?").bind(acct.id),
    db.prepare("DELETE FROM account_usage WHERE account_id = ?").bind(acct.id),
    db.prepare("DELETE FROM accounts WHERE id = ?").bind(acct.id),
  ]);
  for (const s of results) invalidateSite(s.id);
  const written = res.reduce((n, r) => n + (r.meta.rows_written ?? 0), 0);
  if (written) await usageStmt(db, utcDay(Date.now()), 0, 0, written).run();
  clearSessionCookie(c);
  return c.body(null, 204);
}
