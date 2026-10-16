import { BOUNCE_MS, RESERVED } from "../shared/constants";
import type { Site } from "../shared/types";
import type { EventRow } from "./events";

export interface DailyRow {
  metric: string;
  dim: string;
  value: number;
}

/** The columns rollups and raw stats need; `props` stays a JSON string. */
export type StatRow = Pick<EventRow, "name" | "path" | "pl" | "visitor" | "ref" | "tag" | "country" | "device" | "browser" | "os" | "props" | "ts">;
export const STAT_COLUMNS = "name, path, pl, visitor, ref, tag, country, device, browser, os, props, ts";

const reserved = new Set<string>(RESERVED);

function parseProps(s: string | null): Record<string, string | number> {
  if (!s) return {};
  try {
    return JSON.parse(s) as Record<string, string | number>;
  } catch {
    return {};
  }
}

/** Nearest-rank percentile of unsorted values (0 < p ≤ 1). */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
}

class Counter {
  readonly m = new Map<string, number>();
  add(metric: string, dim: string, n = 1) {
    const k = `${metric}\u0000${dim}`;
    this.m.set(k, (this.m.get(k) ?? 0) + n);
  }
  rows(): DailyRow[] {
    return [...this.m].map(([k, value]) => {
      const [metric, dim] = k.split("\u0000") as [string, string];
      return { metric, dim, value };
    });
  }
}

/**
 * Every daily metric for one site-day, from raw rows. Pure, so the stats
 * engine reuses it for days not rolled up yet and for filtered views.
 *
 * Metrics (metric → dim): views, uniques, loads, bounces, visible_ms_p50 → '';
 * path, ref, tag, country, device, browser, os → value (pageviews);
 * event:<name> → '' (custom events); prop:<name> → key=value;
 * section:<name> → '' (distinct loads); outbound → host; not_found → path;
 * agent:<bot> → path; vitals_p75:<lcp|inp|cls> → path (cls ×1000).
 */
export function computeDay(rows: StatRow[]): DailyRow[] {
  const c = new Counter();
  const visitors = new Set<string>();
  const loads = new Map<string, { views: number; ms: number }>();
  const viewMs = new Map<string, number>();
  const sections = new Map<string, Set<string>>();
  const vitals = new Map<string, number[]>();

  for (const r of rows) {
    const props = parseProps(r.props);
    const path = r.path ?? "";
    switch (r.name) {
      case "pageview": {
        c.add("views", "");
        if (r.visitor) visitors.add(r.visitor);
        if (r.pl) {
          const l = loads.get(r.pl) ?? { views: 0, ms: 0 };
          l.views++;
          loads.set(r.pl, l);
        }
        c.add("path", path);
        if (r.ref) c.add("ref", r.ref);
        if (r.tag) c.add("tag", r.tag);
        if (r.country) c.add("country", r.country);
        if (r.device) c.add("device", r.device);
        if (r.browser) c.add("browser", r.browser);
        if (r.os) c.add("os", r.os);
        break;
      }
      case "leave": {
        const ms = typeof props.ms === "number" ? props.ms : 0;
        if (r.pl) {
          const l = loads.get(r.pl) ?? { views: 0, ms: 0 };
          l.ms += ms;
          loads.set(r.pl, l);
          const k = `${r.pl} ${path}`;
          viewMs.set(k, (viewMs.get(k) ?? 0) + ms);
        }
        break;
      }
      case "section_seen": {
        const s = String(props.section ?? "");
        if (s && r.pl) {
          let set = sections.get(s);
          if (!set) sections.set(s, (set = new Set()));
          set.add(r.pl);
        }
        break;
      }
      case "outbound":
        if (props.host) c.add("outbound", String(props.host));
        break;
      case "not_found":
        c.add("not_found", path);
        break;
      case "agent":
        c.add(`agent:${props.bot ?? "other"}`, String(props.path ?? path));
        break;
      case "vitals":
        for (const m of ["lcp", "inp", "cls"] as const) {
          const v = props[m];
          if (typeof v !== "number") continue;
          const k = `${m} ${path}`;
          let list = vitals.get(k);
          if (!list) vitals.set(k, (list = []));
          list.push(m === "cls" ? Math.round(v * 1000) : Math.round(v));
        }
        break;
      default:
        if (reserved.has(r.name)) break;
        c.add(`event:${r.name}`, "");
        for (const [k, v] of Object.entries(props)) c.add(`prop:${r.name}`, `${k}=${v}`);
    }
  }

  const out = c.rows();
  if (visitors.size) out.push({ metric: "uniques", dim: "", value: visitors.size });
  const pageLoads = [...loads.values()].filter((l) => l.views > 0);
  if (pageLoads.length) {
    out.push({ metric: "loads", dim: "", value: pageLoads.length });
    out.push({ metric: "bounces", dim: "", value: pageLoads.filter((l) => l.views === 1 && l.ms < BOUNCE_MS).length });
  }
  if (viewMs.size) out.push({ metric: "visible_ms_p50", dim: "", value: Math.round(percentile([...viewMs.values()], 0.5)) });
  for (const [s, set] of sections) out.push({ metric: `section:${s}`, dim: "", value: set.size });
  for (const [k, list] of vitals) {
    const i = k.indexOf(" ");
    out.push({ metric: `vitals_p75:${k.slice(0, i)}`, dim: k.slice(i + 1), value: percentile(list, 0.75) });
  }
  return out;
}

export async function loadRows(db: D1Database, siteId: string, day: string): Promise<StatRow[]> {
  const { results } = await db.prepare(`SELECT ${STAT_COLUMNS} FROM events WHERE site_id = ? AND day = ?`).bind(siteId, day).all<StatRow>();
  return results;
}

/** Recomputes one site-day into `daily` in one batch of 3 statements. Idempotent. Returns D1 rows written. */
export async function rollupDay(db: D1Database, site: Site, day: string, nowMs = Date.now()): Promise<number> {
  const rows = computeDay(await loadRows(db, site.id, day));
  const res = await db.batch([
    db.prepare("DELETE FROM daily WHERE site_id = ? AND day = ?").bind(site.id, day),
    db
      .prepare(
        `INSERT INTO daily (site_id, day, metric, dim, value)
         SELECT ?1, ?2, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]') FROM json_each(?3)`,
      )
      .bind(site.id, day, JSON.stringify(rows.map((r) => [r.metric, r.dim, r.value]))),
    db.prepare("INSERT OR REPLACE INTO rollups (site_id, day, done) VALUES (?, ?, ?)").bind(site.id, day, nowMs),
  ]);
  return res.reduce((n, r) => n + (r.meta.rows_written ?? 0), 0);
}
