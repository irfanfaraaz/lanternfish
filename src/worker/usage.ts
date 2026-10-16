import type { Usage } from "../shared/types";
import type { Env } from "./env";
import { utcDay } from "./time";

type Budgets = Pick<Env, "DAILY_WRITE_BUDGET" | "DAILY_READ_BUDGET">;

const positive = (v: string | undefined, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

/** Rows written per UTC day before ingest stops (D1 free: 100,000). */
export function budget(env: Budgets): number {
  return positive(env.DAILY_WRITE_BUDGET, 95_000);
}

/** Rows read per UTC day before the dashboard backs off (D1 free: 5,000,000), so ingest never starves. */
export function readBudget(env: Budgets): number {
  return positive(env.DAILY_READ_BUDGET, 4_000_000);
}

export async function todayUsage(db: D1Database, env: Budgets, nowMs: number): Promise<Usage> {
  const day = utcDay(nowMs);
  const row = await db
    .prepare("SELECT requests, events, rows_written, rows_read FROM usage WHERE day = ?")
    .bind(day)
    .first<{ requests: number; events: number; rows_written: number; rows_read: number }>();
  return {
    day,
    requests: row?.requests ?? 0,
    events: row?.events ?? 0,
    rows_written: row?.rows_written ?? 0,
    rows_read: row?.rows_read ?? 0,
    budget: budget(env),
    read_budget: readBudget(env),
  };
}

/** Adds to today's counters; meant to ride in the same D1 batch as the inserts. */
export function usageStmt(db: D1Database, day: string, requests: number, events: number, rowsWritten: number, rowsRead = 0): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO usage (day, requests, events, rows_written, rows_read) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(day) DO UPDATE SET requests = requests + ?2, events = events + ?3, rows_written = rows_written + ?4, rows_read = rows_read + ?5`,
    )
    .bind(day, requests, events, rowsWritten, rowsRead);
}

/** Counts D1 rows read across one request's dashboard queries. */
export class Meter {
  read = 0;
  written = 0;
  add(meta: { rows_read?: number; rows_written?: number } | undefined) {
    this.read += meta?.rows_read ?? 0;
    this.written += meta?.rows_written ?? 0;
  }
  addAll(results: { meta: { rows_read?: number; rows_written?: number } }[]) {
    for (const r of results) this.add(r.meta);
  }
}

/** Records a meter's reads and writes against today (one extra write). */
export function recordMeter(db: D1Database, meter: Meter, nowMs: number): Promise<unknown> {
  if (!meter.read && !meter.written) return Promise.resolve();
  return usageStmt(db, utcDay(nowMs), 0, 0, meter.written + 1, meter.read).run();
}
