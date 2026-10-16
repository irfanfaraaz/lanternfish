import { detectBot } from "../shared/bots";
import { MAX_BODY, MAX_STR } from "../shared/constants";
import type { Props, ServerEventBody } from "../shared/types";
import { cleanProps, cutPath, validName, validNamedProps } from "../shared/validate";
import type { Env } from "./env";
import { WRITES_PER_EVENT, insertEventStmt, readCapped } from "./events";
import { getSalt, timingSafeEqual, visitorHash } from "./hash";
import { isExcluded, overBudget } from "./ingest";
import { getSite } from "./sites";
import { localDay, utcDay } from "./time";
import { parseUA } from "./ua";
import { usageStmt } from "./usage";

function parseBody(text: string): ServerEventBody | null {
  try {
    const v = JSON.parse(text) as Record<string, unknown>;
    if (typeof v !== "object" || v === null || typeof v.site !== "string" || !validName(v.name)) return null;
    const str = (x: unknown, max: number) => (typeof x === "string" && x.length <= max ? x : undefined);
    const props = v.props === undefined ? {} : cleanProps(v.props);
    if (!props) return null;
    const out: ServerEventBody = { site: v.site, name: v.name, props };
    const ip = str(v.ip, 64);
    const ua = str(v.ua, 512);
    const path = str(v.path, 2000);
    if (ip) out.ip = ip;
    if (ua) out.ua = ua;
    if (path?.startsWith("/")) out.path = path;
    return out;
  } catch {
    return null;
  }
}

export async function serverEvent(req: Request, text: string, env: Env, nowMs: number): Promise<void> {
  const body = parseBody(text);
  if (!body) return;
  const site = await getSite(env.DB, body.site, nowMs);
  const key = req.headers.get("x-lf-key") ?? "";
  if (!site || !site.server_key || !timingSafeEqual(key, site.server_key)) return;

  const props: Props = { ...body.props };
  const ua = body.ua ?? "";
  if (body.name === "agent") {
    props.bot ??= (detectBot(ua) ?? "other").slice(0, MAX_STR);
    props.path ??= cutPath(body.path ?? "/");
  }
  if (!validNamedProps(body.name, props)) return;
  const path = typeof props.path === "string" ? cutPath(props.path) : body.path ? cutPath(body.path) : null;
  if (path && isExcluded(site, path)) return;
  if (await overBudget(env, nowMs)) return;

  // Agents are not people, so they get no visitor hash. Other server events
  // may pass ip + ua to count against the same daily visitor as the browser.
  let visitor: string | null = null;
  if (body.name !== "agent" && body.ip && body.ua) {
    visitor = await visitorHash(await getSalt(env.DB, utcDay(nowMs)), site.id, body.ip, body.ua);
  }
  const parsed = ua ? parseUA(ua) : null;
  await env.DB.batch([
    insertEventStmt(env.DB, {
      site_id: site.id,
      ts: nowMs,
      day: localDay(nowMs, site.timezone),
      name: body.name,
      path,
      pl: null,
      visitor,
      ref: null,
      tag: null,
      country: null,
      city: null,
      device: parsed?.device ?? null,
      browser: parsed?.browser ?? null,
      os: parsed?.os ?? null,
      props: Object.keys(props).length > 0 ? JSON.stringify(props) : null,
    }),
    usageStmt(env.DB, utcDay(nowMs), 1, 1, WRITES_PER_EVENT + 1),
  ]);
}

export async function handleServerEvent(req: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  const res = new Response(null, { status: 204 });
  const text = await readCapped(req, MAX_BODY).catch(() => null);
  if (text === null) return res;
  ctx.waitUntil(
    serverEvent(req, text, env, Date.now()).catch((err: unknown) => {
      console.error("server event failed", err instanceof Error ? err.message : err);
    }),
  );
  return res;
}
