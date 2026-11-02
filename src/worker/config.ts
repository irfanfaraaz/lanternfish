import type { Env } from "./env";

/** A positive number from a Worker var, or the default. */
export const positive = (v: string | undefined, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

/** Cloud mode: many accounts with sign-up and per-account limits. Anything else is self-hosted. */
export const isCloud = (env: Pick<Env, "MODE">): boolean => env.MODE === "cloud";

/** New sign-ups are allowed unless SIGNUPS is "closed". */
export const signupsOpen = (env: Pick<Env, "SIGNUPS">): boolean => env.SIGNUPS !== "closed";

/** Events stored per account per UTC day (cloud mode). */
export const accountDailyEvents = (env: Pick<Env, "ACCOUNT_DAILY_EVENTS">): number => positive(env.ACCOUNT_DAILY_EVENTS, 10_000);

/** Dashboard rows read per account per UTC day (cloud mode). */
export const accountDailyReads = (env: Pick<Env, "ACCOUNT_DAILY_READS">): number => positive(env.ACCOUNT_DAILY_READS, 500_000);

/** Sites per account (cloud mode). */
export const accountMaxSites = (env: Pick<Env, "ACCOUNT_MAX_SITES">): number => positive(env.ACCOUNT_MAX_SITES, 10);

/** D1 queries one cron run may use. Free plan allows 50 per invocation; paid allows 1,000. */
export const cronQueryBudget = (env: Pick<Env, "CRON_QUERY_BUDGET">): number => positive(env.CRON_QUERY_BUDGET, 40);
