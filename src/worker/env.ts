export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  OWNER_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  RETENTION_DAYS?: string;
  DAILY_WRITE_BUDGET?: string;
  DAILY_READ_BUDGET?: string;
  /** "cloud" turns on sign-up and per-account limits; anything else is self-hosted. */
  MODE?: string;
  SIGNUPS?: string;
  ACCOUNT_DAILY_EVENTS?: string;
  ACCOUNT_DAILY_READS?: string;
  ACCOUNT_MAX_SITES?: string;
  CRON_QUERY_BUDGET?: string;
}

export type AppEnv = { Bindings: Env };
