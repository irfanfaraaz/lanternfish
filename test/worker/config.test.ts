import { describe, expect, it } from "vitest";
import { accountDailyEvents, accountDailyReads, accountMaxSites, cronQueryBudget, isCloud, signupsOpen } from "../../src/worker/config";

describe("config", () => {
  it("MODE: only 'cloud' is cloud", () => {
    expect(isCloud({ MODE: "cloud" })).toBe(true);
    expect(isCloud({})).toBe(false);
    expect(isCloud({ MODE: "x" })).toBe(false);
  });

  it("SIGNUPS: open unless 'closed'", () => {
    expect(signupsOpen({})).toBe(true);
    expect(signupsOpen({ SIGNUPS: "closed" })).toBe(false);
  });

  it("limits fall back to defaults when missing or not positive", () => {
    expect(accountDailyEvents({})).toBe(10_000);
    expect(accountDailyEvents({ ACCOUNT_DAILY_EVENTS: "-1" })).toBe(10_000);
    expect(accountDailyEvents({ ACCOUNT_DAILY_EVENTS: "25" })).toBe(25);
    expect(accountDailyReads({})).toBe(500_000);
    expect(accountDailyReads({ ACCOUNT_DAILY_READS: "abc" })).toBe(500_000);
    expect(accountDailyReads({ ACCOUNT_DAILY_READS: "7" })).toBe(7);
    expect(accountMaxSites({})).toBe(10);
    expect(accountMaxSites({ ACCOUNT_MAX_SITES: "0" })).toBe(10);
    expect(accountMaxSites({ ACCOUNT_MAX_SITES: "3" })).toBe(3);
    expect(cronQueryBudget({})).toBe(40);
    expect(cronQueryBudget({ CRON_QUERY_BUDGET: "900" })).toBe(900);
  });
});
