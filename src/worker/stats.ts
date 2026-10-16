import type { Filters, Range, Row, SeriesPoint, Site, Stats, Totals } from "../shared/types";
import { type DailyRow, STAT_COLUMNS, type StatRow, computeDay } from "./rollup";
import { addDays, daysBetween, localDay, localHour } from "./time";
import type { Meter } from "./usage";

type DayRow = StatRow & { day: string };
const TOP = 100;
/** Bound parameters per D1 query is 100; keep headroom. */
const MAX_PARAMS = 90;

/** Day filters that SQL can apply per event. ref, tag and event apply per page load, in JS. */
const SQL_DIMS = ["path", "country", "device", "browser", "os"] as const;

/** Raw rows for the given days only, oldest first, with per-event filters applied in SQL. */
async function loadDays(db: D1Database, siteId: string, days: string[], filters: Filters, meter?: Meter): Promise<DayRow[]> {
  const where: string[] = [];
  const extra: string[] = [];
  for (const d of SQL_DIMS) {
    const v = filters[d];
    if (v) {
      where.push(`${d} = ?`);
      extra.push(v);
    }
  }
  const out: DayRow[] = [];
  const chunk = MAX_PARAMS - 1 - extra.length;
  for (let i = 0; i < days.length; i += chunk) {
    const part = days.slice(i, i + chunk);
    const sql = `SELECT day, ${STAT_COLUMNS} FROM events WHERE site_id = ? AND day IN (${part.map(() => "?").join(", ")})${where.map((w) => ` AND ${w}`).join("")} ORDER BY ts`;
    const r = await db
      .prepare(sql)
      .bind(siteId, ...part, ...extra)
      .all<DayRow>();
    meter?.add(r.meta);
    out.push(...r.results);
  }
  return out;
}

const LOAD_DIMS = ["ref", "tag", "event"] as const;

/**
 * Filters apply per event for path and per-visitor columns (country, device,
 * browser, os). For ref, tag and event they apply per page load: a load
 * matches if it had that referrer, tag or event, and all its events are kept.
 */
export function applyFilters(rows: DayRow[], f: Filters): DayRow[] {
  let out = rows;
  if (f.path) out = out.filter((r) => r.path === f.path);
  for (const dim of ["country", "device", "browser", "os"] as const) {
    const v = f[dim];
    if (v) out = out.filter((r) => r[dim] === v);
  }
  for (const dim of LOAD_DIMS) {
    const v = f[dim];
    if (!v) continue;
    const hit = (r: DayRow) => (dim === "event" ? r.name === v : r[dim] === v);
    const loads = new Set(out.filter((r) => hit(r) && r.pl).map((r) => r.pl));
    out = out.filter((r) => (r.pl ? loads.has(r.pl) : hit(r)));
  }
  return out;
}

function groupByDay(rows: DayRow[]): Map<string, DayRow[]> {
  const m = new Map<string, DayRow[]>();
  for (const r of rows) {
    let list = m.get(r.day);
    if (!list) m.set(r.day, (list = []));
    list.push(r);
  }
  return m;
}

/** The site's first local day; earlier days hold no data and are never read. */
function firstDay(site: Site): string {
  return localDay(Math.max(0, site.created) * 1000, site.timezone);
}

