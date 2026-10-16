// Lanternfish helpers for a Next.js site. Copy to lib/lanternfish.ts.
// Environment variables:
//   LF_ORIGIN      your Lanternfish Worker, e.g. https://lanternfish.example.workers.dev
//   LF_SITE        the site id from the dashboard
//   LF_SERVER_KEY  the site's server key (keep it secret)

type Cfg = { origin: string; site: string; key: string };

function config(): Cfg | null {
  const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  const { LF_ORIGIN: origin, LF_SITE: site, LF_SERVER_KEY: key } = env;
  return origin && site && key ? { origin: origin.replace(/\/$/, ""), site, key } : null;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** HMAC-SHA256 of `${ts}\n${origin}\n${ip}\n${ua}` with the server key, as hex. */
export async function lfSignature(key: string, ts: string, origin: string, ip: string, ua: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(`${ts}\n${origin}\n${ip}\n${ua}`)));
}

export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
}

/** Headers that tell Lanternfish who the browser was, signed so they can't be forged. */
export async function proxyHeaders(h: Headers, key: string, nowSec = Math.floor(Date.now() / 1000)): Promise<Record<string, string>> {
  const o = h.get("origin");
  const origin = o && o !== "null" ? o : `https://${h.get("host") ?? ""}`;
  const ip = clientIp(h);
  const ua = h.get("user-agent") ?? "";
  const ts = String(nowSec);
  return {
    "content-type": "text/plain",
    "x-lf-ts": ts,
    "x-lf-origin": origin,
    "x-lf-ip": ip,
    "x-lf-ua": ua,
    "x-lf-country": h.get("x-vercel-ip-country") ?? "",
    "x-lf-city": h.get("x-vercel-ip-city") ?? "",
    "x-lf-sig": await lfSignature(key, ts, origin, ip, ua),
  };
}

/** Forwards a tracker beacon to the Worker. Never throws. */
export async function forwardBeacon(h: Headers, body: string): Promise<void> {
  const cfg = config();
  if (!cfg || !body || body.length > 8192) return;
  try {
    await fetch(`${cfg.origin}/e`, { method: "POST", headers: await proxyHeaders(h, cfg.key), body });
  } catch {}
}

/** Records a crawler or AI agent fetching `path`. Never throws. */
export async function sendAgent(path: string, ua: string): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  try {
    await fetch(`${cfg.origin}/s`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-lf-key": cfg.key },
      body: JSON.stringify({ site: cfg.site, name: "agent", path, ua }),
    });
  } catch {}
}
