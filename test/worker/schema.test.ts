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
});