/** Per-day metric rows for a range: rolled-up days from `daily`, only the rest from raw events. */
async function dailyFor(
  db: D1Database,
  site: Site,
  range: Range,
  filters: Filters,
  forceRaw: boolean,
  meter?: Meter,
): Promise<{ perDay: Map<string, DailyRow[]>; raw: DayRow[] }> {
  const perDay = new Map<string, DailyRow[]>();
  const filtered = Object.keys(filters).length > 0;
  const start = firstDay(site);
  const days = daysBetween(range.from > start ? range.from : start, range.to);
  if (!days.length) return { perDay, raw: [] };
  let rawDays: string[];

  if (filtered || forceRaw) {
    rawDays = days;
  } else {
    const res = await db.batch([
      db.prepare("SELECT day FROM rollups WHERE site_id = ? AND day >= ? AND day <= ?").bind(site.id, days[0], range.to),
      db.prepare("SELECT day, metric, dim, value FROM daily WHERE site_id = ? AND day >= ? AND day <= ?").bind(site.id, days[0], range.to),
    ]);
    meter?.addAll(res);
    const [rolled, daily] = res;
    const rolledDays = new Set((rolled!.results as { day: string }[]).map((r) => r.day));
    for (const r of daily!.results as (DailyRow & { day: string })[]) {
      let list = perDay.get(r.day);
      if (!list) perDay.set(r.day, (list = []));
      list.push({ metric: r.metric, dim: r.dim, value: r.value });
    }
    rawDays = days.filter((d) => !rolledDays.has(d));
  }

  let raw: DayRow[] = [];
  if (rawDays.length) {
    raw = await loadDays(db, site.id, rawDays, filters, meter);
    if (filtered) raw = applyFilters(raw, filters);
    for (const [day, rows] of groupByDay(raw)) perDay.set(day, computeDay(rows));
  }
  return { perDay, raw };
}

const sortRows = (m: Map<string, number>): Row[] =>
  [...m]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, TOP);

function add(m: Map<string, number>, k: string, n: number) {
  m.set(k, (m.get(k) ?? 0) + n);
}

function totalsOf(perDay: Map<string, DailyRow[]>): Totals {
  let views = 0;
  let uniques = 0;
  let loads = 0;
  let bounces = 0;
  let msWeighted = 0;
  let msWeight = 0;
  for (const rows of perDay.values()) {
    let dayViews = 0;
    let dayMs: number | null = null;
    for (const r of rows) {
      if (r.dim !== "") continue;
      if (r.metric === "views") dayViews = r.value;
      else if (r.metric === "uniques") uniques += r.value;
      else if (r.metric === "loads") loads += r.value;
      else if (r.metric === "bounces") bounces += r.value;
      else if (r.metric === "visible_ms_p50") dayMs = r.value;
    }
    views += dayViews;
    // Days' medians combine as a view-weighted mean: an approximation of the range median.
    if (dayMs !== null) {
      msWeighted += dayMs * Math.max(dayViews, 1);
      msWeight += Math.max(dayViews, 1);
    }
  }
  return { views, uniques, loads, bounces, visibleMsP50: msWeight ? Math.round(msWeighted / msWeight) : 0 };
}

function seriesOf(range: Range, perDay: Map<string, DailyRow[]>): SeriesPoint[] {
  return daysBetween(range.from, range.to).map((t) => {
    const rows = perDay.get(t) ?? [];
    const v = (m: string) => rows.find((r) => r.metric === m && r.dim === "")?.value ?? 0;
    return { t, views: v("views"), uniques: v("uniques") };
  });
}

/** Minutes the zone is ahead of UTC at an instant. */
function offsetMin(ts: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(ts)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return Math.round((Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!) - Math.floor(ts / 60_000) * 60_000) / 60_000);
}

function hourlySeries(raw: DayRow[], tz: string): SeriesPoint[] {
  const views = new Array<number>(24).fill(0);
  const uniq = Array.from({ length: 24 }, () => new Set<string>());
  const pvs = raw.filter((r) => r.name === "pageview");
  // One Intl call at each end of the day; per-row Intl only on a DST-change day.
  const a = pvs.length ? offsetMin(pvs[0]!.ts, tz) : 0;
  const b = pvs.length ? offsetMin(pvs[pvs.length - 1]!.ts, tz) : 0;
  for (const r of pvs) {
    const h = a === b ? new Date(r.ts + a * 60_000).getUTCHours() : localHour(r.ts, tz);
    views[h]!++;
    if (r.visitor) uniq[h]!.add(r.visitor);
  }
  return views.map((v, h) => ({ t: `${String(h).padStart(2, "0")}:00`, views: v, uniques: uniq[h]!.size }));
}

const DIM_METRICS = { pages: "path", refs: "ref", tags: "tag", countries: "country", devices: "device", browsers: "browser", os: "os", outbound: "outbound", notFound: "not_found" } as const;

