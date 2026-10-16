/** One row of the `events` table, without its id. */
export interface EventRow {
  site_id: string;
  ts: number;
  day: string;
  name: string;
  path: string | null;
  pl: string | null;
  visitor: string | null;
  ref: string | null;
  tag: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  props: string | null;
}

/** Rows written per event insert: the row plus the one index. */
export const WRITES_PER_EVENT = 2;

export function insertEventStmt(db: D1Database, r: EventRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO events (site_id, ts, day, name, path, pl, visitor, ref, tag, country, city, device, browser, os, props)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(r.site_id, r.ts, r.day, r.name, r.path, r.pl, r.visitor, r.ref, r.tag, r.country, r.city, r.device, r.browser, r.os, r.props);
}

const COLS = ["site_id", "ts", "day", "name", "path", "pl", "visitor", "ref", "tag", "country", "city", "device", "browser", "os", "props"] as const;

/**
 * Inserts many rows in ONE statement: the rows travel as a single JSON
 * parameter and SQLite unpacks them with json_each. This keeps a batch of 50
 * events to one D1 query (free plan: 50 queries per invocation, 100 bound
 * parameters per query).
 */
export function insertEventsStmt(db: D1Database, rows: EventRow[]): D1PreparedStatement {
  const select = COLS.map((_, i) => `json_extract(value, '$[${i}]')`).join(", ");
  return db
    .prepare(`INSERT INTO events (${COLS.join(", ")}) SELECT ${select} FROM json_each(?)`)
    .bind(JSON.stringify(rows.map((r) => COLS.map((c) => r[c]))));
}

/** Reads a request body as text, giving up once it passes `max` bytes. */
export async function readCapped(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
