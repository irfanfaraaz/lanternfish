import { detectBot } from "../shared/bots";
import { MAX_BODY } from "../shared/constants";
import { compileExcludes } from "../shared/paths";
import type { ClientEvent, Site } from "../shared/types";
import { cleanProps, cutPath, parseBatch, validEvent } from "../shared/validate";
import type { Env } from "./env";
import { type EventRow, WRITES_PER_EVENT, insertEventsStmt, readCapped } from "./events";
import { geoFrom } from "./geo";
import { getSalt, visitorHash } from "./hash";
import { resolveClient } from "./origin";
import { allow } from "./ratelimit";
import { getSite } from "./sites";
import { localDay, utcDay } from "./time";
import { parseUA } from "./ua";
import { budget, todayUsage, usageStmt } from "./usage";

/** The tracker must never see an error: every answer is an empty 204. */
export function noContent(req: Request, extra: Record<string, string> = {}): Response {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = { "cache-control": "no-store", vary: "Origin", ...extra };
  if (origin) headers["access-control-allow-origin"] = origin;
  return new Response(null, { status: 204, headers });
}

export function preflight(req: Request): Response {
  return noContent(req, {
    "access-control-allow-methods": "POST",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  });
}

const excludeCache = new WeakMap<Site, (p: string) => boolean>();
export function isExcluded(site: Site, path: string): boolean {
  let m = excludeCache.get(site);
  if (!m) {
    m = compileExcludes(site.exclude_paths);
    excludeCache.set(site, m);
  }
  return m(path);
}

/** True when today's D1 writes have reached the configured budget. */
export async function overBudget(env: Env, nowMs: number): Promise<boolean> {
  const u = await todayUsage(env.DB, env, nowMs);
  return u.rows_written >= budget(env);
}

export async function ingest(req: Request, text: string, env: Env, nowMs: number): Promise<void> {
  const batch = parseBatch(text);
  if (!batch) return;
  const site = await getSite(env.DB, batch.s, nowMs);
  if (!site) return;
  const client = await resolveClient(req, site, Math.floor(nowMs / 1000));
  if (!client || detectBot(client.ua)) return;
  if (await overBudget(env, nowMs)) return;

  const salt = await getSalt(env.DB, utcDay(nowMs));
  const visitor = await visitorHash(salt, site.id, client.ip, client.ua);
  const valid = batch.e.filter((e) => validEvent(e) && !isExcluded(site, e.p));
  const allowed = allow(site.id, visitor, valid.length, nowMs);
  if (allowed === 0) return;

  const ua = parseUA(client.ua);
  const geo = geoFrom(req, client.proxied);
  const day = localDay(nowMs, site.timezone);
  const rows: EventRow[] = valid.slice(0, allowed).map((e: ClientEvent) => {
    const props = e.pr ? cleanProps(e.pr) : null;
    return {
      site_id: site.id,
      ts: nowMs,
      day,
      name: e.n,
      path: cutPath(e.p),
      pl: batch.pl,
      visitor,
      ref: e.r?.toLowerCase() ?? null,
      tag: e.t ?? null,
      country: geo.country,
      city: geo.city,
      device: ua.device,
      browser: ua.browser,
      os: ua.os,
      props: props && Object.keys(props).length > 0 ? JSON.stringify(props) : null,
    };
  });
  await env.DB.batch([
    insertEventsStmt(env.DB, rows),
    usageStmt(env.DB, utcDay(nowMs), 1, rows.length, rows.length * WRITES_PER_EVENT + 1),
  ]);
}

export async function handleIngest(req: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  const res = noContent(req);
  const text = await readCapped(req, MAX_BODY).catch(() => null);
  if (text === null) return res;
  ctx.waitUntil(
    ingest(req, text, env, Date.now()).catch((err: unknown) => {
      console.error("ingest failed", err instanceof Error ? err.message : err);
    }),
  );
  return res;
}