function breakdown(site: Site, perDay: Map<string, DailyRow[]>) {
  const dims = Object.fromEntries(Object.keys(DIM_METRICS).map((k) => [k, new Map<string, number>()])) as Record<keyof typeof DIM_METRICS, Map<string, number>>;
  const byMetric = new Map(Object.entries(DIM_METRICS).map(([k, m]) => [m as string, k as keyof typeof DIM_METRICS]));
  const events = new Map<string, number>();
  const props = new Map<string, Map<string, Map<string, number>>>();
  const sections = new Map<string, number>();
  const agents = new Map<string, number>();
  const vitals = new Map<string, { sum: number; n: number }>();

  for (const rows of perDay.values()) {
    for (const r of rows) {
      const target = byMetric.get(r.metric);
      if (target) add(dims[target], r.dim, r.value);
      else if (r.metric.startsWith("event:")) add(events, r.metric.slice(6), r.value);
      else if (r.metric.startsWith("prop:")) {
        const name = r.metric.slice(5);
        const eq = r.dim.indexOf("=");
        const key = r.dim.slice(0, eq);
        const val = r.dim.slice(eq + 1);
        let byKey = props.get(name);
        if (!byKey) props.set(name, (byKey = new Map()));
        let byVal = byKey.get(key);
        if (!byVal) byKey.set(key, (byVal = new Map()));
        add(byVal, val, r.value);
      } else if (r.metric.startsWith("section:")) add(sections, r.metric.slice(8), r.value);
      else if (r.metric.startsWith("agent:")) add(agents, `${r.metric.slice(6)}\u0000${r.dim}`, r.value);
      else if (r.metric.startsWith("vitals_p75:")) {
        // Per-day p75s combine as a plain mean across days: an approximation.
        const k = `${r.metric.slice(11)}\u0000${r.dim}`;
        const v = vitals.get(k) ?? { sum: 0, n: 0 };
        v.sum += r.value;
        v.n++;
        vitals.set(k, v);
      }
    }
  }

  const vitalsByPath = new Map<string, { path: string; lcp?: number; inp?: number; cls?: number }>();
  for (const [k, { sum, n }] of vitals) {
    const [m, path] = k.split("\u0000") as ["lcp" | "inp" | "cls", string];
    const entry = vitalsByPath.get(path) ?? { path };
    entry[m] = m === "cls" ? Math.round(sum / n) / 1000 : Math.round(sum / n);
    vitalsByPath.set(path, entry);
  }

  return {
    pages: sortRows(dims.pages),
    refs: sortRows(dims.refs),
    tags: sortRows(dims.tags),
    countries: sortRows(dims.countries),
    devices: sortRows(dims.devices),
    browsers: sortRows(dims.browsers),
    os: sortRows(dims.os),
    outbound: sortRows(dims.outbound),
    notFound: sortRows(dims.notFound),
    events: sortRows(events),
    eventProps: Object.fromEntries([...props].map(([name, byKey]) => [name, Object.fromEntries([...byKey].map(([k, vals]) => [k, sortRows(vals)]))])),
    funnel: site.funnel.map((section) => ({ section, loads: sections.get(section) ?? 0 })),
    agents: [...agents]
      .map(([k, value]) => {
        const [bot, path] = k.split("\u0000") as [string, string];
        return { bot, path, value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP),
    vitals: [...vitalsByPath.values()].sort((a, b) => (dims.pages.get(b.path) ?? 0) - (dims.pages.get(a.path) ?? 0)).slice(0, TOP),
  };
}

export function previousRange(range: Range): Range {
  const len = daysBetween(range.from, range.to).length;
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

export async function getStats(db: D1Database, site: Site, range: Range, filters: Filters, compare: boolean, nowMs: number, meter?: Meter): Promise<Stats> {
  const single = range.from === range.to;
  const unfiltered = Object.keys(filters).length === 0;
  const load = async (r: Range) => {
    let { perDay, raw } = await dailyFor(db, site, r, filters, single, meter);
    let hourly = single;
    // A single day past raw retention still has its rollup; show that, by day.
    if (single && raw.length === 0 && unfiltered) {
      const rolled = await dailyFor(db, site, r, filters, false, meter);
      if (rolled.perDay.size) {
        ({ perDay, raw } = rolled);
        hourly = false;
      }
    }
    return { perDay, series: hourly ? hourlySeries(raw, site.timezone) : seriesOf(r, perDay) };
  };
  const cur = await load(range);
  const stats: Stats = {
    range,
    totals: totalsOf(cur.perDay),
    series: cur.series,
    ...breakdown(site, cur.perDay),
    filtered: !unfiltered,
  };
  if (compare) {
    const prev = previousRange(range);
    const p = await load(prev);
    stats.compare = prev;
    stats.prevTotals = totalsOf(p.perDay);
    stats.prevSeries = p.series;
  }
  void nowMs;
  return stats;
}

/**
 * Views, visitors and a daily views series for every site at once, for the
 * all-sites page. A fixed handful of queries however many sites there are:
 * rollups and the two daily metrics via their indexes, and raw pageviews only
 * for days not rolled up yet (normally just today).
 */
export async function siteSummaries(db: D1Database, sites: Site[], days: number, nowMs: number, meter?: Meter): Promise<Map<string, { views: number[]; uniques: number[] }>> {
  const out = new Map<string, { views: number[]; uniques: number[] }>();
  if (!sites.length) return out;
  const windows = sites.map((site) => {
    const to = localDay(nowMs, site.timezone);
    return { site, list: daysBetween(addDays(to, -(days - 1)), to), start: firstDay(site) };
  });
  const from = windows.reduce((m, w) => (w.list[0]! < m ? w.list[0]! : m), windows[0]!.list[0]!);
  const [rolled, daily] = await db.batch([
    db.prepare("SELECT site_id, day FROM rollups WHERE day >= ?").bind(from),
    db.prepare("SELECT site_id, day, metric, value FROM daily WHERE metric IN ('views', 'uniques') AND dim = '' AND day >= ?").bind(from),
  ]);
  meter?.addAll([rolled!, daily!]);
  const isRolled = new Set((rolled!.results as { site_id: string; day: string }[]).map((r) => `${r.site_id} ${r.day}`));
  const v = new Map<string, number>();
  const u = new Map<string, number>();
  for (const r of daily!.results as { site_id: string; day: string; metric: string; value: number }[]) {
    (r.metric === "views" ? v : u).set(`${r.site_id} ${r.day}`, r.value);
  }

  // Raw pageview counts for unrolled days, many sites per statement.
  const terms: { sql: string; params: string[] }[] = [];
  for (const w of windows) {
    const need = w.list.filter((d) => d >= w.start && !isRolled.has(`${w.site.id} ${d}`));
    // Consecutive unrolled days go as one range (normally just today, an exact match).
    for (let i = 0; i < need.length; ) {
      let j = i;
      while (j + 1 < need.length && need[j + 1] === addDays(need[j]!, 1)) j++;
      terms.push(
        i === j
          ? { sql: "(site_id = ? AND day = ? AND name = 'pageview')", params: [w.site.id, need[i]!] }
          : { sql: "(site_id = ? AND day >= ? AND day <= ? AND name = 'pageview')", params: [w.site.id, need[i]!, need[j]!] },
      );
      i = j + 1;
    }
  }
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0; i < terms.length; ) {
    const group: typeof terms = [];
    let n = 0;
    while (i < terms.length && n + terms[i]!.params.length <= MAX_PARAMS) {
      n += terms[i]!.params.length;
      group.push(terms[i++]!);
    }
    stmts.push(
      db
        .prepare(`SELECT site_id, day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS uniques FROM events WHERE ${group.map((t) => t.sql).join(" OR ")} GROUP BY site_id, day`)
        .bind(...group.flatMap((t) => t.params)),
    );
  }
  if (stmts.length) {
    const res = await db.batch(stmts);
    meter?.addAll(res);
    for (const r of res.flatMap((x) => x.results as { site_id: string; day: string; views: number; uniques: number }[])) {
      v.set(`${r.site_id} ${r.day}`, r.views);
      u.set(`${r.site_id} ${r.day}`, r.uniques);
    }
  }

  for (const w of windows) {
    out.set(w.site.id, {
      views: w.list.map((d) => v.get(`${w.site.id} ${d}`) ?? 0),
      uniques: w.list.map((d) => u.get(`${w.site.id} ${d}`) ?? 0),
    });
  }
  return out;
}
