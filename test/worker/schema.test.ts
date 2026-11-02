import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("schema", () => {
  it("migration creates all tables", async () => {
    const { results } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>();
    const names = results.map((r) => r.name);
    for (const t of ["accounts", "sites", "events", "daily", "salts", "usage", "rollups"]) expect(names).toContain(t);
  });

  it("account 1 exists", async () => {
    const row = await env.DB.prepare("SELECT id FROM accounts WHERE id = 1").first();
    expect(row).not.toBeNull();
  });

  it("0002 adds account columns, account_usage and the sites index", async () => {
    const cols = (await env.DB.prepare("PRAGMA table_info(accounts)").all<{ name: string }>()).results.map((r) => r.name);
    expect(cols).toEqual(expect.arrayContaining(["password_hash", "session_gen"]));
    const pk = (await env.DB.prepare("PRAGMA table_info(account_usage)").all<{ name: string; pk: number }>()).results
      .filter((r) => r.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((r) => r.name);
    expect(pk).toEqual(["account_id", "day"]);
    const idx = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'sites_account'").first();
    expect(idx).not.toBeNull();
  });
});
