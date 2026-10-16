import type { EventRow } from "./events";
import type { Meter } from "./usage";

const COLUMNS = ["ts", "day", "name", "path", "pl", "visitor", "ref", "tag", "country", "city", "device", "browser", "os", "props"] as const;

/**
 * RFC 4180 field, quoted when it holds a comma, quote or line break. Values a
 * spreadsheet would run as a formula (=, +, -, @, tab, CR) get a leading
 * apostrophe, since paths and props come from untrusted browsers.
 */
export function csvField(v: string | number | null): string {
  if (v === null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(r: EventRow): string {
  return COLUMNS.map((c) => csvField(c === "ts" ? new Date(r.ts).toISOString() : r[c])).join(",") + "\r\n";
}

const PAGE = 10_000;
/** Stay under the free plan's 50 D1 queries per invocation. */
export const MAX_PAGES = 40;
export const MAX_EXPORT_ROWS = PAGE * MAX_PAGES;

/**
 * Streams a site's raw events for a day range, 10,000 rows per query and at
 * most 400,000 rows per download (the dashboard says so; export a shorter
 * range for more).
 */
export function exportCsv(db: D1Database, siteId: string, from: string, to: string, meter?: Meter, onDone?: () => void): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let lastId = 0;
  let pages = 0;
  let started = false;
  return new ReadableStream({
    async pull(ctrl) {
      if (!started) {
        started = true;
        ctrl.enqueue(enc.encode(COLUMNS.join(",") + "\r\n"));
      }
      const r = await db
        .prepare("SELECT * FROM events WHERE site_id = ? AND day >= ? AND day <= ? AND id > ? ORDER BY id LIMIT ?")
        .bind(siteId, from, to, lastId, PAGE)
        .all<EventRow & { id: number }>();
      meter?.add(r.meta);
      pages++;
      if (r.results.length) {
        lastId = r.results[r.results.length - 1]!.id;
        ctrl.enqueue(enc.encode(r.results.map(csvLine).join("")));
      }
      if (r.results.length < PAGE || pages >= MAX_PAGES) {
        ctrl.close();
        onDone?.();
      }
    },
  });
}
