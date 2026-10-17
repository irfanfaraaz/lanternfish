// lanternfish-next: the Lanternfish tracker, its same-origin proxy route and
// AI-agent logging for a Next.js App Router site.
import { after } from "next/server.js";
import { createElement } from "react";
import { forwardBeacon, sendAgent } from "../../../snippets/nextjs/lib/lanternfish";
import { KNOWN_BOTS } from "../../../src/shared/bots";

export { clientIp, forwardBeacon, lfSignature, proxyHeaders, sendAgent } from "../../../snippets/nextjs/lib/lanternfish";

const env = (k: string): string | undefined => (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env?.[k];

export interface LanternfishProps {
  /** Your Lanternfish Worker. Defaults to LF_ORIGIN. */
  origin?: string;
  /** The site id. Defaults to LF_SITE. */
  site?: string;
  /** Where the browser sends events. Defaults to "/api/e" when LF_SERVER_KEY is set, else straight to the Worker. Pass false to never proxy. */
  api?: string | false;
}

/** The tracker's script tag. Put it in your root layout. Renders nothing until LF_ORIGIN and LF_SITE are set. */
export function Lanternfish({ origin = env("LF_ORIGIN"), site = env("LF_SITE"), api }: LanternfishProps) {
  if (!origin || !site) return null;
  const route = api ?? (env("LF_SERVER_KEY") ? "/api/e" : false);
  return createElement("script", {
    defer: true,
    src: `${origin.replace(/\/$/, "")}/lf.js`,
    "data-site": site,
    ...(route ? { "data-api": route } : {}),
  });
}

/** Route handler for app/api/e/route.ts: answers at once, then forwards the beacon signed with LF_SERVER_KEY. */
export async function POST(req: Request): Promise<Response> {
  const body = await req.text().catch(() => "");
  after(() => forwardBeacon(req.headers, body));
  return new Response(null, { status: 204 });
}

export const isKnownBot = (ua: string): boolean => KNOWN_BOTS.some((b) => b.pattern.test(ua));

/** Logs the request if a known crawler or AI agent made it. Call it from your own proxy or middleware. */
export function logAgent(req: Request): void {
  const ua = req.headers.get("user-agent") ?? "";
  if (!isKnownBot(ua)) return;
  const path = new URL(req.url).pathname;
  after(() => sendAgent(path, ua));
}
