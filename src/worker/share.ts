import type { Site } from "../shared/types";
import type { Env } from "./env";
import { hmacB64url, timingSafeEqual } from "./hash";
import { getSite } from "./sites";

const msg = (siteId: string, exp: number, nonce: string) => `share:${siteId}:${exp}:${nonce}`;

/** `${siteId}.${exp}.${sig}`; `exp` 0 never expires. Rotating the site's share_nonce revokes every token. */
export async function makeShareToken(env: Pick<Env, "SESSION_SECRET">, site: Site, expSec: number): Promise<string> {
  return `${site.id}.${expSec}.${await hmacB64url(env.SESSION_SECRET, msg(site.id, expSec, site.share_nonce))}`;
}

/** The site id a valid token grants, or null. */
export async function readShareToken(env: Pick<Env, "SESSION_SECRET" | "DB">, token: string, nowSec: number): Promise<string | null> {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) return null;
  const [id, exp, sig] = token.split(".");
  const n = Number(exp);
  if (!id || !sig || !Number.isInteger(n) || (n !== 0 && n < nowSec)) return null;
  const site = await getSite(env.DB, id);
  if (!site?.share_nonce) return null;
  return timingSafeEqual(sig, await hmacB64url(env.SESSION_SECRET, msg(id, n, site.share_nonce))) ? id : null;
}
