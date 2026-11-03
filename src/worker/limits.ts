import { accountDailyEvents, accountDailyReads, isCloud } from "./config";
import type { Env } from "./env";
import { utcDay } from "./time";
import { type Meter, recordMeter, usageStmt } from "./usage";

export type AccountCounts = { events: number; rows_written: number; rows_read: number };

/** One account's counters for a UTC day (zeros when nothing was recorded). */
export async function accountUsage(db: D1Database, accountId: number, day: string): Promise<AccountCounts> {
  const row = await db
    .prepare("SELECT events, rows_written, rows_read FROM account_usage WHERE account_id = ? AND day = ?")
    .bind(accountId, day)
    .first<AccountCounts>();
  return { events: row?.events ?? 0, rows_written: row?.rows_written ?? 0, rows_read: row?.rows_read ?? 0 };
}

/** Adds to one account's counters for a day; meant to ride in the same D1 batch as the work it counts. */
export function accountUsageStmt(db: D1Database, accountId: number, day: string, events: number, rowsWritten: number, rowsRead: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO account_usage (account_id, day, events, rows_written, rows_read) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(account_id, day) DO UPDATE SET events = events + ?3, rows_written = rows_written + ?4, rows_read = rows_read + ?5`,
    )
    .bind(accountId, day, events, rowsWritten, rowsRead);
}

/** True when the account has stored its daily events (cloud mode only; self mode never queries). */
export async function accountOverEvents(env: Env, accountId: number, nowMs: number): Promise<boolean> {
  if (!isCloud(env)) return false;
  const u = await accountUsage(env.DB, accountId, utcDay(nowMs));
  return u.events >= accountDailyEvents(env);
}

/** True when the account has used its daily dashboard reads (cloud mode only; self mode never queries). */
export async function accountOverReads(env: Env, accountId: number, nowMs: number): Promise<boolean> {
  if (!isCloud(env)) return false;
  const u = await accountUsage(env.DB, accountId, utcDay(nowMs));
  return u.rows_read >= accountDailyReads(env);
}

/**
 * Records a request's dashboard reads and writes after the response. Self mode
 * charges the install only (as before); cloud mode also charges `accountId`,
 * in one batch with the install row.
 */
export function recordReads(env: Env, meter: Meter, accountId: number, nowMs: number): Promise<unknown> {
  if (!isCloud(env)) return recordMeter(env.DB, meter, nowMs);
  if (!meter.read && !meter.written) return Promise.resolve();
  const day = utcDay(nowMs);
  const written = meter.written + 2;
  return env.DB.batch([usageStmt(env.DB, day, 0, 0, written, meter.read), accountUsageStmt(env.DB, accountId, day, 0, written, meter.read)]);
}
