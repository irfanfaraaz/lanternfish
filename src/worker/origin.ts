import type { Site } from "../shared/types";
import { hmacHex, timingSafeEqual } from "./hash";

const MAX_SKEW_S = 300;

/** Exact hostname match, or `*.example.com` matching any subdomain (not the apex). */
export function hostAllowed(host: string, domains: string[]): boolean {
  const h = host.toLowerCase();
  return domains.some((d) => (d.startsWith("*.") ? h.endsWith(d.slice(1)) && h.length > d.length - 1 : h === d));
}

function originHost(origin: string | null): string | null {
  if (!origin || origin === "null") return null;
  try {
    const u = new URL(origin);
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname : null;
  } catch {
    return null;
  }
}

/** The message a site's proxy signs; shared with the Next.js snippet. */
export function proxySigMessage(ts: string, origin: string, ip: string, ua: string): string {
  return `${ts}\n${origin}\n${ip}\n${ua}`;
}

export interface Client {
  ip: string;
  ua: string;
  origin: string;
  proxied: boolean;
}

/**
 * Who sent this request. Signed proxy headers win when present and valid;
 * otherwise the browser's own Origin must be one of the site's domains.
 */
export async function resolveClient(req: Request, site: Site, nowSec: number): Promise<Client | null> {
  const h = req.headers;
  const sig = h.get("x-lf-sig");
  if (sig) {
    const ts = h.get("x-lf-ts") ?? "";
    const origin = h.get("x-lf-origin") ?? "";
    const ip = h.get("x-lf-ip") ?? "";
    const ua = h.get("x-lf-ua") ?? "";
    const tsNum = Number(ts);
    if (!Number.isInteger(tsNum) || Math.abs(nowSec - tsNum) > MAX_SKEW_S || !ip) return null;
    const host = originHost(origin);
    if (!host || !hostAllowed(host, site.domains)) return null;
    const want = await hmacHex(site.server_key, proxySigMessage(ts, origin, ip, ua));
    return timingSafeEqual(sig.toLowerCase(), want) ? { ip, ua, origin, proxied: true } : null;
  }
  const origin = h.get("origin");
  const host = originHost(origin);
  if (!origin || !host || !hostAllowed(host, site.domains)) return null;
  return { ip: h.get("cf-connecting-ip") ?? "", ua: h.get("user-agent") ?? "", origin, proxied: false };
}
