const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function sha256Hex(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

async function hmacKey(key: string) {
  return crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function hmacHex(key: string, msg: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", await hmacKey(key), enc.encode(msg)));
}

export async function hmacB64url(key: string, msg: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await hmacKey(key), enc.encode(msg)));
}

/** Constant-time string comparison (length leak only). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Random base62 string (rejection-sampled, so unbiased). */
export function randomId(len: number): string {
  let out = "";
  while (out.length < len) {
    for (const b of crypto.getRandomValues(new Uint8Array(len * 2))) {
      if (b < 248 && out.length < len) out += BASE62[b % 62];
    }
  }
  return out;
}

const saltCache = new Map<string, string>();

/** Today's (or any day's) visitor salt, created on first use. */
export async function getSalt(db: D1Database, day: string): Promise<string> {
  const hit = saltCache.get(day);
  if (hit) return hit;
  const fresh = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await db.prepare("INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)").bind(day, fresh).run();
  const row = await db.prepare("SELECT salt FROM salts WHERE day = ?").bind(day).first<{ salt: string }>();
  const salt = row?.salt ?? fresh;
  if (saltCache.size > 4) saltCache.clear();
  saltCache.set(day, salt);
  return salt;
}

/** Spec §9: first 16 hex chars of SHA-256(daily_salt + site_id + ip + user_agent). */
export async function visitorHash(salt: string, siteId: string, ip: string, ua: string): Promise<string> {
  return (await sha256Hex(salt + siteId + ip + ua)).slice(0, 16);
}

/** For tests: forget cached salts. */
export function clearSaltCache() {
  saltCache.clear();
}
