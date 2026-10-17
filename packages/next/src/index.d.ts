export interface LanternfishProps {
  /** Your Lanternfish Worker. Defaults to LF_ORIGIN. */
  origin?: string;
  /** The site id. Defaults to LF_SITE. */
  site?: string;
  /** Where the browser sends events. Defaults to "/api/e" when LF_SERVER_KEY is set, else straight to the Worker. Pass false to never proxy. */
  api?: string | false;
}
/** The tracker's script tag. Put it in your root layout. Renders nothing until LF_ORIGIN and LF_SITE are set. */
export declare function Lanternfish(props: LanternfishProps): import("react").ReactElement | null;
/** Route handler for app/api/e/route.ts: answers at once, then forwards the beacon signed with LF_SERVER_KEY. */
export declare function POST(req: Request): Promise<Response>;
/** True when the user agent is a known crawler or AI agent. */
export declare function isKnownBot(ua: string): boolean;
/** Logs the request if a known crawler or AI agent made it. Call it from your own proxy or middleware. */
export declare function logAgent(req: Request): void;
/** Forwards a tracker beacon to the Worker. Never throws. */
export declare function forwardBeacon(h: Headers, body: string): Promise<void>;
/** Records a crawler or AI agent fetching `path`. Never throws. */
export declare function sendAgent(path: string, ua: string): Promise<void>;
/** Headers that tell Lanternfish who the browser was, signed so they can't be forged. */
export declare function proxyHeaders(h: Headers, key: string, nowSec?: number): Promise<Record<string, string>>;
/** HMAC-SHA256 of `${ts}\n${origin}\n${ip}\n${ua}` with the server key, as hex. */
export declare function lfSignature(key: string, ts: string, origin: string, ip: string, ua: string): Promise<string>;
export declare function clientIp(h: Headers): string;
