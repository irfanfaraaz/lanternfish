export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  OWNER_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  RETENTION_DAYS?: string;
  DAILY_WRITE_BUDGET?: string;
  DAILY_READ_BUDGET?: string;
}

export type AppEnv = { Bindings: Env };
