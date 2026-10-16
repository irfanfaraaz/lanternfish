import type { Site } from "../shared/types";

export interface SiteRow {
  id: string;
  account_id: number;
  name: string | null;
  domains: string | null;
  timezone: string | null;
  public: number | null;
  server_key: string | null;
  exclude_paths: string | null;
  funnel: string | null;
  share_nonce: string | null;
  created: number | null;
}

const list = (s: string | null): string[] => {
  if (!s) return [];
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export function rowToSite(r: SiteRow): Site {
  return {
    id: r.id,
    account_id: r.account_id,
    name: r.name ?? "",
    domains: list(r.domains),
    timezone: r.timezone ?? "UTC",
    public: r.public === 1,
    server_key: r.server_key ?? "",
    exclude_paths: list(r.exclude_paths),
    funnel: list(r.funnel),
    share_nonce: r.share_nonce ?? "",
    created: r.created ?? 0,
  };
}

export function siteToRow(s: Site): SiteRow {
  return {
    id: s.id,
    account_id: s.account_id,
    name: s.name,
    domains: JSON.stringify(s.domains),
    timezone: s.timezone,
    public: s.public ? 1 : 0,
    server_key: s.server_key,
    exclude_paths: JSON.stringify(s.exclude_paths),
    funnel: JSON.stringify(s.funnel),
    share_nonce: s.share_nonce,
    created: s.created,
  };
}

const TTL_MS = 60_000;
const cache = new Map<string, { site: Site | null; at: number }>();

/** Site by id, cached per isolate for a minute (negative results too). */
export async function getSite(db: D1Database, id: string, nowMs = Date.now()): Promise<Site | null> {
  const hit = cache.get(id);
  if (hit && nowMs - hit.at < TTL_MS) return hit.site;
  const row = await db.prepare("SELECT * FROM sites WHERE id = ?").bind(id).first<SiteRow>();
  const site = row ? rowToSite(row) : null;
  if (cache.size > 1000) cache.clear();
  cache.set(id, { site, at: nowMs });
  return site;
}

export function invalidateSite(id: string) {
  cache.delete(id);
}

export function clearSiteCache() {
  cache.clear();
}

export async function listSites(db: D1Database, accountId: number): Promise<Site[]> {
  const { results } = await db.prepare("SELECT * FROM sites WHERE account_id = ? ORDER BY created").bind(accountId).all<SiteRow>();
  return results.map(rowToSite);
}

export function insertSiteStmt(db: D1Database, s: Site): D1PreparedStatement {
  const r = siteToRow(s);
  return db
    .prepare(
      `INSERT INTO sites (id, account_id, name, domains, timezone, public, server_key, exclude_paths, funnel, share_nonce, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(r.id, r.account_id, r.name, r.domains, r.timezone, r.public, r.server_key, r.exclude_paths, r.funnel, r.share_nonce, r.created);
}

export function updateSiteStmt(db: D1Database, s: Site): D1PreparedStatement {
  const r = siteToRow(s);
  return db
    .prepare(
      `UPDATE sites SET name = ?, domains = ?, timezone = ?, public = ?, server_key = ?, exclude_paths = ?, funnel = ?, share_nonce = ?
       WHERE id = ? AND account_id = ?`,
    )
    .bind(r.name, r.domains, r.timezone, r.public, r.server_key, r.exclude_paths, r.funnel, r.share_nonce, r.id, r.account_id);
}
